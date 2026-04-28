-- Provenance for segments.target_text. Drives "MT", "TM 100%", "copied
-- source" badges in the editor and lets analytics flag confirmed segments
-- that were never edited after a machine-translation insert.
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS target_origin text;

COMMENT ON COLUMN segments.target_origin IS
  'Provenance of target_text. NULL = legacy/unknown. ''human'' = typed by translator. ''mt'' = inserted from MT and unedited. ''mt_edited'' = MT then edited. ''tm'' = inserted from TM match and unedited. ''tm_edited'' = TM then edited. ''copied_source'' = source pasted into target unchanged.';

ALTER TABLE segments
  DROP CONSTRAINT IF EXISTS segments_target_origin_chk;
ALTER TABLE segments
  ADD CONSTRAINT segments_target_origin_chk
  CHECK (target_origin IS NULL OR target_origin IN (
    'human','mt','mt_edited','tm','tm_edited','copied_source'
  ));
