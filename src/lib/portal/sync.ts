import { getPortalClient, isPortalConfigured } from "./client";
import { getServiceClient } from "../supabase/server";

export interface SyncResult {
  clients_added: number;
  clients_updated: number;
  vendors_added: number;
  vendors_updated: number;
  errors: string[];
}

/**
 * Pull active customers from the portal's `customers` table and upsert into
 * our local `clients` table, matched by external_ref = portal customer id.
 *
 * - Individuals (no company) are stored as one client per row, name = full_name
 * - Business customers grouped by company are inserted with name = company_name
 *   and external_ref = company_id, deduped on the company id
 */
export async function syncClients(): Promise<{ added: number; updated: number; errors: string[] }> {
  if (!isPortalConfigured()) {
    return { added: 0, updated: 0, errors: ["Portal Supabase not configured"] };
  }

  const portal = getPortalClient();
  const local = await getServiceClient();
  const errors: string[] = [];

  // Pull active business companies as canonical clients first (if companies table exists),
  // then pull individuals as one-off clients. Try companies; fall back gracefully.
  let companies: Array<{ id: string; name: string }> = [];
  try {
    const { data, error } = await portal.from("companies").select("id, name").limit(2000);
    if (error) {
      // Table may not exist on older schemas — fall back to customers-only.
      if (!/relation .* does not exist/i.test(error.message)) errors.push(`companies: ${error.message}`);
    } else {
      companies = (data ?? []).map((c) => ({ id: c.id, name: c.name }));
    }
  } catch (e) {
    errors.push(`companies fetch: ${(e as Error).message}`);
  }

  // Pull customers (individuals + linked-to-company)
  const { data: customers, error: custErr } = await portal
    .from("customers")
    .select("id, email, full_name, customer_type, company_name, company_id")
    .limit(5000);
  if (custErr) {
    errors.push(`customers: ${custErr.message}`);
    return { added: 0, updated: 0, errors };
  }

  // Build the canonical set: each company once + each individual once
  type ClientRow = { external_ref: string; name: string; slug: string; meta: Record<string, unknown> };
  const map = new Map<string, ClientRow>();
  function slugify(s: string): string {
    return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 80) || "client";
  }

  for (const c of companies) {
    const ext = `company:${c.id}`;
    if (!map.has(ext)) {
      map.set(ext, { external_ref: ext, name: c.name, slug: slugify(c.name), meta: { source: "portal", kind: "company", portal_id: c.id } });
    }
  }
  for (const cust of customers ?? []) {
    if (cust.company_id) {
      // Business customer with company — already represented by company entry; nothing to add
      continue;
    }
    if (cust.customer_type === "business" && cust.company_name) {
      const ext = `company-name:${slugify(cust.company_name)}`;
      if (!map.has(ext)) {
        map.set(ext, { external_ref: ext, name: cust.company_name, slug: slugify(cust.company_name), meta: { source: "portal", kind: "company", portal_customer_id: cust.id } });
      }
    } else {
      const ext = `customer:${cust.id}`;
      const name = cust.full_name?.trim() || cust.email;
      if (!map.has(ext)) {
        map.set(ext, { external_ref: ext, name, slug: slugify(name), meta: { source: "portal", kind: "individual", portal_customer_id: cust.id, email: cust.email } });
      }
    }
  }

  // Upsert into local.clients on external_ref (unique by slug — we resolve collisions by suffixing).
  let added = 0;
  let updated = 0;
  for (const row of map.values()) {
    // Lookup existing by external_ref
    const { data: existing } = await local.from("clients").select("id, slug").eq("external_ref", row.external_ref).maybeSingle();
    if (existing) {
      const { error } = await local.from("clients")
        .update({ name: row.name, meta: row.meta, portal_synced_at: new Date().toISOString(), active: true })
        .eq("id", existing.id);
      if (error) { errors.push(`update ${row.external_ref}: ${error.message}`); continue; }
      updated++;
    } else {
      // Make slug unique
      let candidate = row.slug;
      let n = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: clash } = await local.from("clients").select("id").eq("slug", candidate).maybeSingle();
        if (!clash) break;
        n++;
        candidate = `${row.slug}-${n}`;
        if (n > 50) break;
      }
      const { error } = await local.from("clients").insert({
        external_ref: row.external_ref,
        name: row.name,
        slug: candidate,
        meta: row.meta,
        portal_synced_at: new Date().toISOString(),
        active: true,
      });
      if (error) { errors.push(`insert ${row.external_ref}: ${error.message}`); continue; }
      added++;
    }
  }

  return { added, updated, errors };
}

/**
 * Pull vendors from the portal and upsert into our local profiles table as
 * translator-role users with auth_source='vendor_portal_sso'. Each portal
 * vendor becomes a CAT profile linked via profiles.vendor_user_id.
 *
 * Vendors without a Supabase auth user yet (invitation not accepted) are
 * skipped — they have no email-confirmed account to mirror. Once they
 * accept the invitation in the portal, they'll appear on the next sync.
 *
 * Language pairs are stored on profiles.meta.language_pairs.
 */
