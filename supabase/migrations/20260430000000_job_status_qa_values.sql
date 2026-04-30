-- The original QA Deliver migration (20260428270000_qa_deliver.sql) added
-- the qa_runs table and qa_findings columns but missed the job_status enum
-- values. Without these, runQa()/finalizeDelivery() fail with
-- "invalid input value for enum job_status" the moment they try to flip
-- a job to qa_running, qa_review, or delivered.
--
-- ALTER TYPE ... ADD VALUE must run outside a transaction block.
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'qa_running';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'qa_review';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'delivered';
