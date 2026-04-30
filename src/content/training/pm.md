# Cethos CAT — Project Manager Training Guide

You're the air-traffic controller. Translators do the linguistic work; you
keep jobs flowing, watch deadlines, and step in when QA finds something.

> **Audience:** users with the `pm` role. Admins also see PM pages and can
> do everything in this guide.

## Contents

1. [Signing in](#signing-in)
2. [The PM shell](#the-pm-shell)
3. [Dashboard](#dashboard)
4. [Projects](#projects)
5. [Jobs list](#jobs-list)
6. [Job detail — the workhorse page](#job-detail--the-workhorse-page)
7. [Creating a job manually](#creating-a-job-manually)
8. [File formats and round-trip export](#file-formats-and-round-trip-export)
9. [QA and the Deliver pipeline](#qa-and-the-deliver-pipeline)
10. [Translators](#translators)
11. [Concordance](#concordance)
12. [Reports](#reports)
13. [Common workflows](#common-workflows)

---

## Signing in

![PM sign-in](/training/pm/00-sign-in.png)

Sign-in is OTP-only. Enter your email at `/sign-in`, we email a 6-digit
code via Mailgun, and you enter it at `/verify`. There is no password.
The OTP expires in 10 minutes. After verifying, you land on the PM
dashboard.

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

- **Active jobs** — anything in `draft`, `assigned`, `in_progress`,
  `review`, `qa_running`, or `qa_review`. Excludes `delivered`,
  `submitted`, `closed`, and `cancelled`.
- **Awaiting QA review** — jobs where the translator ran QA and is
  triaging findings (status = `qa_review`).
- **Overdue** — past `deadline` and still active.
- **Recent jobs** — the count rendered in the **Upcoming deadlines**
  panel below (top 8).

Two panels below the KPIs:

- **Job pipeline** — count by status across active jobs. Each row
  shows a status (draft, assigned, in_progress, review, qa_running,
  qa_review) with the count.
- **QA issues by job** — top 5 jobs with the most unresolved
  critical/major findings, ranked by a weighted score
  (`crit × 10 + maj`). Click a reference to jump to the job page.

A third panel **Upcoming deadlines** lists the next eight active jobs
in deadline order: reference, language pair, word count, status, and
deadline.

---

## Projects

`/pm/projects`

A project groups related jobs (e.g., one client initiative across multiple
language pairs). Two paths to a project on your dashboard:

1. An **admin assigned you explicitly** — you'll see it labelled "You" in the
   Assignment column.
2. The project has **no explicit PM assignment** — visible to all PMs by
   default, labelled "Open to all PMs".

![Projects list](/training/pm/08-projects-list.png)

### Project detail

`/pm/projects/[id]`

![Project detail](/training/pm/09-projects-detail.png)

You can edit project metadata (name, reference, status, client, deadline,
description) and manage the **vendor pool** (the pre-approved set of
translators/reviewers who can be assigned to jobs in this project).

> **PM rosters are admin-only.** If a project shouldn't be visible to a
> particular PM, ask an admin to add explicit assignments — once any PM is
> assigned, the project switches from "open to all" to "explicit-list-only".

The **`+ New job in this project`** button opens the create-job page with
this project pre-selected and the translator dropdown narrowed to the
vendor pool (if defined).

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
- **Status** — `draft`, `assigned`, `in_progress`, `qa_running`,
  `qa_review`, `delivered`, `submitted` (test jobs only), `closed`,
  `cancelled`
- **Class** — `production` (default — runs full QA on Deliver) or
  `test` (recruitment / smoke; skips QA)
- **Deadline** — local timestamp, sorted ascending so urgent items rise

Click any row's reference (or open the job detail directly) to drill in.

The **Create job** button top-right opens the manual upload wizard.

---

## Job detail — the workhorse page

`/pm/jobs/[id]`

![Job detail](/training/pm/03-job-detail.png)

This is where you spend most of your time. Six sections:

### Header
Reference + language pair + word/segment count. Action buttons (which
appear depends on the source file format):

- **Open editor (read-only)** — view what the translator sees, can't edit
- **Download XLIFF** — bilingual export with inline tags preserved
- **Download TXT** — plain target text, one line per segment
- **Download Word** — round-trip back to `.docx` when the source was
  Word. Bold/italic, hyperlinks, headings, lists, tables, footnotes,
  bookmarks, fields, and drawings all survive.
- **Download Excel** — round-trip to `.xlsx` when the source was
  Excel. Rich-text runs and multi-sheet structure preserved.
- **Download PowerPoint** — round-trip to `.pptx` for slide decks
  (slides + speaker notes).
- **Download JSON** — round-trip to `.json` for i18n string files.
  Keys, structure, and non-string values (numbers/booleans) preserved.

A green "Live" dot indicates real-time updates: when the translator
confirms a segment, the KPI tiles tick within ~250 ms.

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
loose on it (one-off urgents, anything outside the TMS push API).

Fields:

- **Source file** — `.txt`, `.md`, `.html`, `.docx`, `.xlsx`, `.pptx`,
  `.json`, `.xliff`/`.xlf`. Max 50 MB.
- **Source / target language** — BCP-47 dropdowns
- **Reference (optional)** — human label; auto-generates `J-YYYYMM-XXXX`
  if blank
- **Deadline (optional)** — datetime; surfaces in dashboard "Overdue" tile
- **Assign to translator (optional)** — leave blank to save as a draft
  and assign later from the job detail page
- **Enable AI QA review** (checkbox, default ON) — when checked, the
  translator can run an Opus-powered QA pass before delivery (see
  [QA and the Deliver pipeline](#qa-and-the-deliver-pipeline)). Uncheck
  for jobs that should ship without AI review (e.g. internal drafts,
  jobs going through a separate review system).

Click **Create job & segment**. We:

1. Upload the source to `cat-source-files` storage bucket.
2. Extract text using a format-specific tag-preserving extractor:
   - **DOCX** → walks OOXML directly: each paragraph (incl. table
     cells, list items, headings) becomes one segment; bold, italic,
     hyperlinks, footnotes, bookmarks, fields, drawings all encoded as
     `{N}` placeholders the translator can see and preserve.
   - **XLSX** → walks `xl/sharedStrings.xml` and inline strings; each
     translatable cell becomes one segment; rich-text runs preserved.
   - **PPTX** → walks slides + notes; each `<a:p>` paragraph becomes
     one segment with inline-run formatting preserved.
   - **JSON** → walks the tree; each string-valued leaf becomes one
     segment with its JSON path stored for round-trip.
   - **HTML** → similar inline-tag preservation; one segment per block
     element.
   - **TXT/MD** → falls back to sentence-segmentation (SBD).
3. Insert all segments. Auto-attach the **Default TM** for this language
   pair so confirmed segments build the corpus.
4. Redirect you to the job detail page.

For XLIFF, we skip text extraction and use `<trans-unit>` boundaries
directly. Pre-existing target text is loaded as `draft` (or
`translated` if the XLIFF marked it final).

Inline formatting markers appear in the editor as `{1}`, `{2}` chips
the translator must preserve in their target. The deterministic
`tag_mismatch` QA rule flags any drift. A **Copy tags** button next to
each target makes preserving them one click.

---

## File formats and round-trip export

Cethos extracts translatable text *and* preserves the source document's
structure so you can ship the finished translation back in the
**same format**. Coverage:

| Format         | Extension     | Round-trip export                |
|----------------|---------------|----------------------------------|
| Word           | `.docx`       | **Download Word** — full fidelity (V3) |
| Excel          | `.xlsx`       | **Download Excel** — sharedStrings + rich text |
| PowerPoint     | `.pptx`       | **Download PowerPoint** — slides + notes |
| JSON i18n      | `.json`       | **Download JSON** — paths + types preserved |
| XLIFF          | `.xliff/.xlf` | **Download XLIFF** — bilingual round-trip |
| Plain          | `.txt/.md`    | **Download TXT** — target only |
| HTML           | `.html`       | One-way (no round-trip yet) |

### What "preserves structure" means in practice

- **DOCX V3 round-trip:** paragraph styles (Heading 1/2, body, list);
  bold/italic/underline/strikethrough boundaries; hyperlinks (with
  target); line breaks and tabs; tables (cells, headers, shading);
  footnote/endnote anchors; bookmarks; comment ranges; page-number and
  other fields; embedded drawings/images/OLE/math equations; permission
  ranges. Tracked changes (`<w:ins>`/`<w:del>`) are accepted on
  round-trip — accept them in Word first if you need them preserved.
- **XLSX:** every `<si>` shared string and every inline `<is>` cell
  string round-trips. Numeric, formula, date, and boolean cells are
  untouched.
- **PPTX:** slide content + speaker notes. Slide layouts/masters,
  charts, and diagrams are preserved unchanged but their text is not
  extracted in V1.
- **JSON:** every non-empty string leaf becomes a segment; numbers,
  booleans, null, and structure stay byte-identical on round-trip.
  ICU-style placeholders (`{name}`, `{count}`) are preserved as
  literal text in segments — the translator translates around them.

---

## Translators

`/pm/translators`

![Translators](/training/pm/05-translators.png)

Live roster of every translator and reviewer on the platform with
their current workload. Columns:

- **Name** + **Email** + **Role** (translator / reviewer)
- **Open jobs** — count of jobs assigned to them in any active status
  (draft, assigned, in_progress, review, qa_running, qa_review)
- **Words pending** — sum of `word_count` across those open jobs
- **In QA review** — how many of their jobs are sitting in `qa_review`
  awaiting their finding triage (rose pill if nonzero)

Use this view to balance workload before assigning a new job. To make
an assignment, open the **Job detail** page and pick from the dropdown
in the Assignment section.

Vendor-portal translators (those who arrive via SSO from the
recruitment flow) appear here automatically once their account is
created. Internal staff translators are added under `/admin/users`.

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

## QA and the Deliver pipeline

QA and Deliver are **two separate translator-facing actions**. They are
no longer chained — the translator can run QA on demand, iterate on
findings, and deliver whenever ready.

![Deliver and QA buttons](/training/pm/10-deliver-pipeline.png)

### Two buttons in the editor

- **Run QA** — runs the full QA pipeline (deterministic + Opus). Lands
  the job in `qa_review` so the translator can triage findings. Can be
  re-run from `qa_review` after fixes.
- **Deliver** — finalizes the job (`status = delivered`, or `submitted`
  for test jobs). Independent of QA. Allowed from `in_progress` AND
  `qa_review`. Blocks only on unresolved CRITICAL findings.

If `qa_enabled` was unchecked at job creation, the **Run QA** button
is hidden — the translator only sees Deliver.

### Status transitions

```
   assigned ─┐
             ↓
        in_progress ─── click Deliver ──→ delivered
             │
             └── click Run QA ──→ qa_running ──→ qa_review
                                                    │
                                                    ├── click Run QA again (re-run)
                                                    └── click Deliver ──→ delivered
```

### Phase 1 — Deterministic QA (free, instant)

- Placeholder/tag integrity, number/URL/email carry-through, length
  ratio, double-space, forbidden-term hits, untranslated, empty target.
- Findings written to `qa_findings` with `source = 'deterministic'`.
- If any critical finding is produced, Phase 2 is skipped — the
  translator must fix the blockers first.

### Phase 2 — Opus QA (paid, ~$0.08/1k words cached)

- Claude Opus reviews every confirmed segment in batches of 50 with
  the system prompt cached. The cached block carries language pair,
  full glossary, style guide, severity rubric, and target-language
  punctuation rules (CJK full-width, French NBSP-before-`: ; ? !`,
  Spanish opening `¡`/`¿`, Thai/Lao no terminal period, Arabic
  `، ؛ ؟`, etc.).
- Findings written with `source = 'opus'`, `category` (accuracy /
  terminology / fluency / grammar / register / punctuation / locale /
  style), and an optional `suggested_target`.
- A `qa_runs` row tracks token usage and cost per QA invocation.
  Default cost cap: $5/job. Cost is **not shown to the translator**.

### Per-job QA toggle (`jobs.qa_enabled`)

- Set at job creation via the **Enable AI QA review** checkbox in the
  PM new-job form.
- Default: **on** for production jobs, **off** for test/recruitment
  jobs.
- When off, the **Run QA** button is hidden in the editor. Deliver
  still works (and skips QA entirely).

### Job class — production vs test

- **Production** jobs default to `qa_enabled = true` and use the full
  pipeline if the translator runs QA.
- **Test** jobs (created via `/api/admin/test-jobs/create` for
  recruitment) default to `qa_enabled = false`. Deliver
  short-circuits to status `submitted` for the recruitment grader.
- Class is set at job creation; immutable afterward.

### Killswitch

Set env var `QA_ENABLED=false` to suppress the Opus phase platform-wide
without disabling Run QA. Deterministic still runs.

### What the PM sees

- The **Live** dot on the job page keeps ticking as the translator
  works through the QA review pane (accept/edit/reject).
- Once `delivered`, the job appears in your delivered queue (filter
  the jobs list by status).
- If a critical finding can't be resolved, the translator may
  **Reject** it with a note — review the note before contesting with
  them.

---

## See also

- **Admin guide** for client setup, TM/termbase administration, user invites
- **Translator guide** for the editor's keyboard shortcuts and TM panel
