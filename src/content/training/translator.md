# Cethos CAT — Translator Training Guide

This is the linguist's workbench. Source on the left, target on the right,
TM matches and termbase suggestions inline. Confirm what you trust, refine
what you don't.

> **Audience:** users with the `translator` or `reviewer` role.

## Contents

1. [Signing in](#signing-in)
2. [Inbox](#inbox)
3. [The segment editor](#the-segment-editor)
4. [Working through a segment](#working-through-a-segment)
5. [TM matches](#tm-matches)
6. [Term highlights](#term-highlights)
7. [Machine translation](#machine-translation)
8. [QA findings](#qa-findings)
9. [Concordance](#concordance)
10. [Profile](#profile)
11. [Common workflows](#common-workflows)

---

## Signing in

Two paths into Cethos CAT:

**1. Vendor portal handoff (most common).** When a PM assigns you a job in
your vendor portal, you'll get a "Open in Cethos CAT" link. Clicking it
verifies your identity automatically — no separate password — and drops
you straight into the editor for that job.

**2. Direct sign-in.** If you have a direct account, go to `/sign-in`,
enter your email + password, and verify the 6-digit code we email to you.
The OTP expires in 10 minutes.

After signing in, you land in your inbox.

---

## Inbox

`/translator`

![Translator inbox](/training/translator/01-translator-inbox.png)

Every job assigned to you that isn't yet closed. Columns:

- **Job** — the reference; click "Open editor →" to start working
- **Pair** — source → target language
- **Words** — billable count
- **Status** — `assigned` (untouched), `in_progress` (you've saved at least
  one segment), `review` (submitted, reviewer in progress)
- **Deadline** — local time

Four KPIs at the top:

- **In progress** — jobs you've started
- **Assigned** — jobs assigned but not yet started
- **In review** — jobs you've submitted, awaiting reviewer
- **Words pending** — sum across all open jobs

Empty inbox means no work is queued — your PM (or the TMS) hasn't pushed
anything yet.

---

## The segment editor

`/translator/editor/[jobId]`

![Segment editor](/training/translator/02-segment-editor.png)

The editor is the headline screen. Three regions:

### Top bar
- **← Inbox** — back to the queue
- **Job reference** + language pair
- **Live** dot — green when the realtime channel is connected (your edits
  propagate to the PM's job page within ~250 ms)
- **Confirmed / total** + progress bar — your overall progress on this job

### Filter bar
- **All / Open / Draft / Confirmed** — narrow the segment list to a status
- **Resources line** — shows how many TMs/termbases are attached and how
  many segments have an exact (TM 100%) match available

### Segment grid (the main column)
Each row is one segment with five visual zones:

1. **#** — sequence number
2. **Status dot** — grey (open), amber (draft), emerald (translated/reviewed)
3. **Source** — read-only original text with inline term highlights and
   action chips below (TM badge, "Find TM matches", "Get MT")
4. **Target** — your editable translation with a textarea and action buttons
5. (Right rail) — attached TMs/termbases + job metadata

The active row is highlighted in faint blue when its target field is
focused; confirmed rows show an emerald border on the left.

---

## Working through a segment

The basic loop:

1. **Read the source.** Pay attention to highlighted terms (see
   [Term highlights](#term-highlights)) and any TM badge.
2. **Write the target.** Click into the textarea and type. The status
   dot turns amber as soon as you type.
3. **Save** (white button) — persists your draft. Status stays `draft`.
4. **Confirm** (emerald button) — persists *and* marks the segment
   `translated`. The first confirm on a fresh job auto-flips its status
   to `in_progress`.

Keyboard shortcuts (where available): `Ctrl+Enter` to confirm,
`Ctrl+S` to save without confirming.

If you pasted by accident or want to try again, just edit and **Save** —
unconfirmed edits don't carry over to the next reviewer.

---

## TM matches

If an attached translation memory has a unit whose source text matches the
current segment, you'll see a colored "TM N%" badge in the source column:

- **TM 100%** (emerald) — exact match (case-insensitive after whitespace
  normalization). One click on the **Use TM 100%** button inserts the
  TM target *and* confirms the segment.
- **TM 95–99%** (lime) — near-exact, usually only a number or punctuation
  differs
- **TM 75–94%** (amber) — fuzzy; useful as a starting point but verify
- **<75%** (grey) — same general meaning, structurally different

For exact matches we pre-compute and render the badge for every segment
on page load (single batched RPC). For fuzzy matches, click **Find TM
matches** below the source to load the top 5 candidates with diff
highlights and **Insert** / **Insert & confirm** buttons.

---

## Term highlights

When termbases are attached to your job, source terms that match a
termbase entry are highlighted inline:

- **Teal underline + chip** — approved term. The chip below shows the
  preferred target term (e.g., `customer → client`). Reuse it.
- **Rose underline + strikethrough chip** — the target equivalent is
  flagged **forbidden**. The chip shows what NOT to write
  (e.g., `cheap → bon marché` with strikethrough). Pick a different word.

Forbidden terms are also a QA rule — if you accidentally type one in your
target, the **forbidden_term** finding fires when QA runs.

---

## Machine translation

Click **Get MT** below any segment's source to fetch a machine-translation
suggestion from the configured engine (DeepL, Google, or mock if no API
key is set). The suggestion appears in a purple-tinted card with two
buttons:

- **Insert** — paste into the target, leave status `draft`
- **Insert & confirm** — paste and mark `translated`

MT is most useful for boilerplate or as a starting point on segments with
no TM hit. Always verify — MT-mock output ("[MT-mock en-US→fr-FR] …") is
clearly labelled because the workspace doesn't have a real engine
configured.

---

## QA findings

When the PM (or you, via the editor) runs QA on a job, findings render
inline under each affected segment's target box:

- **Critical (rose)** — must be resolved before submission
- **Major (amber)** — usually fixable in 30 seconds
- **Minor (slate)** — style / consistency hints

Common findings:

| Rule | Meaning |
|------|---------|
| `untranslated` | Target is empty on a segment that should have one |
| `tag_mismatch` | Source has `{1}` `{2}` placeholders the target is missing |
| `forbidden_term` | A forbidden termbase target term appears in your target |
| `number_mismatch` | Numeric tokens differ between source and target |
| `length_ratio` | Target/source character length is outside `[0.5, 2.5]` |
| `identical_source_target` | You forgot to translate; or it's intentional |
| `double_space` | Target contains `  ` |
| `leading_trailing_whitespace` | Source has leading/trailing space, target doesn't (or vice versa) |

Findings auto-clear when you save a fix and re-run QA.

---

## Concordance

`/translator/concordance`

![Concordance](/training/translator/03-concordance.png)

Phrase search across the TMs attached to your jobs. Useful for:

- Finding how an idiom was rendered previously
- Checking client-preferred wording for a term not in the termbase
- Spot-checking your own consistency across a long job

This page surface is read-only; the same lookup is one click away inside
the editor via **Find TM matches**.

---

## Profile

`/translator/profile`

![Profile](/training/translator/04-profile.png)

Your account info: email, name, role, status. Rates and language pairs
are managed in the vendor portal — not in Cethos CAT — so this view is
slim. Editor preferences (theme, shortcut bindings, default MT engine)
are roadmap.

To change your password, sign out and use **Forgot password?** on the
sign-in page.

---

## Common workflows

### A. Take a fresh job from inbox to submission

1. Click **Open editor →** on a job in your inbox
2. Walk top-to-bottom: confirm 100% TM matches first (one click each),
   then review fuzzy matches, then write the rest from scratch
3. Save frequently; don't worry about Confirm until you're sure
4. Once every row has emerald borders (status `translated`), use the
   filter pill **Confirmed** to verify
5. Click **Run QA** to surface anything you missed
6. Submit (UI surface coming; for now your PM marks the job `submitted`)

### B. Recover from a paste mistake

1. Edit the textarea — your typing replaces the bad paste
2. Save normally; the previous draft is overwritten

### C. Use MT on a no-match segment

1. Click **Get MT** below the source
2. Read the purple suggestion card carefully — MT can hallucinate or miss
   tone
3. **Insert** to paste, then refine in the textarea
4. Save when happy

### D. Fix a forbidden-term finding

1. Look for the rose **forbidden_term** chip under the segment's target
2. Read which target term the termbase forbids
3. Pick a different word (the source-side chip suggests an approved one if
   the same concept has an approved term)
4. Save — the QA finding clears on next run

---

## Need help?

- Stuck at OTP step: contact your PM or the admin to issue you a known code
- Source doesn't render correctly: check if the file format is supported;
  XLIFF tag preservation is automatic
- TM badge is wrong: tell your PM — they can adjust TM priority on the
  job detail page
