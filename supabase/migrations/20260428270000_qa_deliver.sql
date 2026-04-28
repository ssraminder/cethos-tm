-- Deliver + Opus QA pipeline
--
-- Adds:
--   - jobs.job_class enum  (production | test) — test jobs skip QA entirely.
--   - qa_runs                — telemetry + cost per Deliver invocation.
--   - qa_findings extensions — run_id, source, category, suggested_target,
--                              reviewer_action, reviewer_note.
--
-- Status transitions for production jobs:
--   in_progress → qa_running → qa_review → delivered
-- Test jobs go in_progress → submitted (existing) — Deliver is a no-op QA
-- and just flips status.

-- ---- job_class ------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE job_class AS ENUM ('production', 'test');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS job_class job_class NOT NULL DEFAULT 'production';

-- ---- qa_runs --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qa_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  triggered_by    uuid REFERENCES auth.users(id),
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  model           text,                            -- e.g. claude-opus-4-7
  input_tokens    integer NOT NULL DEFAULT 0,
  cached_tokens   integer NOT NULL DEFAULT 0,
  output_tokens   integer NOT NULL DEFAULT 0,
  cost_usd        numeric(10, 4) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'running', -- running | completed | failed | aborted_cost_cap | skipped
  error_message   text
);

CREATE INDEX IF NOT EXISTS qa_runs_job_id_idx ON qa_runs(job_id);

-- ---- qa_findings extensions -----------------------------------------------

ALTER TABLE qa_findings
  ADD COLUMN IF NOT EXISTS run_id           uuid REFERENCES qa_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source           text NOT NULL DEFAULT 'deterministic',
  ADD COLUMN IF NOT EXISTS category         text,
  ADD COLUMN IF NOT EXISTS suggested_target text,
  ADD COLUMN IF NOT EXISTS reviewer_action  text,    -- accept | reject | edit | null
  ADD COLUMN IF NOT EXISTS reviewer_note    text;

CREATE INDEX IF NOT EXISTS qa_findings_run_id_idx ON qa_findings(run_id);
CREATE INDEX IF NOT EXISTS qa_findings_source_idx  ON qa_findings(source);
