-- One-shot signin tokens for vendor-portal test accounts.
-- The vendor-portal V3 invitation links the applicant straight to /t/<token>;
-- our route validates the token, sets the MFA-skipped cookie, generates a
-- Supabase magiclink for the bound user, and redirects to it. The magiclink
-- callback completes the auth handshake and lands the applicant directly on
-- their job editor — no password entry, no inbox-reachable OTP.
CREATE TABLE IF NOT EXISTS test_signin_tokens (
  token         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id        uuid REFERENCES jobs(id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_signin_tokens_user ON test_signin_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_test_signin_tokens_expires
  ON test_signin_tokens(expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE test_signin_tokens IS
  'Single-use magic-link tokens for vendor-portal test accounts. Validated by /t/[token]; bound to a profile + job. Replaces the email+password flow which would require an OTP that test-<hex>@cethos.test cannot receive.';
