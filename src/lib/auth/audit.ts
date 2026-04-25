import { getServiceClient } from "../supabase/server";

export type AuditCategory = "auth" | "user" | "tm" | "termbase" | "qa" | "job" | "settings" | "integration";

export interface AuditEvent {
  actorId?: string | null;
  actorEmail?: string | null;
  category: AuditCategory;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}

export async function audit(ev: AuditEvent): Promise<void> {
  try {
    const supabase = await getServiceClient();
    await supabase.from("audit_log").insert({
      actor_id: ev.actorId ?? null,
      actor_email: ev.actorEmail ?? null,
      category: ev.category,
      action: ev.action,
      target_type: ev.targetType ?? null,
      target_id: ev.targetId ?? null,
      ip_address: ev.ip ?? null,
      user_agent: ev.userAgent ?? null,
      meta: ev.meta ?? {},
    });
  } catch (e) {
    console.error("[audit] failed to write event", e);
  }
}
