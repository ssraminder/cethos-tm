# Cethos CAT

CAT (computer-assisted translation) editor — a translator workbench in the style of XTM Cloud, Trados Online, or Google Polyglot. Operates alongside the existing Cethos TMS and vendor portal.

## Architecture

- **Auth**: Supabase Auth for password verification + custom email OTP (Mailgun) as the second factor. Translators arriving from the vendor portal use SSO via signed JWT.
- **Jobs**: Pulled into Cethos CAT — source files copied, segmented, and stored locally with TM/TB leverage applied.
- **Job creation**: Both pushed (TMS API) and direct (PM upload UI).
- **Roles**: admin, pm, translator, reviewer.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth + Storage)
- Mailgun (transactional email)
- jose (SSO / MFA cookies)

## Setup

```bash
npm install
cp .env.example .env.local       # already populated; fill MAILGUN_* and SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

## Database

Schema is managed via Supabase migrations against project `idzwtssftpxrsprzjael` (cethos-tms, ca-central-1):

- `0001_extensions_and_enums` — required extensions and enum types
- `0002_users_sessions_otps` — profiles, OTPs, sessions, invitations, audit log
- `0003_linguistic_resources` — TMs, termbases, QA profiles, jobs, segments

## Routes

- `/sign-in`, `/verify`, `/forgot-password`, `/reset-password`, `/invite/[token]` — auth flows
- `/sso?token=…&job=…` — vendor portal SSO handoff
- `/admin/*` — TM, termbase, QA, languages, users, integrations, audit, settings
- `/pm/*` — jobs, translators, concordance, reports
- `/translator` — inbox; `/translator/editor/[jobId]` — segment editor
