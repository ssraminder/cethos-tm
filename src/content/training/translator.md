# Cethos CAT — Translator Training Guide

This is the linguist's workbench. Source on the left, target on the right,
TM matches and termbase suggestions in the right pane. Confirm what you
trust, refine what you don't, and click Deliver when the job is complete.

> **Audience:** users with the `translator` or `reviewer` role.

## Contents

1. [Signing in](#signing-in)
2. [Inbox](#inbox)
3. [The segment editor](#the-segment-editor)
4. [Working through a segment](#working-through-a-segment)
5. [TM matches](#tm-matches)
6. [Term highlights](#term-highlights)
7. [Machine translation](#machine-translation)
8. [Deliver and QA review](#deliver-and-qa-review)
9. [Concordance](#concordance)
10. [Profile](#profile)
11. [Common workflows](#common-workflows)

---

## Signing in

![Sign-in page](/training/translator/00-sign-in.png)

Two paths into Cethos CAT:

**1. Vendor portal handoff (most common).** When a PM assigns you a job in
your vendor portal, you'll get a "Open in Cethos CAT" link. Clicking it
verifies your identity automatically — no separate password — and drops
you straight into the editor for that job.

**2. Direct sign-in via OTP.** Go to `/sign-in`, enter your email, and we
email a 6-digit OTP via Mailgun within a few seconds. Enter it on
`/verify` and you're in. The OTP expires in 10 minutes. There is no
password — every sign-in is OTP.

After signing in, you land in your inbox.

---

## Inbox

`/translator`

![Translator inbox](/training/translator/01-translator-inbox.png)

Every job assigned to you that isn't yet closed. Columns:

- **Job** — the reference; click "Open editor →" to start working
- **Pair** — source → target language
- **Words** — billable count
- **Status** — `assigned` (untouched), `in_progress` (you've saved at
  least one segment), `qa_running` (Deliver pipeline active), `qa_review`
  (findings awaiting your review), `delivered` (finalized)
- **Deadline** — local time

Four KPIs at the top:

- **In progress** — jobs you've started
- **Assigned** — jobs assigned but not yet started
- **In review** — jobs in `qa_review` or further along
- **Words pending** — sum across all open jobs

Empty inbox means no work is queued — your PM (or the TMS) hasn't pushed
anything yet.

---

## The segment editor

`/translator/editor/[jobId]`

![Segment editor — XTM-style layout](/training/translator/02-segment-editor.png)

The editor is the headline screen. Four regions, laid out horizontally:

### Top bar
- **← Inbox** — back to the queue
- **Job reference** + language pair, plus pills: **Read-only**, **Test**,
  **QA running…**, **QA review** (whichever applies)
- **Live** dot — green when the realtime channel is connected (your edits
  propagate to the PM's job page within ~250 ms)
- **Confirmed / total** + progress bar — your overall progress on this job
- **Deliver** button (or **Submit test** on test jobs) — only enabled
  when every segment is confirmed

### Filter bar
- **All / Open / Draft / Confirmed** — narrow the segment list to a
  status
- **Resources line** — shows how many TMs/termbases are attached and how
  many segments have an exact (TM 100%) match available

### Segment grid (left column, the main editing area)
Each row is one segment with four columns:

1. **#** — sequence number
2. **Status icon** — empty (open), pencil (draft), check (translated /
   confirmed), double-check (reviewed). Icon-only — no letter labels.
3. **Source** — read-only original text with inline term highlights and
   a **Copy source** action chip below
4. **Target** — your editable translation with a textarea and Save /
   Confirm buttons. A small icon next to the target shows save state and
   provenance (see [target origin](#target-origin)).

The active row is highlighted in faint blue when its target field is
focused; confirmed rows show an emerald border on the left.

The column headers display the **full language names** of the job
(e.g. `English` and `French`), not generic "Source" / "Target".

### Right tabbed pane (XTM-style, follows active segment)
Four tabs:

- **Matches** — TM matches for the active segment, fetched live as you
  click between rows. Click **Insert** or **Insert & confirm** to use
  one.
- **Termbase** — term hits in the active segment with approved/forbidden
  status.
- **TM search** — concordance search across attached TMs (language-pair
  scoped) when you want to see how a phrase was rendered previously.
- **Glossary** — manual term lookup across attached termbases.

The bottom split-screen panel from earlier versions has been removed;
all match/glossary tooling lives in the right pane now.

---

## Working through a segment

The basic loop:

1. **Read the source.** Pay attention to highlighted terms (see
   [Term highlights](#term-highlights)) and any TM badge.
2. **Write the target.** Click into the textarea and type. The status
   icon turns to a pencil as soon as you type. If a 100% TM match
   exists, the target is **already pre-filled** for you (see below).
3. **Save** (white button) — persists your draft. Status stays `draft`.
4. **Confirm** (emerald button) — persists *and* marks the segment
   `translated`. The first confirm on a fresh job auto-flips its status
   to `in_progress`. The confirmed string is written to the **default TM**
   so it's immediately available for leverage on future jobs.

Keyboard shortcuts (where available): `Ctrl+Enter` to confirm,
`Ctrl+S` to save without confirming.

### Copy source

Click **Copy source** below any segment's source to copy the source
text into the target. Useful for codes, numbers, names, URLs that
shouldn't be translated. The segment is marked with origin
`copied_source` so a reviewer can see at a glance that the target is
intentionally identical.

### Target origin

Each confirmed segment carries a small badge indicating where the
target came from:

- **Human** — typed from scratch
- **MT** — machine translation accepted unchanged
- **MT (edited)** — MT seed, then refined
- **TM** — TM 100% match accepted unchanged
- **TM (edited)** — TM seed, then refined
- **Copied source** — source pasted as target on purpose

Reviewers and PMs use these to focus their attention.

---

## TM matches

If an attached translation memory has a unit whose source text matches the
current segment, you'll see it surfaced two ways:

1. **100% matches auto-insert.** When the editor loads, segments with an
   exact (case-insensitive after whitespace normalization) TM hit are
   pre-filled in the target column with origin `tm`. The status icon
   stays at `draft` until you confirm — review the suggestion, then
   click **Confirm** if it's right.

2. **Fuzzy matches in the right pane.** Click into a row and the
   **Matches** tab populates with up to 5 candidates ranked by score:

   - **TM 100%** (emerald) — exact match
   - **TM 95–99%** (lime) — near-exact, usually only a number or
     punctuation differs
   - **TM 75–94%** (amber) — fuzzy; useful as a starting point but
     verify
   - **<75%** (grey) — same general meaning, structurally different

   Each match has **Insert** / **Insert & confirm** buttons.

Every job has a **Default TM** auto-attached at creation, scoped to the
job's language pair. You don't need to ask your PM to attach one. As you
confirm segments they accumulate in the default TM and become available
for leverage on the next job.

---

## Term highlights

When termbases are attached to your job, source terms that match a
termbase entry are highlighted inline:

- **Teal underline** — approved term. The Termbase tab in the right pane
  shows the preferred target term (e.g., `customer → client`). Reuse it.
- **Rose underline** — the target equivalent is flagged **forbidden**.
  The Termbase tab shows what NOT to write (e.g., `cheap → bon marché`
  with strikethrough). Pick a different word.

Forbidden terms are also a QA rule — if you accidentally type one in
your target, the **forbidden_term** finding fires when Deliver runs.

---

## Machine translation

(Staff only — translators on production jobs do not see MT.)

When MT is enabled, click **Get MT** below any segment's source to fetch
a machine-translation suggestion. The suggestion appears in a
purple-tinted card with **Insert** / **Insert & confirm** buttons.
Accepted MT carries origin `mt`; if you edit it before confirming the
origin becomes `mt_edited`.

---

## Deliver and QA review

When all segments on a production job are confirmed (status `translated`
or `reviewed`), the **Deliver** button in the top bar lights up. Click
it to start the QA pipeline.

![Deliver confirm dialog](/training/translator/05-deliver-confirm.png)

Cethos shows you the estimated cost (~$0.08 per 1,000 words for
production jobs that pass through Opus QA). Click **OK** to proceed.

The pipeline runs in two phases:

### Phase 1 — Deterministic QA

Pure-rule checks run instantly with no Anthropic call:

- Empty target / placeholder integrity / inline tag balance
- Number, date, URL, and email carry-through
- Length ratio and double-space sanity
- Forbidden-term hits from your glossaries

If any **critical** finding is produced (placeholder mismatch,
forbidden term, empty target, untranslated > 5-word segment), Phase 2
is skipped and the job goes straight to review so you can fix the
blocker first.

### Phase 2 — Opus QA

If deterministic passes, every confirmed segment is reviewed by Claude
Opus in batches of 50, with the system prompt cached. Opus checks for:

- Accuracy, omissions, additions, mistranslations
- Terminology consistency across the job
- Register/tone match against the style guide
- Fluency — natural target-language phrasing
- Grammar, agreement, tense
- Locale conventions — number/date/currency formatting
- Target-language punctuation conventions (CJK full-width, French NBSP
  before `: ; ? !`, Spanish opening `¡`/`¿`, Thai/Lao no terminal
  period, Arabic `، ؛ ؟`, etc.)

Each Opus finding includes a severity (`info`/`warn`/`error`),
category, and where applicable a **suggested target** that you can
accept with one click.

### QA review pane

When the run finishes, the job status flips to `qa_review` and a panel
appears between the filter bar and the segment grid:

![QA review pane](/training/translator/06-qa-review.png)

For each finding you have three actions:

- **Accept** — applies Opus's `suggested_target` to the segment and
  bumps the TM with the corrected target. Marks the finding resolved
  with action `accept`.
- **Edit & save** — type your own fix; same TM bump, action `edit`.
- **Reject** — keep your original target. You can leave a note
  explaining why; action `reject`.

The **Confirm delivery** button at the top of the panel is disabled
until every **critical** finding is resolved (accepted, edited, or
rejected). Major and minor findings don't gate delivery — you can
deliver with them open if you choose, but they remain on the record.

When you click **Confirm delivery**, the job flips to `delivered` and
goes back to your PM. Done.

### Test jobs

Test jobs (recruitment / smoke tests) are tagged with a **Test** pill
in the top bar. The Deliver button reads **Submit test** instead, and
the QA pipeline is skipped entirely — your test is graded by the
recruitment rubric, not by Opus QA.

---

## Concordance

`/translator/concordance`

![Concordance](/training/translator/03-concordance.png)

Phrase search across the TMs attached to your jobs. Useful for:

- Finding how an idiom was rendered previously
- Checking client-preferred wording for a term not in the termbase
- Spot-checking your own consistency across a long job

The same lookup is one click away inside the editor via the **TM
search** tab in the right pane.

---

## Profile

`/translator/profile`

![Profile](/training/translator/04-profile.png)

Your account info: email, name, role, status. Rates and language pairs
are managed in the vendor portal — not in Cethos CAT — so this view is
slim. Editor preferences (theme, shortcut bindings, default MT engine)
are roadmap.

There is no password to manage — sign-in is OTP-only.

---

## Common workflows

### A. Take a fresh job from inbox to delivery

1. Click **Open editor →** on a job in your inbox
2. Walk top-to-bottom: 100% TM matches are already pre-filled — review
   each, click **Confirm** when right
3. For empty rows, write the target; save frequently
4. Once every row has a check icon (status `translated`), the **Deliver**
   button lights up
5. Click **Deliver** → review the cost estimate → OK
6. When QA review pane appears, work through findings (accept / edit /
   reject)
7. Click **Confirm delivery** when no critical findings remain — the
   job is done

### B. Recover from a paste mistake

1. Edit the textarea — your typing replaces the bad paste
2. Save normally; the previous draft is overwritten

### C. Use TM 100% matches efficiently

1. Filter by **Confirmed** to see what's already auto-pre-filled
2. Skim each pre-fill — if it's right, click **Confirm**
3. If it's wrong (rare — usually a context-specific reuse), edit the
   target before confirming. The origin will become `tm_edited`.

### D. Fix a forbidden-term finding during QA review

1. Look for the rose **forbidden_term** finding in the QA review pane
2. Read which target term is forbidden
3. Click **Edit & save**, type a replacement; the finding closes and
   the TM is updated with your fix

### E. Reject an Opus finding you disagree with

1. In the QA review pane, click **Reject** on the finding
2. Optional: type a note explaining your reasoning
3. The finding is marked resolved with action `reject` — your original
   target is kept as-is

---

## Need help?

- Stuck at OTP step: contact your PM — they can resend or issue a known
  code
- Source doesn't render correctly: check if the file format is
  supported; XLIFF tag preservation is automatic
- Deliver button greyed out: every segment must be confirmed first
  (filter by **Open** or **Draft** to find the holdouts)
- Confirm delivery greyed out: a critical finding is still open in the
  QA review pane
