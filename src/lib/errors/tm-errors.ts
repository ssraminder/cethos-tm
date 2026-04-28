/**
 * Central error capture helper. Writes to public.tm_errors so a stuck flow
 * (test-page integration with the vendor portal, in particular) is debuggable
 * from the admin dashboard.
 *
 * Non-throwing — errors here must not cascade into the caller. We log to
 * console.error if the DB write itself fails so failures aren't silent.
 */

import { getServiceClient } from "@/lib/supabase/server";

export type TmErrorSeverity = "warn" | "error" | "fatal";

export interface LogTmErrorInput {
  /** "/api/admin/test-jobs/create", "saveSegmentAction", etc. */
  route: string;
  /**
   * Specific operation within the route. Free-form but pick a stable
   * identifier so admin can group / filter (e.g. "auth_create_user",
   * "profile_insert", "create_job", "segment_save", "portal_webhook").
   */
  action: string;
  severity?: TmErrorSeverity;
  message: string;
  /** Free-form JSON. Don't include secrets (passwords, API keys). */
  context?: Record<string, unknown>;
  /** Vendor-portal cvp_test_submissions.id when known. */
  test_submission_id?: string | null;
  user_id?: string | null;
  job_id?: string | null;
  stack?: string | null;
}

const STACK_TRUNCATE = 8000;

export async function logTmError(input: LogTmErrorInput): Promise<void> {
  try {
    const supabase = await getServiceClient();
    const { error } = await supabase.from("tm_errors").insert({
      route: input.route,
      action: input.action,
      severity: input.severity ?? "error",
      message: input.message.slice(0, 4000),
      context: input.context ?? {},
      test_submission_id: input.test_submission_id ?? null,
      user_id: input.user_id ?? null,
      job_id: input.job_id ?? null,
      stack: input.stack ? input.stack.slice(0, STACK_TRUNCATE) : null,
    });
    if (error) {
      console.error(
        `[tm-errors] insert failed (route=${input.route} action=${input.action}): ${error.message}`,
      );
    }
  } catch (e) {
    // Logging must never throw into the caller.
    console.error(
      `[tm-errors] logger crashed (route=${input.route} action=${input.action}):`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Convenience: wrap an async block. If it throws, log to tm_errors and
 * re-throw so the caller still handles it (or returns the error response).
 */
export async function captureTmErrors<T>(
  meta: Omit<LogTmErrorInput, "message" | "stack">,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    await logTmError({
      ...meta,
      message: err.message,
      stack: err.stack ?? null,
    });
    throw err;
  }
}
