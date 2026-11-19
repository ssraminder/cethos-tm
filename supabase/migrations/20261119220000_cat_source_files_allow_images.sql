-- Image jobs store the uploaded scan (PDF, JPEG, PNG) and the rendered page
-- images (JPEG) in cat-source-files. Add those types to the bucket's list.
-- Applied to the TM project on 2026-11-19.
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m order by m)
  from unnest(coalesce(allowed_mime_types, '{}') || array['application/pdf', 'image/jpeg', 'image/png']) as m
)
where id = 'cat-source-files';