export async function syncVendors(): Promise<{ added: number; updated: number; errors: string[] }> {
  if (!isPortalConfigured()) {
    return { added: 0, updated: 0, errors: ["Portal Supabase not configured"] };
  }

  const portal = getPortalClient();
  const local = await getServiceClient();
  const errors: string[] = [];

  const { data: vendors, error } = await portal
    .from("vendors")
    .select("id, full_name, email, status, vendor_type, country, native_languages")
    .eq("status", "active")
    .limit(5000);
  if (error) return { added: 0, updated: 0, errors: [`vendors: ${error.message}`] };

  // Pull language pairs in one bulk query
  const vendorIds = (vendors ?? []).map((v) => v.id);
  let pairs: Array<{ vendor_id: string; source_language: string; target_language: string; is_active: boolean }> = [];
  if (vendorIds.length > 0) {
    const { data: pairData, error: pairErr } = await portal
      .from("vendor_language_pairs")
      .select("vendor_id, source_language, target_language, is_active")
      .in("vendor_id", vendorIds)
      .eq("is_active", true);
    if (pairErr) errors.push(`vendor_language_pairs: ${pairErr.message}`);
    else pairs = pairData ?? [];
  }
  const pairsByVendor = new Map<string, Array<{ src: string; tgt: string }>>();
  for (const p of pairs) {
    const arr = pairsByVendor.get(p.vendor_id) ?? [];
    arr.push({ src: p.source_language, tgt: p.target_language });
    pairsByVendor.set(p.vendor_id, arr);
  }

  let added = 0;
  let updated = 0;
  for (const v of vendors ?? []) {
    const email = v.email?.toLowerCase().trim();
    if (!email) continue;

    const langPairs = pairsByVendor.get(v.id) ?? [];
    const meta = {
      source: "portal",
      portal_vendor_id: v.id,
      vendor_type: v.vendor_type ?? null,
      country: v.country ?? null,
      native_languages: v.native_languages ?? [],
      language_pairs: langPairs,
    };

    // Look for existing profile by vendor_user_id (synced previously) or by email.
    const { data: byVendorId } = await local.from("profiles").select("id, email")
      .eq("vendor_user_id", v.id).maybeSingle();
    let profileId = byVendorId?.id ?? null;

    if (!profileId) {
      const { data: byEmail } = await local.from("profiles").select("id, email")
        .eq("email", email).maybeSingle();
      if (byEmail) profileId = byEmail.id;
    }

    if (profileId) {
      const { error: updErr } = await local.from("profiles").update({
        full_name: v.full_name ?? null,
        vendor_user_id: v.id,
        meta,
        portal_synced_at: new Date().toISOString(),
      }).eq("id", profileId);
      if (updErr) { errors.push(`update ${email}: ${updErr.message}`); continue; }
      updated++;
      continue;
    }

    // Create a new auth.users + profiles row for this portal vendor.
    // Random password — they'll authenticate via vendor portal SSO, never use it.
    const tmpPassword = `Sso!${crypto.randomUUID()}`;
    const { data: created, error: createErr } = await local.auth.admin.createUser({
      email,
      password: tmpPassword,
      email_confirm: true,
      user_metadata: { full_name: v.full_name, role: "translator" },
      app_metadata: { role: "translator", auth_source: "vendor_portal_sso" },
    });
    if (createErr || !created.user) {
      errors.push(`auth.createUser ${email}: ${createErr?.message ?? "unknown"}`);
      continue;
    }
    const { error: insErr } = await local.from("profiles").insert({
      id: created.user.id,
      email,
      full_name: v.full_name ?? null,
      role: "translator",
      status: "active",
      auth_source: "vendor_portal_sso",
      vendor_user_id: v.id,
      mfa_required: false,
      meta,
      portal_synced_at: new Date().toISOString(),
    });
    if (insErr) { errors.push(`profile insert ${email}: ${insErr.message}`); continue; }
    added++;
  }

  return { added, updated, errors };
}

/**
 * High-level orchestrator used by the admin sync action.
 */
export async function syncFromPortal(opts: { triggeredBy: string; kind: "clients" | "vendors" | "all" }): Promise<SyncResult> {
  const local = await getServiceClient();
  const { data: run } = await local.from("portal_sync_runs").insert({
    triggered_by: opts.triggeredBy,
    kind: opts.kind,
    status: "running",
  }).select("id").single();

  const result: SyncResult = { clients_added: 0, clients_updated: 0, vendors_added: 0, vendors_updated: 0, errors: [] };

  try {
    if (opts.kind === "clients" || opts.kind === "all") {
      const c = await syncClients();
      result.clients_added = c.added;
      result.clients_updated = c.updated;
      result.errors.push(...c.errors);
    }
    if (opts.kind === "vendors" || opts.kind === "all") {
      const v = await syncVendors();
      result.vendors_added = v.added;
      result.vendors_updated = v.updated;
      result.errors.push(...v.errors);
    }

    if (run?.id) {
      await local.from("portal_sync_runs").update({
        status: result.errors.length === 0 ? "completed" : "completed",
        clients_added: result.clients_added,
        clients_updated: result.clients_updated,
        vendors_added: result.vendors_added,
        vendors_updated: result.vendors_updated,
        error: result.errors.length > 0 ? result.errors.join(" | ").slice(0, 1000) : null,
        finished_at: new Date().toISOString(),
      }).eq("id", run.id);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    result.errors.push(msg);
    if (run?.id) {
      await local.from("portal_sync_runs").update({
        status: "failed",
        error: msg,
        finished_at: new Date().toISOString(),
      }).eq("id", run.id);
    }
  }

  return result;
}
