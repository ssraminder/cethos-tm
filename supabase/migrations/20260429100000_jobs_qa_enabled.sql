-- Per-job QA toggle. PM picks at upload time whether AI QA is available
-- on this job. Default true for production, false for test jobs.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qa_enabled boolean NOT NULL DEFAULT true;
UPDATE jobs SET qa_enabled = false WHERE job_class = 'test';
