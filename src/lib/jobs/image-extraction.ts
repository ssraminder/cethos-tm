/**
 * Image and scanned-PDF intake.
 *
 * Sends the file to the self-hosted Cethos OCR service (services/ocr) and
 * turns each text region it finds into one segment. The region's position on
 * the page is kept in the segment's meta.location so the editor can show the
 * page image beside the segments and highlight the active region.
 *
 * The OCR service runs on infrastructure Cethos controls. No third-party AI
 * provider is involved, so this path does not depend on the job's
 * third-party AI switch.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Segment } from "@/lib/jobs/segmentation";

const STORAGE_BUCKET = "cat-source-files";
const OCR_TIMEOUT_MS = 120_000;

export interface ImageRegionLocation {
  kind: "image_region";
  page: number;
  /** [x0, y0, x1, y1] in pixels of the page image, origin top-left. */
  box: [number, number, number, number];
  polygon: [number, number][];
  page_width: number;
  page_height: number;
  /** OCR confidence, 0..1. Not a reliable error flag on its own. */
  confidence: number;
  /** The text exactly as OCR read it, kept when a human corrects the source. */
  ocr_text: string;
}

export interface ImagePage {
  page: number;
  width: number;
  height: number;
  jpeg: Buffer;
}

export interface ImageExtraction {
  engine: string;
  model: string;
  segments: Segment[];
  locations: Map<number, ImageRegionLocation>;
  pages: ImagePage[];
}

export interface StoredImagePage {
  page: number;
  width: number;
  height: number;
  storage_path: string;
}

interface OcrRegion {
  text: string;
  confidence: number;
  box: [number, number, number, number];
  polygon: [number, number][];
}

interface OcrResponse {
  engine: string;
  model: string;
  pages: Array<{ page: number; width: number; height: number; regions: OcrRegion[]; image_jpeg_b64?: string }>;
}

export function isOcrConfigured(): boolean {
  return Boolean(process.env.OCR_SERVICE_URL && process.env.OCR_SERVICE_KEY);
}

/**
 * Run OCR on a PDF, JPEG or PNG and return one segment per text region.
 * Throws with a message that is safe to show to a PM.
 */
export async function extractImageBuffer(buffer: Buffer): Promise<ImageExtraction> {
  const base = process.env.OCR_SERVICE_URL?.replace(/\/+$/, "");
  const key = process.env.OCR_SERVICE_KEY;
  if (!base || !key) {
    throw new Error("Image and PDF jobs need the Cethos OCR service, which is not configured on this server.");
  }

  let res: Response;
  try {
    res = await fetch(`${base}/ocr?include_images=true&max_pages=20`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/octet-stream" },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
    });
  } catch {
    throw new Error("The OCR service could not be reached. Try again in a minute.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? "";
    } catch {
      /* no body */
    }
    throw new Error(detail ? `OCR failed: ${detail}` : `OCR failed with status ${res.status}.`);
  }

  const data = (await res.json()) as OcrResponse;
  const segments: Segment[] = [];
  const locations = new Map<number, ImageRegionLocation>();
  const pages: ImagePage[] = [];
  let seq = 0;

  for (const page of data.pages ?? []) {
    if (page.image_jpeg_b64) {
      pages.push({
        page: page.page,
        width: page.width,
        height: page.height,
        jpeg: Buffer.from(page.image_jpeg_b64, "base64"),
      });
    }
    for (const region of page.regions ?? []) {
      const text = (region.text ?? "").trim();
      if (!text) continue;
      seq += 1;
      const norm = text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
      segments.push({
        seq,
        source_text: text,
        source_hash: createHash("sha256").update(norm).digest("hex"),
        word_count: text.split(/\s+/).filter(Boolean).length,
      });
      locations.set(seq, {
        kind: "image_region",
        page: page.page,
        box: region.box,
        polygon: region.polygon,
        page_width: page.width,
        page_height: page.height,
        confidence: region.confidence,
        ocr_text: text,
      });
    }
  }

  return { engine: data.engine, model: data.model, segments, locations, pages };
}

/**
 * Store the rendered page images next to the job's source file and record
 * them on jobs.meta.image so the editor can load them. Returns the stored
 * page list. Throws if an upload fails; the caller rolls the job back.
 */
export async function saveImagePages(
  supabase: SupabaseClient,
  jobId: string,
  extraction: ImageExtraction,
): Promise<StoredImagePage[]> {
  const stored: StoredImagePage[] = [];
  for (const page of extraction.pages) {
    const storage_path = `jobs/${jobId}/pages/page-${page.page}.jpg`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storage_path, page.jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`Page image upload failed: ${error.message}`);
    stored.push({ page: page.page, width: page.width, height: page.height, storage_path });
  }
  const { data: job } = await supabase.from("jobs").select("meta").eq("id", jobId).maybeSingle();
  const meta = { ...((job?.meta as Record<string, unknown> | null) ?? {}) };
  meta.image = { engine: extraction.engine, model: extraction.model, pages: stored };
  const { error: metaErr } = await supabase.from("jobs").update({ meta }).eq("id", jobId);
  if (metaErr) throw new Error(`Could not record page images: ${metaErr.message}`);
  return stored;
}

/** Storage paths of a job's page images, for cleanup when job creation fails. */
export function imagePagePaths(jobId: string, extraction: ImageExtraction): string[] {
  return extraction.pages.map((p) => `jobs/${jobId}/pages/page-${p.page}.jpg`);
}
