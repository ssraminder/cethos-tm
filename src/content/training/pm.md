# Cethos CAT — Project Manager Training Guide

You're the air-traffic controller. Translators do the linguistic work; you
keep jobs flowing, watch deadlines, and step in when QA finds something.

> **Audience:** users with the `pm` role. Admins also see PM pages and can
> do everything in this guide.

## Contents

1. [Signing in](#signing-in)
2. [The PM shell](#the-pm-shell)
3. [Dashboard](#dashboard)
4. [Jobs list](#jobs-list)
5. [Job detail — the workhorse page](#job-detail--the-workhorse-page)
6. [Creating a job manually](#creating-a-job-manually)
7. [Translators](#translators)
8. [Concordance](#concordance)
9. [Reports](#reports)
10. [Common workflows](#common-workflows)

---

## Signing in

Same flow as everyone else: email + password at `/sign-in`, then a 6-digit
OTP at `/verify`. The OTP arrives via Mailgun within a few seconds. After
verifying, you land on the PM dashboard.

If your email domain isn't yet receiving Mailgun mail, an admin can issue
you a known OTP via `node scripts/issue-test-otp.cjs <your-email> 111111`
(see the admin guide).

---

## The PM shell

Six sidebar items: **Dashboard**, **Jobs**, **Create job**, **Translators**,
**Concordance**, **Reports**. The shell is identical to admin's — same top
bar, breadcrumb, sign-out button at the bottom of the sidebar.

---

## Dashboard

`/pm`

![PM dashboard](/training/pm/01-pm-dashboard.png)

Four KPIs across the top:

- **Active jobs** — anything not in `closed` or `cancelled`
- **Awaiting QA** — jobs where the translator has submitted but no review run yet
- **Overdue** — past `deadline` and not yet submitted (rose-colored when nonzero)
- **Avg leverage** — TM-100% match rate across active jobs

Two panels below:
- **Job pipeline** — funnel of received → in progress → QA → submitted
- **QA issues by job** — top 5 jobs with the most open critical/major findings

KPIs and panels populate as jobs flow through the editor. On a fresh install
you'll see em-dashes (`—`) until the first job moves.

---

## Jobs list

`/pm/jobs`

![Jobs list](/training/pm/02-jobs-list.png)

Every job in your tenancy. Columns:

- **Reference** — human-readable id (e.g., `J-202604-A1B2` for auto, or
  `DEMO-Q2-MKT` if a custom reference was supplied)
- **Source** — where it came from: `manual` (PM upload) or `tms_push` (came
  through `POST /api/jobs/ingest`)
- **Pair** — `en-US → fr-FR` style
- **Words** — total billable
- **Status** — `draft`, `assigned`, `in_progress`, `review`, `submitted`,
  `closed`, `cancelled`
- **Deadline** — local timestamp, sorted ascending so urgent items rise

Click any row's reference (or open the job detail directly) to drill in.

The **Create job** button top-right opens the manual upload wizard.

---

## Job detail — the workhorse page

`/pm/jobs/[id]`

![Job detail](/training/pm/03-job-detail.png)

This is where you spend most of your time. Six sections:

### Header
Reference + language pair + word/segment count. Three buttons:
- **Open editor (read-only)** — view what the translator sees, can't edit
- **Download XLIFF** — bilingual export with inline tags preserved
- **Download TXT** — plain target text, one line per segment

A green "Live" dot indicates real-time updates: when the translator confirms
a segment, the KPI tiles tick within ~250 ms.

### KPI strip
Five tiles:
- **Status** — current job state
- **Untranslated** — open segments
- **Translated** — confirmed (translator-side) + reviewed (reviewer-side)
- **QA critical** — open critical findings (subtitle shows major/minor)
- **Run QA** — orange button that re-runs the active QA profile against
  the job's segments

### Assignment
Current assignee (avatar + email) + a dropdown to reassign. Reassigning
preserves segment edits — only the `assigned_to` foreign key changes.

### Source file
Filename, format, and storage path. Read-only on the detail page; if you
need to replace the source, cancel the job and create a new one.

### Translation memories
List of attached TMs with priority (lower number = higher priority). Below,
a dropdown of compatible TMs (matching language pair) you can attach.
Detach with the rose **Detach** link on the right.

> Why priority matters: when two TMs have a 100% match for the same source,
> the editor shows the higher-priority TM's target first.

### Termbases
Same UX as TMs. Termbases are filtered to those whose language list
includes both the source and target.

---

## Creating a job manually

`/pm/jobs/new`

![Create job](/training/pm/04-create-job.png)

Use this when you have a source file in hand and need to set a translator
loose on it (test runs, one-off urgents, anything outside the TMS push API).

Fields:

- **Source file** — `.txt`, `.md`, `.html`, `.docx`, `.json`, `.xliff`/`.xlf`.
  Max 50 MB. XLIFF files are special: source/target languages auto-detect
  from the file's `xml:lang` attributes; pre-existing target text is loaded
  with status `draft` (or `translated` if the XLIFF marked it final).
- **Source / target language** — BCP-47 dropdowns
- **Reference (optional)** — human label; auto-generates `J-YYYYMM-XXXX`
  if blank
- **Deadline (optional)** — datetime; surfaces in dashboard "Overdue" tile
- **Assign to translator (optional)** — leave blank to save as a draft and
  assign later from the job detail page

Click **Create job & segment**. We:
1. Upload the source to `cat-source-files` storage bucket
2. Extract text (mammoth for `.docx`, regex strip for `.html`, native for
   plain text)
3. Run the SBD-based segmenter (sentence-aware, abbreviation-safe)
4. Insert all segments
5. Redirect you to the job detail page

For XLIFF, we skip step 3 and use `<trans-unit>` boundaries directly.
Inline tags are converted to `{1}` `{2}` placeholders that the translator
must preserve in the target — the QA `tag_mismatch` rule flags any drift.

---

## Translators

`/pm/translators`

![Translators](/training/pm/05-translators.png)

Roster of available linguists. (UI to come.) For now the page is a placeholder;
translators are listed in `/admin/users` filtered by role. To assign a job to
a translator, use the dropdown on the **Job detail** page.

Vendor-portal translators (those who arrive via SSO) can also be assigned —
they show up here once they've signed in at least once.

---

## Concordance

`/pm/concordance`

![Concordance](/training/pm/06-concordance.png)

Cross-TM phrase search. Type any phrase in the source language; we run
trigram similarity across every TM you have read access to and surface the
closest source/target pairs. Useful for:

- Finding how an unfamiliar idiom was translated previously
- Sanity-checking a translator's choice against client-approved past wording
- Building a one-off glossary by harvesting consistent translations

The page surface is read-only; the same SQL function (`tm_concordance`) is
exposed inside the editor's right rail when a translator clicks "Find TM
matches".

---

## Reports

`/pm/reports`

![Reports](/training/pm/07-reports.png)

Roadmap: TM leverage trend, QA score distribution, throughput per
translator, top forbidden terms triggered, average time-per-segment by
language pair. UI placeholder for now; charts wire up once jobs flow
through the editor.

---

## Common workflows

### A. New job from a vendor-supplied DOCX

1. **Create job** → upload the DOCX → pick language pair → assign translator
2. The translator gets it in their `/translator` inbox immediately
3. While they work, the **Live** indicator on the job detail page ticks as
   they confirm segments
4. When they finish, **Run QA** from the job page — review any critical
   findings before closing

### B. Reassign a job mid-stream

1. Open the job detail page
2. Pick a new translator from the **Assignment** dropdown → **Update**
3. Their existing edits stay; only the `assigned_to` flips
4. The previous translator loses edit access immediately (RLS enforced); the
   new translator gets it in their inbox

### C. Triage a QA failure

1. From the job KPI strip, click **Run QA**
2. Note the QA critical count
3. Open the editor in read-only mode (header button)
4. Critical findings render as rose pills under each segment's target box
5. If the translator needs to fix something, add a comment via the editor's
   right-rail Comments tab (UI roadmap)

### D. Export for a client who wants XLIFF back

1. Job detail → **Download XLIFF**
2. The output is XLIFF 1.2 with original inline tags re-injected (XLIFF
   ingest preserves the tag inventory in `segments.meta.tags`)
3. Round-trip safe: importing this XLIFF back into Cethos CAT produces
   identical segments

---

## See also

- **Admin guide** for client setup, TM/termbase administration, user invites
- **Translator guide** for the editor's keyboard shortcuts and TM panel
