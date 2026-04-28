# Cethos CAT — Admin Training Guide

This guide walks every admin-facing screen in Cethos CAT, with a screenshot
of each panel and the key actions you can take. Read it top-to-bottom on your
first day; use it as a reference afterwards.

> **Audience:** users with the `admin` role. PM and translator views are similar
> in shell but expose narrower navigation — see the role-specific guides for those.

> **Convention:** screenshots in this doc come from a seeded demo workspace
> (Acme client, English→French language pair). Your data will look different;
> the layout will not.

## Contents

1. [Signing in](#1-signing-in)
2. [The admin shell](#2-the-admin-shell)
3. [Dashboard](#3-dashboard)
4. [Projects](#4-projects)
5. [Translation Memory](#5-translation-memory)
6. [Termbases](#6-termbases)
7. [QA Profiles](#7-qa-profiles)
8. [Languages](#8-languages)
9. [MT Engines](#9-mt-engines)
10. [Users](#10-users)
11. [Integrations](#11-integrations)
12. [API Keys (TMS push)](#12-api-keys-tms-push)
13. [Audit Log](#13-audit-log)
14. [Settings](#14-settings)
15. [Common workflows](#15-common-workflows)

---

## 1. Signing in

Open `https://tm.cethos.com/sign-in` (or `http://localhost:3000/sign-in`
in dev).

![Sign-in page](/training/admin/01-sign-in.png)

1. Enter your **email**.
2. We email a 6-digit verification code (OTP) to your inbox via Mailgun.
   The default sender domain is `reply.cethos.com`.
3. On the next screen, type the code. It expires in 10 minutes.

   ![OTP verify page](/training/admin/01b-verify.png)

4. You'll land on the admin dashboard.

There is no password to remember — every sign-in is OTP-only. If your
inbox isn't receiving the OTP, check spam first, then issue a known OTP
(see below).

> Translators usually arrive via a job link from the vendor portal; that
> flow uses the same OTP mechanism but auto-submits the code embedded in
> the link.

### Stuck without an inbox? Use a known OTP

If your email domain isn't yet wired to receive Mailgun mail (e.g.,
`@cethos.com` while the MX records are still propagating), you can issue a
fixed-value OTP from the server side:

```bash
# After clicking Sign in and landing on /verify, run:
node scripts/issue-test-otp.cjs raminder@cethos.com 111111
```

The script invalidates whatever OTP the password step issued and inserts a
new one with the plaintext code you specify (10-min expiry). Type the same
code on `/verify` and you're in.

> Order matters: the `signInAction` invalidates any pending OTP and issues a
> new one when you submit the password. So **press Sign in first**, then run
> the script to overwrite the OTP with a value you know.

---

## 2. The admin shell

Once signed in, every admin page shares the same layout:

- **Left sidebar** — section nav, current section highlighted. Your name and
  role at the bottom; the icon on the right is **Sign out**.
- **Top bar** — breadcrumb, `⌘K` global search hint.
- **Main panel** — the screen-specific content.

Resize the window: the sidebar collapses on tablet widths, the main panel
reflows.

---

## 3. Dashboard

`/admin`

![Admin dashboard](/training/admin/02-admin-dashboard.png)

Four KPI tiles across the top — active jobs, TM units, termbase entries, and
average TM leverage. They populate as you import TMs/TBs and run jobs through
the editor.

Below, three panels:
- **Leverage trend** — once jobs run, you'll see a 30-day stacked area chart
  by match band (100% / 95–99% / 75–94% / no match).
- **QA issues by severity** — donut split of critical / major / minor open
  findings.
- **Recent activity** — a stream of audit events.

The dashboard is read-only; everything you act on lives in a dedicated
section.

---

## 4. Translation Memory

`/admin/tm` — **List**

![TM list](/training/admin/03-tm-list.png)

Each row is a TM with its language pair, scope (global / client / project / job),
unit count, and creation date. **Open →** drills in.

Two top-right actions:
- **Create TM** — opens a form to mint a new TM
- **Import TMX** is only available inside a TM detail page (you must create
  the TM first, then import into it)

### Creating a TM

`/admin/tm/new`

![TM create](/training/admin/04-tm-create.png)

- **Name** is free-form. Convention: `Client + Domain + Pair` (e.g.,
  `Acme Marketing EN→FR`).
- **Source / Target language** — pick BCP-47 codes from the enabled list.
- **Scope** — `Global` is shared across all clients; `Client` ties it to a
  specific account; `Project` and `Job` are tighter scopes used when a
  one-off project gets its own TM.
- **Client** — only meaningful when scope = `client`/`project`/`job`.

Click **Create TM** and you'll land on the detail page.

### TM detail

`/admin/tm/[id]`

![TM detail](/training/admin/05-tm-detail.png)

KPI strip across the top, then a two-column layout:

**Left — Units browser**
- Search box hits both source and target text (case-insensitive substring).
- The unit table shows source + target side-by-side.

**Right rail — Import + history**
- **Import TMX** — accepts TMX 1.4 files up to 100 MB. We deduplicate on
  `(tm_id, source_hash, target_text)`, so re-importing the same TMX is safe.
- **Recent imports** — last 10 imports with status (completed / failed /
  processing), unit counts, and any error message.

Behind the scenes: when you import, segments' `source_hash` is computed by a
DB trigger that normalizes the text (NFC + collapse whitespace + lowercase).
That's why the editor's "TM 100%" match is case-insensitive by design — a
unit imported as "Hello, world." will exact-match a job segment "HELLO, WORLD."

---

## 5. Termbases

A **termbase** is a concept-based glossary. Each concept can have multiple
language entries; each entry has a **status** of `approved`, `pending`, or
`forbidden`.

`/admin/termbases` — **List**

![Termbase list](/training/admin/06-termbase-list.png)

Columns: name, languages covered, scope, concept count.

### Creating a termbase

`/admin/termbases/new`

![Termbase create](/training/admin/07-termbase-create.png)

- **Languages** — comma- or space-separated BCP-47 codes (e.g., `en-US, fr-FR, es-ES`).
  Add languages later by importing a TBX that includes them; we merge new
  languages into the termbase automatically.
- **Scope / Client** — same semantics as TM.

### Termbase detail

`/admin/termbases/[id]`

![Termbase detail](/training/admin/08-termbase-detail.png)

**Left — concepts grouped**
Each block is one **concept** (the meaning), with one or more terms below it
in different languages. Status pills:
- **Approved** (emerald) — preferred wording
- **Pending** (amber) — under review
- **Forbidden** (rose, struck-through) — never use; flagged in QA

The search box matches against term text in any language.

**Right rail — Import TBX**
- TBX 2.0 / TBX-Basic / TBX 3.0 supported.
- Status mapping: `<admin type="termType">deprecated/forbidden</admin>` →
  `forbidden`; `preferred/approved/standard` → `approved`.

Termbases are how the editor highlights source words and how the
`forbidden_term` QA rule fires.

---

## 6. QA Profiles

`/admin/qa`

![QA profiles](/training/admin/09-qa-profiles.png)

A QA profile is a JSON-configured rule set. The default profile is auto-seeded
with eight rules:

| Rule | Default severity | What it catches |
|------|------------------|-----------------|
| `untranslated` | critical | Confirmed segment with empty target |
| `identical_source_target` | major | Target equals source |
| `number_mismatch` | major | Numeric tokens differ between source and target |
| `length_ratio` | minor | Target/source length outside `[0.5, 2.5]` |
| `leading_trailing_whitespace` | minor | Source has leading/trailing space, target doesn't (or vice versa) |
| `double_space` | minor | Target contains `  ` (two spaces) |
| `forbidden_term` | major | Forbidden termbase term appears in target |
| `tag_mismatch` | critical | XLIFF inline-tag placeholders `{N}` in source not preserved in target |

A job runs against its assigned profile (or the default if none assigned)
when someone clicks **Run QA** on the PM job page or in the editor.

The detailed editor for profiles (toggling rules, custom regex) is on the
roadmap; for now, edit profiles via SQL:
```sql
update public.qa_profiles
set rules = '[ ... ]'::jsonb
where id = '...';
```

### Deliver pipeline (deterministic + Opus QA)

Beyond manual `Run QA`, every production job runs through a two-phase
pipeline when the translator clicks **Deliver**:

1. **Phase 1 — Deterministic** — runs the QA profile above, in-process,
   instantly. Findings stored with `source = 'deterministic'`. If any
   critical finding is produced, Phase 2 is skipped.
2. **Phase 2 — Opus QA** — Claude Opus reviews every confirmed segment
   in cached batches of 50. Adds findings with `source = 'opus'`,
   `category` (accuracy / terminology / fluency / grammar / register /
   punctuation / locale / style), and an optional `suggested_target`.

A `qa_runs` row tracks per-Deliver telemetry (model, input/cached/output
tokens, cost_usd, status). Default cost cap: $5/job.

**Job class** (`jobs.job_class`):
- `production` — full pipeline (default)
- `test` — set automatically on jobs created via
  `/api/admin/test-jobs/create` for recruitment. **Skips QA entirely** —
  Deliver short-circuits to status `submitted` and the recruitment
  grader takes over.

**Killswitch:** env var `QA_ENABLED=false` suppresses the Opus phase
platform-wide without disabling Deliver. Deterministic still runs.

**Required env vars for Opus QA:**
- `ANTHROPIC_API_KEY` — your Anthropic API key
- `QA_ENABLED` — optional, defaults to `true`

If `ANTHROPIC_API_KEY` is missing, Phase 2 is skipped with a
`skipped_reason` and Deliver still completes (deterministic only). Set
the key in Vercel and redeploy.

**Per-target-language punctuation rules** are baked into the cached
Opus system prompt: CJK full-width (`。！？，：；`), French NBSP before
`: ; ? !`, Spanish opening `¡`/`¿`, Thai/Lao no terminal period, Arabic
`، ؛ ؟`, Greek `;` for question, etc. Opus evaluates target punctuation
against the **target** language's conventions, not the source's.

---

## 7. Languages

`/admin/languages`

![Languages](/training/admin/10-languages.png)

Read-only inventory of BCP-47 language codes available in the picker
throughout the app. RTL languages are flagged so the editor can flip the
target column.

To add a new language, run:
```sql
insert into public.languages (code, name, native_name, rtl, enabled)
values ('hi-IN', 'Hindi', 'हिन्दी', false, true);
```

---

## 8. MT Engines

`/admin/mt`

![MT engines](/training/admin/11-mt-engines.png)

Machine translation engines power the editor's **Get MT** button. Selection
order at runtime:

1. Per-job override (if `jobs.meta.mt_engine` is set)
2. `MT_DEFAULT_ENGINE` env var
3. First provider whose API key is present (`DEEPL_API_KEY`, then
   `GOOGLE_TRANSLATE_API_KEY`)
4. Mock engine — returns `[MT-mock src→tgt] <source>`, clearly labelled

Configure engines via Vercel environment variables:

| Engine | Env var(s) |
|--------|-----------|
| DeepL Free / Pro | `DEEPL_API_KEY` (free keys end in `:fx`) |
| Google Cloud Translation | `GOOGLE_TRANSLATE_API_KEY` |

---

## 9. Users

`/admin/users`

![Users](/training/admin/12-users.png)

Lists every direct-login user in Cethos CAT — admins, PMs, and translators
who don't come through vendor-portal SSO.

Columns:
- **Email**
- **Name**
- **Role** — `admin`, `pm`, `translator`, `reviewer`
- **Auth source** — `email` (password + OTP) or `vendor portal sso`
- **Status** — `active`, `pending`, `suspended`

The **Invite user** button (top right) is wired in the schema (`invitations`
table + `/invite/[token]` flow) but not yet wired to a UI form. To invite via
SQL until the UI ships:

```sql
-- Mint an invitation token
insert into public.invitations (email, role, invited_by, token_hash, expires_at)
values (
  'newperson@example.com',
  'pm',
  (select id from public.profiles where email = 'raminder@cethos.com'),
  encode(extensions.digest('YOUR_RAW_TOKEN', 'sha256'), 'hex'),
  now() + interval '72 hours'
);
-- Send the recipient: /invite/YOUR_RAW_TOKEN
```

---

## 10. Integrations

`/admin/integrations`

![Integrations](/training/admin/13-integrations.png)

Hub for the four integration surfaces:

- **Vendor Portal SSO** — JWKS-based JWT verification of translator handoff.
  Configured via env: `VENDOR_PORTAL_JWT_ISSUER`, `VENDOR_PORTAL_JWT_AUDIENCE`,
  `VENDOR_PORTAL_JWKS_URL`.
- **TMS Job Push API** — clickable, opens the API-key manager (next section).
- **MT Engines** — env-var configured, see section 8.
- **Outbound webhooks** — schema is ready; UI not yet wired.

---

## 11. API Keys (TMS push)

`/admin/integrations/api-keys`

![API keys](/training/admin/14-api-keys.png)

Mint Bearer tokens for the **`POST /api/jobs/ingest`** endpoint. This is how
your existing TMS pushes new translation jobs into Cethos CAT.

### Mint a key

1. Pick a **name** (visible in audit log; e.g., "Acme TMS Integration").
2. Choose a **scope**:
   - `tms_ingest` — allows job ingest
   - `webhook_callback` — reserved for future outbound webhooks
3. Click **Mint key**. The plaintext value appears once in a green banner —
   **copy it now**, we never store or show it again. Only the SHA-256 hash
   stays in the DB.

### Use the key

```bash
curl -X POST https://your-cethos-cat.example.com/api/jobs/ingest \
  -H "Authorization: Bearer cethos_tms_…" \
  -H "Content-Type: application/json" \
  -d '{
    "source_filename": "marketing-q2.docx",
    "source_b64": "<base64 of the file>",
    "source_lang": "en-US",
    "target_lang": "fr-FR",
    "external_ref": "TMS-12345",
    "client_external_ref": "ACME",
    "assigned_to_email": "translator@example.com",
    "deadline": "2026-05-01T17:00:00Z",
    "tm_ids": ["..."],
    "termbase_ids": ["..."]
  }'
```

Response (201):
```json
{
  "job_id": "uuid",
  "reference": "J-202604-A1B2",
  "segments": 47,
  "words": 1284,
  "source_format": "docx"
}
```

### Revoke

The **Revoke** link on a row sets `revoked_at` immediately. Subsequent calls
with that key get 401.

---

## 12. Audit Log

`/admin/audit`

![Audit log](/training/admin/15-audit-log.png)

Every meaningful action — auth, user, TM, termbase, QA, job, settings, and
integration events — is recorded with:

- Timestamp (ISO, second precision)
- Actor (email)
- Category (`auth`, `user`, `tm`, `termbase`, `qa`, `job`, `settings`,
  `integration`)
- Action (`sign_in_completed`, `tm_unit_create`, `tmx_imported`,
  `job_assigned`, `api_key_minted`, …)
- Target (resource id when relevant)
- Source IP
- Optional metadata payload (visible by querying the table)

The page shows the most recent 200 events. Filter UI is on the roadmap; for
now use SQL:

```sql
select * from public.audit_log
where category = 'job' and created_at >= now() - interval '7 days'
order by created_at desc;
```

---

## 13. Settings

`/admin/settings`

![Settings](/training/admin/16-settings.png)

Currently a placeholder. Mailgun, vendor-portal SSO, and password policy are
all configured via Vercel environment variables today; a UI will land in a
later release.

Reference of env vars the runtime expects:

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-side client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations (bypasses RLS) |
| `APP_SECRET` | HMAC pepper for OTP hashes + MFA cookie signing (≥32 chars) |
| `APP_BASE_URL` | Production base URL (used in password-reset link) |
| `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` / `MAILGUN_REGION` / `MAILGUN_FROM_EMAIL` | Transactional email |
| `VENDOR_PORTAL_JWT_ISSUER` / `VENDOR_PORTAL_JWT_AUDIENCE` / `VENDOR_PORTAL_JWKS_URL` | SSO from vendor portal |
| `DEEPL_API_KEY` / `GOOGLE_TRANSLATE_API_KEY` | Optional MT providers |
| `MT_DEFAULT_ENGINE` | `deepl` / `google` / `mock` |

---

## 14. Common workflows

### A. Onboard a new client

1. Add the client to Postgres directly (UI form is on the roadmap):
   ```sql
   insert into public.clients (name, slug, external_ref, active)
   values ('Globex', 'globex', 'GLBX-001', true);
   ```
2. Create one TM per language pair the client needs, scope = `client`,
   client = the new row's id.
3. Create a termbase that includes those languages, scope = `client`.
4. (If they have an existing TMS pushing jobs in) Mint an API key named after
   the client and share with their integration team.

### B. Import a translator's existing assets

1. Get a TMX export of their old TM and a TBX export of their glossary.
2. Create a TM, click **Import TMX**, upload. Wait for status `completed`.
3. Create a termbase, click **Import TBX**, upload.
4. Spot-check the units browser — anything weird (duplicate sources with
   different targets, suspect terminology) is fixable inline by the
   linguistic team.

### C. Investigate a translation that went wrong

1. Find the job by `reference` in `/pm/jobs` (or by `external_ref` if pushed
   from your TMS).
2. Open the job page, then open the editor — every segment shows the
   translator's edits.
3. `/admin/audit` filtered by `target_id = '<job-id>'` shows the full timeline
   of who did what.
4. If a forbidden term slipped through, **Run QA** from the job page should
   flag it. If it doesn't, check the termbase has the right entry status.

### D. Rotate an API key

1. Mint a new key with the same name + scope.
2. Update the consuming TMS with the new plaintext value.
3. Revoke the old key once the new one is confirmed working.
4. Verify in `/admin/audit` that the old key shows no requests after the
   cutover and that new requests are using the new key (its `last_used_at`
   updates).

---

## Need help?

- Schema reference: see `supabase/migrations/` in the repo
- API docs: this guide section 11 covers `/api/jobs/ingest`; outbound webhooks
  TBA
- Issues: open a ticket on the `cethos-tm` GitHub repo
