-- Add PM review workflow statuses to job_status enum.
-- After a translator delivers, a PM can start review, then approve
-- or request revision.
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'pm_review' AFTER 'delivered';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'pm_review';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'revision_requested' AFTER 'approved';
