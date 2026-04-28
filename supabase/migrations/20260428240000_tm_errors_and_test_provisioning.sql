-- ============================================================================
-- TM error log + test-provisioning records + api_key_scope enum bump
-- ============================================================================
--
-- Enum bump: the ApiKeyScope union in src/lib/api-keys.ts gained
-- "test_provisioning". The Postgres enum needs the matching value before
-- new rows can be inserted.
ALTER TYPE api_key_scope ADD VALUE IF NOT EXISTS 'test_provisioning';

-- ============================================================================
--
-- Two tables for the test-page integration with the vendor portal:
--
-- 1. tm_errors — central error capture so a stuck applicant flow is
--    debuggable. Server actions and API routes that touch the test path
--    write here on failure. Admin browses recent rows from /admin/errors.
--
-- 2. test_provisioning_records — anchors an applicant test attempt to its
--    disposable TM account + job. Lets the test-jobs create endpoint be
--    idempotent on retries; lets staff reset / clean up a stuck flow by
--    finding the row by test_submission_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tm_errors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  -- "/api/admin/test-jobs/create", "saveSegmentAction", etc.
  route           text NOT NULL,
  -- Specific operation within the route. e.g. "auth_create_user",
  -- "profile_insert", "create_job", "segment_save", "portal_webhook".
  action          text NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('warn','error','fatal')),
  message         text NOT NULL,
  -- Free-form JSON for whatever context the caller had: ids, language pair,
  -- API key id, user id, etc. Don't put secrets here.
  context         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Optional FK-by-text — we don't enforce it because the test_submission
  -- row lives in a different Supabase project (vendor portal).
  test_submission_id uuid,
  user_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  job_id          uuid REFERENCES jobs(id) ON DELETE SET NULL,
  -- Stack trace if available. Truncated to keep table light.
  stack           text
);

CREATE INDEX IF NOT EXISTS idx_tm_errors_occurred_at ON tm_errors (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tm_errors_route_action ON tm_errors (route, action);
CREATE INDEX IF NOT EXISTS idx_tm_errors_test_submission ON tm_errors (test_submission_id) WHERE test_submission_id IS NOT NULL;

COMMENT ON TABLE tm_errors IS
  'Central error log for TM-Cethos. Server actions + API routes that touch the test-page integration with the vendor portal write here on failure.';


CREATE TABLE IF NOT EXISTS test_provisioning_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The vendor-portal cvp_test_submissions.id this record was provisioned for.
  -- Lives in the lmzoyezvsjgsxveoakdr Supabase project — no FK across projects.
  test_submission_id  uuid NOT NULL UNIQUE,
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  applicant_email     text NOT NULL,
  -- Plaintext password storage is acceptable here because:
  --   (a) accounts are disposable, scoped to a single 48h test
  --   (b) the V3 invitation email needs to include the password
  --   (c) the row is deleted (and auth user removed) after submission/expiry
  -- Rotate the entire row to invalidate.
  applicant_password  text NOT NULL,
  job_id              uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  job_reference       text NOT NULL,
  api_key_id          uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- When the applicant clicks "Submit final test", we flip this. Also flips
  -- on TTL expiry sweep. Disabled rows stop accepting writes from the editor.
  closed_at           timestamptz,
  closed_reason       text   -- 'submitted' | 'expired' | 'staff_revoked' | …
);

CREATE INDEX IF NOT EXISTS idx_test_provisioning_user ON test_provisioning_records (user_id);
CREATE INDEX IF NOT EXISTS idx_test_provisioning_job  ON test_provisioning_records (job_id);
CREATE INDEX IF NOT EXISTS idx_test_provisioning_open ON test_provisioning_records (created_at DESC) WHERE closed_at IS NULL;

COMMENT ON TABLE test_provisioning_records IS
  'One row per applicant test attempt that was provisioned via /api/admin/test-jobs/create. Anchors the disposable TM account + job to the portal-side cvp_test_submissions.id for idempotency, lookup, and cleanup.';
