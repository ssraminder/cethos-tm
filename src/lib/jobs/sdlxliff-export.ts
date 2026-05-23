import JSZip from "jszip";
import { getServiceClient } from "@/lib/supabase/server";
import { reinsertInlineTags, type InlineTag } from "@/lib/xliff/tags";

const STORAGE_BUCKET = "cat-source-files";

interface SegmentRow {
  seq: number;
  source_text: string;
  target_text: string;
  status: string;
  meta: { tags?: unknown } | null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function statusToSdlConf(status: string): string {
  if (status === "reviewed") return "ApprovedTranslation";
  if (status === "translated") return "Translated";
  if (status === "draft") return "Draft";
  return "Draft";
}

function statusToXliffState(status: string): string {
  if (status === "reviewed" || status === "translated") return "translated";
  if (status === "draft") return "needs-translation";
  return "new";
}

/**
 * Build an SDLXLIFF document from scratch (for jobs not originally from .sdlxliff).
 * Produces a valid SDLXLIFF 1.2 with sdl:seg-defs for each segment.
 */
function buildSdlXliff({
  source_lang,
  target_lang,
  original,
  segments,
}: {
  source_lang: string;
  target_lang: string;
  original: string;
  segments: Array<{
    id: string;
    source_text: string;
    target_text: string;
    status: string;
    source_tags?: InlineTag[];
  }>;
}): string {
  const tus = segments.map((s) => {
    const conf = statusToSdlConf(s.status);
    const state = statusToXliffState(s.status);
    const sourceInner = s.source_tags && s.source_tags.length > 0
      ? reinsertInlineTags(s.source_text, s.source_tags).xml_inner
      : escapeXml(s.source_text);
    const targetInner = s.source_tags && s.source_tags.length > 0
      ? reinsertInlineTags(s.target_text || "", s.source_tags).xml_inner
      : escapeXml(s.target_text || "");
    return `    <trans-unit id="${escapeXml(s.id)}">
      <source><mrk mtype="seg" mid="0">${sourceInner}</mrk></source>
      <target state="${escapeXml(state)}"><mrk mtype="seg" mid="0">${targetInner}</mrk></target>
      <sdl:seg-defs>
        <sdl:seg id="0" conf="${conf}" />
      </sdl:seg-defs>
    </trans-unit>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" xmlns:sdl="http://sdl.com/FileTypes/SdlXliff/1.0" version="1.2" sdl:version="1.0">
  <file original="${escapeXml(original)}" source-language="${escapeXml(source_lang)}" target-language="${escapeXml(target_lang)}" datatype="plaintext">
    <body>
${tus}
    </body>
  </file>
</xliff>
`;
}

/**
 * Splice translations into an existing SDLXLIFF file, preserving the full
 * SDL envelope (comments, revision history, formatting metadata).
 *
 * Strategy: walk each <trans-unit>, find <mrk mtype="seg" mid="N"> in
 * <target>, replace inner content with translation. Update sdl:seg-defs
 * conf status. Segment IDs in our DB are "{tuId}_{mid}".
 */
function spliceTranslationsIntoSdlXliff(
  originalXml: string,
  segMap: Map<string, SegmentRow>,
): string {
  let result = originalXml;

  result = result.replace(
    /<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/g,
    (fullMatch, tuAttrs: string, tuBody: string) => {
      const tuIdMatch = tuAttrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
      if (!tuIdMatch) return fullMatch;
      const tuId = tuIdMatch[1];

      // Check if this TU has sub-segmented mrk elements in source
      const sourceMrks = [...tuBody.matchAll(/<source\b[^>]*>([\s\S]*?)<\/source>/gi)];
      if (sourceMrks.length === 0) return fullMatch;
      const sourceInner = sourceMrks[0][1];
      const hasMrkSegs = /<mrk\b[^>]*\bmtype\s*=\s*["']seg["']/i.test(sourceInner);

      if (!hasMrkSegs) {
        // Non-sub-segmented TU — segment ID = tuId
        const seg = segMap.get(tuId);
        if (!seg) return fullMatch;
        const tags = extractTagsFromMeta(seg.meta);
        const targetText = seg.target_text || "";
        const targetInner = tags && tags.length > 0
          ? reinsertInlineTags(targetText, tags).xml_inner
          : escapeXml(targetText);
        const state = statusToXliffState(seg.status);

        let newBody = tuBody;
        // Replace or insert <target>
        if (/<target\b/i.test(newBody)) {
          newBody = newBody.replace(
            /<target\b[^>]*>[\s\S]*?<\/target>/i,
            `<target state="${state}">${targetInner}</target>`,
          );
        } else {
          newBody = newBody.replace(
            /(<\/source>)/i,
            `$1\n      <target state="${state}">${targetInner}</target>`,
          );
        }
        return `<trans-unit${tuAttrs}>${newBody}</trans-unit>`;
      }

      // Sub-segmented TU — splice each mrk individually
      let newBody = tuBody;

      // Build a map of mid -> segment for this TU
      const tuSegments = new Map<string, SegmentRow>();
      for (const [key, seg] of segMap) {
        if (key.startsWith(`${tuId}_`)) {
          const mid = key.slice(tuId.length + 1);
          tuSegments.set(mid, seg);
        }
      }

      if (tuSegments.size === 0) return fullMatch;

      // Replace each mrk in <target>
      const targetMatch = newBody.match(/(<target\b[^>]*>)([\s\S]*?)(<\/target>)/i);
      if (targetMatch) {
        let targetInner = targetMatch[2];
        // Replace each mrk mtype="seg" in target
        targetInner = targetInner.replace(
          /<mrk\b([^>]*\bmtype\s*=\s*["']seg["'][^>]*\bmid\s*=\s*["'](\d+)["'][^>]*)>([\s\S]*?)<\/mrk>/gi,
          (_mrkMatch, mrkAttrs: string, mid: string, _mrkInner: string) => {
            const seg = tuSegments.get(mid);
            if (!seg) return _mrkMatch;
            const tags = extractTagsFromMeta(seg.meta);
            const targetText = seg.target_text || "";
            const inner = tags && tags.length > 0
              ? reinsertInlineTags(targetText, tags).xml_inner
              : escapeXml(targetText);
            return `<mrk${mrkAttrs}>${inner}</mrk>`;
          },
        );
        // Also handle reversed attribute order (mid before mtype)
        targetInner = targetInner.replace(
          /<mrk\b([^>]*\bmid\s*=\s*["'](\d+)["'][^>]*\bmtype\s*=\s*["']seg["'][^>]*)>([\s\S]*?)<\/mrk>/gi,
          (_mrkMatch, mrkAttrs: string, mid: string, _mrkInner: string) => {
            const seg = tuSegments.get(mid);
            if (!seg) return _mrkMatch;
            const tags = extractTagsFromMeta(seg.meta);
            const targetText = seg.target_text || "";
            const inner = tags && tags.length > 0
              ? reinsertInlineTags(targetText, tags).xml_inner
              : escapeXml(targetText);
            return `<mrk${mrkAttrs}>${inner}</mrk>`;
          },
        );

        const state = statusToXliffState(
          [...tuSegments.values()].every((s) => s.status === "reviewed" || s.status === "translated")
            ? "translated" : "draft",
        );
        newBody = newBody.replace(
          /(<target)\b[^>]*(>[\s\S]*?<\/target>)/i,
          `$1 state="${state}"${targetInner ? "" : ""}$2`,
        );
        // Actually replace the target content
        newBody = newBody.replace(
          /(<target\b[^>]*>)[\s\S]*?(<\/target>)/i,
          `$1${targetInner}$2`,
        );
      }

      // Update sdl:seg-defs conf values
      newBody = newBody.replace(
        /<sdl:seg\b([^>]*\bid\s*=\s*["'](\d+)["'][^>]*)\/?\s*>/gi,
        (segMatch, segAttrs: string, segId: string) => {
          const seg = tuSegments.get(segId);
          if (!seg) return segMatch;
          const newConf = statusToSdlConf(seg.status);
          if (/\bconf\s*=/i.test(segAttrs)) {
            const updated = segAttrs.replace(/\bconf\s*=\s*["'][^"']*["']/i, `conf="${newConf}"`);
            return `<sdl:seg${updated} />`;
          }
          return `<sdl:seg${segAttrs} conf="${newConf}" />`;
        },
      );

      return `<trans-unit${tuAttrs}>${newBody}</trans-unit>`;
    },
  );

  return result;
}

function extractTagsFromMeta(meta: { tags?: unknown } | null): InlineTag[] | null {
  if (!meta || !meta.tags) return null;
  if (!Array.isArray(meta.tags)) return null;
  return meta.tags as InlineTag[];
}

export async function exportJobAsSdlXliff(jobId: string): Promise<{
  buffer: Buffer;
  filename: string;
} | { error: string }> {
  const supabase = await getServiceClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, reference, source_filename, source_format, source_storage_path, source_lang, target_lang")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "Job not found" };

  const { data: segs } = await supabase
    .from("segments")
    .select("seq, source_text, target_text, status, meta")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });
  if (!segs || segs.length === 0) return { error: "No segments found" };

  const segments = segs as SegmentRow[];

  // If the source was SDLXLIFF, splice translations into the original envelope
  if (job.source_format === "sdlxliff" && job.source_storage_path) {
    const { data: file, error: dlErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(job.source_storage_path);
    if (!dlErr && file) {
      const originalXml = Buffer.from(await file.arrayBuffer()).toString("utf8");

      // Build segment map keyed by segment ID (tuId_mid or tuId)
      // Segment IDs are stored as the unit id during ingest — we need to
      // reconstruct them. For sub-segmented files the segment id is
      // "{tuId}_{mid}" and the seq maps to the order they were ingested.
      // We need to re-parse the original to get the ID mapping.
      const segIdMap = buildSegIdMapFromOriginal(originalXml);
      const segByKey = new Map<string, SegmentRow>();
      for (const seg of segments) {
        const segId = segIdMap.get(seg.seq);
        if (segId) segByKey.set(segId, seg);
      }

      const exported = spliceTranslationsIntoSdlXliff(originalXml, segByKey);
      const baseName = job.source_filename.replace(/\.sdlxliff$/i, "");
      return {
        buffer: Buffer.from(exported, "utf8"),
        filename: `${baseName}-${job.target_lang}.sdlxliff`,
      };
    }
  }

  // Fallback: build from scratch
  const xml = buildSdlXliff({
    source_lang: job.source_lang,
    target_lang: job.target_lang,
    original: job.source_filename || `${job.reference}.txt`,
    segments: segments.map((s) => ({
      id: String(s.seq),
      source_text: s.source_text,
      target_text: s.target_text,
      status: s.status,
      source_tags: extractTagsFromMeta(s.meta) ?? undefined,
    })),
  });
  const baseName = (job.source_filename || job.reference).replace(/\.[^.]+$/, "");
  return {
    buffer: Buffer.from(xml, "utf8"),
    filename: `${baseName}.sdlxliff`,
  };
}

/**
 * Re-parse the original SDLXLIFF to map segment seq → segment ID
 * (matching what parseSdlXliff produces during ingest).
 */
function buildSegIdMapFromOriginal(xml: string): Map<number, string> {
  const map = new Map<number, string>();
  let seq = 0;

  const tuRe = /<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/g;
  let tuMatch: RegExpExecArray | null;
  while ((tuMatch = tuRe.exec(xml)) !== null) {
    const tuAttrs = tuMatch[1];
    const tuBlock = tuMatch[2];
    const tuIdMatch = tuAttrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
    if (!tuIdMatch) continue;
    const tuId = tuIdMatch[1];

    if (/\btranslate\s*=\s*["']no["']/i.test(tuAttrs)) continue;

    const sourceMatch = tuBlock.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i);
    if (!sourceMatch) continue;
    const sourceInner = sourceMatch[1];

    // Check for locked segments in seg-defs
    const lockedMids = new Set<string>();
    const defsMatch = tuBlock.match(/<sdl:seg-defs\b[^>]*>([\s\S]*?)<\/sdl:seg-defs>/i);
    if (defsMatch) {
      const segRe = /<sdl:seg\b([^>]*?)\/?\s*>/gi;
      let sm: RegExpExecArray | null;
      while ((sm = segRe.exec(defsMatch[1])) !== null) {
        const sAttrs = sm[1];
        if (/\blocked\s*=\s*["']true["']/i.test(sAttrs)) {
          const sidMatch = sAttrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
          if (sidMatch) lockedMids.add(sidMatch[1]);
        }
      }
    }

    // Extract mrk segments
    const mrkRe = /<mrk\b[^>]*\bmtype\s*=\s*["']seg["'][^>]*\bmid\s*=\s*["'](\d+)["'][^>]*>([\s\S]*?)<\/mrk>/gi;
    const mrks: Array<{ mid: string; text: string }> = [];
    let mm: RegExpExecArray | null;
    while ((mm = mrkRe.exec(sourceInner)) !== null) {
      mrks.push({ mid: mm[1], text: mm[2] });
    }
    // Also try reversed attribute order
    if (mrks.length === 0) {
      const mrkRe2 = /<mrk\b[^>]*\bmid\s*=\s*["'](\d+)["'][^>]*\bmtype\s*=\s*["']seg["'][^>]*>([\s\S]*?)<\/mrk>/gi;
      while ((mm = mrkRe2.exec(sourceInner)) !== null) {
        mrks.push({ mid: mm[1], text: mm[2] });
      }
    }

    if (mrks.length > 0) {
      for (const mrk of mrks) {
        if (lockedMids.has(mrk.mid)) continue;
        // Strip locked markers and inline tags to get plain text, check if non-empty
        const cleaned = mrk.text
          .replace(/<mrk\b[^>]*\bmtype\s*=\s*["']x-sdl-locked["'][^>]*>/gi, "")
          .replace(/<\/mrk>/gi, "")
          .replace(/<[^>]+>/g, "")
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .trim();
        if (!cleaned) continue;
        seq += 1;
        map.set(seq, `${tuId}_${mrk.mid}`);
      }
    } else {
      // No sub-segmentation
      const plainSource = sourceInner
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .trim();
      if (!plainSource) continue;
      seq += 1;
      map.set(seq, tuId);
    }
  }

  return map;
}

/**
 * Export a job as an SDL return package (.sdlrpx).
 * If the source was an .sdlppx, reconstruct the package with translated .sdlxliff files.
 * Otherwise, wrap the generated .sdlxliff in a minimal package.
 */
export async function exportJobAsSdlPackage(
  jobId: string,
  packageType: "sdlppx" | "sdlrpx" = "sdlrpx",
): Promise<{
  buffer: Buffer;
  filename: string;
} | { error: string }> {
  const supabase = await getServiceClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, reference, source_filename, source_format, source_storage_path, source_lang, target_lang")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "Job not found" };

  const { data: segs } = await supabase
    .from("segments")
    .select("seq, source_text, target_text, status, meta")
    .eq("job_id", jobId)
    .order("seq", { ascending: true });
  if (!segs || segs.length === 0) return { error: "No segments found" };

  const segments = segs as SegmentRow[];
  const ext = packageType === "sdlppx" ? "sdlppx" : "sdlrpx";

  // If the source was an SDL package, reconstruct from original
  if (job.source_format === "sdlppx" && job.source_storage_path) {
    const { data: file, error: dlErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(job.source_storage_path);
    if (!dlErr && file) {
      const originalBuf = Buffer.from(await file.arrayBuffer());
      const result = await rebuildSdlPackage(originalBuf, segments, job.target_lang);
      const baseName = job.source_filename.replace(/\.(sdlppx|sdlrpx)$/i, "");
      return {
        buffer: result,
        filename: `${baseName}-${job.target_lang}.${ext}`,
      };
    }
  }

  // Fallback: build from the SDLXLIFF export wrapped in a ZIP
  const sdlxliffResult = await exportJobAsSdlXliff(jobId);
  if ("error" in sdlxliffResult) return sdlxliffResult;

  const zip = new JSZip();
  const sdlxliffFilename = sdlxliffResult.filename;
  zip.file(sdlxliffFilename, sdlxliffResult.buffer);

  // Generate a minimal .sdlproj
  const projXml = buildMinimalSdlProj({
    source_lang: job.source_lang,
    target_lang: job.target_lang,
    projectName: job.reference,
    files: [sdlxliffFilename],
  });
  zip.file(`${job.reference}.sdlproj`, projXml);

  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  const baseName = (job.source_filename || job.reference).replace(/\.[^.]+$/, "");
  return {
    buffer,
    filename: `${baseName}.${ext}`,
  };
}

async function rebuildSdlPackage(
  originalBuf: Buffer,
  segments: SegmentRow[],
  targetLang: string,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(originalBuf);

  // Build a global seq counter matching what parseSdlPackage does
  // (files in the order they appear in the ZIP, units within each file)
  let globalSeq = 0;

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!path.toLowerCase().endsWith(".sdlxliff")) continue;

    const xml = Buffer.from(await entry.async("arraybuffer")).toString("utf8");
    const segIdMap = buildSegIdMapFromOriginal(xml);

    // Build segment map for this file
    const fileSegMap = new Map<string, SegmentRow>();
    // segIdMap is 1-based within this file; we need to offset by globalSeq
    const fileSegCount = segIdMap.size;
    for (let localSeq = 1; localSeq <= fileSegCount; localSeq++) {
      globalSeq += 1;
      const segId = segIdMap.get(localSeq);
      const seg = segments.find((s) => s.seq === globalSeq);
      if (segId && seg) {
        fileSegMap.set(segId, seg);
      }
    }

    if (fileSegMap.size > 0) {
      const exported = spliceTranslationsIntoSdlXliff(xml, fileSegMap);
      zip.file(path, exported);
    }
  }

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

function buildMinimalSdlProj({
  source_lang,
  target_lang,
  projectName,
  files,
}: {
  source_lang: string;
  target_lang: string;
  projectName: string;
  files: string[];
}): string {
  const fileEntries = files.map((f) => `      <File>${escapeXml(f)}</File>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://sdl.com/ProjectApi/2.0">
  <Name>${escapeXml(projectName)}</Name>
  <SourceLanguageCode>${escapeXml(source_lang)}</SourceLanguageCode>
  <TargetLanguageCode>${escapeXml(target_lang)}</TargetLanguageCode>
  <Files>
${fileEntries}
  </Files>
</Project>
`;
}
