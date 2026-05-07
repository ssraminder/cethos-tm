-- Phase 2: backfill cethos_users from auth.users + profiles.
-- Idempotent via ON CONFLICT (email) DO NOTHING.
-- Passwords are intentionally NOT migrated — everyone re-authenticates via OTP.
-- Run once during Phase 2 cutover review; apply with: supabase db push
INSERT INTO public.cethos_users (
  id,
  email,
  full_name,
  role,
  is_active,
  legacy_supabase_user_id,
  created_at
)
SELECT
  au.id,
  au.email,
  p.full_name,
  COALESCE(p.role, 'translator'),
  true,
  au.id,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
ON CONFLICT (email) DO NOTHING;
