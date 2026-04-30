-- Phase 1 of the auth migration: additive schema only.
-- These tables don't replace anything yet — they sit alongside the
-- existing Supabase auth.users / profiles / vendor_sessions until
-- Phase 2 starts the cutover.
--
-- Plan:
--   Phase 1 (this migration): create cethos_users, phone_otps,
--     cethos_sessions. Build the shared @cethos/auth lib. NO behavior
--     change anywhere.
--   Phase 2: TM-Cethos rewrites its auth surface to use the new lib.
--     Backfill existing auth.users + profiles into cethos_users.
--     Drop /forgot-password and /reset-password routes.
--   Phase 3: vendor + admin portals standardize on the same session
--     cookie (currently they DIY with their own token tables).
--   Phase 4: Twilio for phone OTP.
--   Phase 5: optional password as 2nd factor (mfa_required toggle).
--   Phase 6: cutover + decommission Supabase Auth.

CREATE TABLE IF NOT EXISTS cethos_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        citext UNIQUE NOT NULL,
  phone        text UNIQUE,
  full_name    text,
  role         text NOT NULL DEFAULT 'translator',
  password_hash    text,
  password_set_at  timestamptz,
  mfa_required     boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  last_signed_in_at timestamptz,
  legacy_supabase_user_id uuid,
  legacy_vendor_session_id uuid
);

CREATE INDEX IF NOT EXISTS cethos_users_email_idx ON cethos_users (email);
CREATE INDEX IF NOT EXISTS cethos_users_phone_idx ON cethos_users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS cethos_users_role_idx ON cethos_users (role);

-- Reuse the existing otp_purpose enum from email_otps. Add the new
-- purposes the @cethos/auth lib needs.
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'set_password';
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'step_up';

CREATE TABLE IF NOT EXISTS phone_otps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES cethos_users(id) ON DELETE CASCADE,
  phone        text NOT NULL,
  purpose      otp_purpose NOT NULL DEFAULT 'signin_mfa',
  code_hash    text NOT NULL,
  salt         text NOT NULL,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  attempts     smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL DEFAULT 5,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS phone_otps_phone_idx ON phone_otps (phone, expires_at DESC);
CREATE INDEX IF NOT EXISTS phone_otps_user_idx ON phone_otps (user_id);

CREATE TABLE IF NOT EXISTS cethos_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES cethos_users(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cethos_sessions_user_idx ON cethos_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS cethos_sessions_expires_idx ON cethos_sessions (expires_at) WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION cethos_users_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cethos_users_touch_updated_at ON cethos_users;
CREATE TRIGGER cethos_users_touch_updated_at
  BEFORE UPDATE ON cethos_users
  FOR EACH ROW EXECUTE FUNCTION cethos_users_touch_updated_at();
