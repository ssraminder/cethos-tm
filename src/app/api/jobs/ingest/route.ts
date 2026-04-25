import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiKey } from "@/lib/api-keys";
import { getServiceClient } from "@/lib/supabase/server";
import { createJobFromBuffer } from "@/lib/jobs/create";
import { audit } from "@/lib/auth/audit";

const ContentSchema = z.object({
  // Either source_b64 or source_url. If both are given, source_b64 wins.
  source_b64: z.string().optional(),
  source_url: z.string().url().optional(),
  source_filename: z.string().min(1).max(256),
  source_mime_type: z.string().optional(),
  source_lang: z.string().min(2).max(10),
  target_lang: z.string().min(2).max(10),
  reference: z.string().max(64).optional(),
  external_ref: z.string().max(128).optional(),
  client_external_ref: z.string().max(128).optional(),
  assigned_to_email: z.string().email().optional(),
  reviewer_email: z.string().email().optional(),
  qa_profile_id: z.string().uuid().optional(),
  deadline: z.string().optional(),
  tm_ids: z.array(z.string().uuid()).optional(),
  termbase_ids: z.array(z.string().uuid()).optional(),
});

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

/**
 * POST /api/jobs/ingest
 *
 * Authenticated by Bearer API key with scope=tms_ingest.
 *
 * Body (JSON):
 * {
 *   "source_b64": "<base64 of file>" | "source_url": "https://...",
 *   "source_filename": "doc.docx",
 *   "source_mime_type": "application/vnd...",
 *   "source_lang": "en-US",
 *   "target_lang": "fr-FR",
 *   "external_ref": "TMS-12345",
 *   "client_external_ref": "ACME",                  // resolves to existing public.clients
 *   "assigned_to_email": "translator@example.com",  // optional
 *   "qa_profile_id": "uuid",                        // optional, defaults to default profile
 *   "tm_ids": ["uuid", ...],                        // optional
 *   "termbase_ids": ["uuid", ...],                  // optional
 *   "deadline": "2026-05-01T17:00:00Z"              // optional ISO-8601
 * }
 *
 * Returns 200 { job_id, reference, segments, words, source_format }
 */
export async function POST(req: NextRequest) {
  const apiKey = bearer(req);
  if (!apiKey) return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  const record = await verifyApiKey(apiKey, "tms_ingest");
  if (!record) return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body must be JSON" }, { status: 400 }); }

  const parsed = ContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }
  const p = parsed.data;
  if (!p.source_b64 && !p.source_url) {
    return NextResponse.json({ error: "Provide source_b64 or source_url" }, { status: 422 });
  }

  // Fetch source bytes.
  let buffer: Buffer;
  if (p.source_b64) {
    try { buffer = Buffer.from(p.source_b64, "base64"); }
    catch { return NextResponse.json({ error: "Invalid base64" }, { status: 422 }); }
  } else {
    const res = await fetch(p.source_url!);
    if (!res.ok) return NextResponse.json({ error: `Source URL fetch failed: ${res.status}` }, { status: 422 });
    buffer = Buffer.from(await res.arrayBuffer());
  }

  const supabase = await getServiceClient();

  // Resolve client_id from external ref if provided.
  let client_id: string | null = null;
  if (p.client_external_ref) {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("external_ref", p.client_external_ref)
      .maybeSingle();
    client_id = client?.id ?? (record.client_id ?? null);
  } else {
    client_id = record.client_id ?? null;
  }

  // Resolve assignee + reviewer by email.
  let assigned_to: string | null = null;
  let reviewer_id: string | null = null;
  if (p.assigned_to_email) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", p.assigned_to_email)
      .maybeSingle();
    assigned_to = data?.id ?? null;
  }
  if (p.reviewer_email) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", p.reviewer_email)
      .maybeSingle();
    reviewer_id = data?.id ?? null;
  }

  // Use API key's owner as job creator (for audit trail).
  const created_by = record.created_by ?? assigned_to;
  if (!created_by) {
    return NextResponse.json({ error: "Cannot determine creator: API key has no owner and no assignee resolved." }, { status: 422 });
  }

  let result;
  try {
    result = await createJobFromBuffer({
      source_buffer: buffer,
      source_filename: p.source_filename,
      source_mime_type: p.source_mime_type,
      source_lang: p.source_lang,
      target_lang: p.target_lang,
      reference: p.reference,
      external_ref: p.external_ref,
      source: "tms_push",
      created_by,
      assigned_to,
      reviewer_id,
      client_id,
      deadline: p.deadline ?? null,
      qa_profile_id: p.qa_profile_id,
      tm_ids: p.tm_ids,
      termbase_ids: p.termbase_ids,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  await audit({
    category: "job",
    action: "job_ingested_api",
    actorId: record.created_by,
    targetType: "job",
    targetId: result.job_id,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null,
    userAgent: req.headers.get("user-agent"),
    meta: {
      api_key_id: record.id,
      api_key_name: record.name,
      reference: result.reference,
      external_ref: p.external_ref,
      segments: result.segments,
      words: result.words,
    },
  });

  return NextResponse.json(result, { status: 201 });
}
