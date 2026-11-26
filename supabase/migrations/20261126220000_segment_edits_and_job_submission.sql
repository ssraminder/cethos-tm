-- 1) Segment edit history (ISO 17100 traceability).
--    Admins and PMs may now edit any open job; every segment change by
--    anyone is recorded here with who, their role, whether they edited by
--    staff right (as_staff = job not assigned to them), and before/after.
--    Append-only: UPDATE and DELETE are blocked by trigger. Written only by
--    the server (service role); RLS on with no policies.
create table if not exists public.segment_edits (
  id          uuid primary key default gen_random_uuid(),
  segment_id  uuid not null references public.segments(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  seq         integer,
  actor_id    uuid references public.profiles(id),
  actor_email text,
  actor_role  text not null,
  as_staff    boolean not null default false,
  action      text not null check (action in
                ('save','confirm','clear','exclude','include','correct_source','illegible','qa_edit')),
  job_status  text,
  before      jsonb not null default '{}'::jsonb,
  after       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists segment_edits_job_idx on public.segment_edits (job_id, created_at desc);
create index if not exists segment_edits_segment_idx on public.segment_edits (segment_id, created_at desc);

alter table public.segment_edits enable row level security;

create or replace function public.segment_edits_no_mutate()
returns trigger language plpgsql as $$
begin
  -- Cascade deletes from a deleted job/segment are allowed (the parent is
  -- gone); direct edits of history rows are not.
  if tg_op = 'DELETE' and not exists (select 1 from public.segments where id = old.segment_id) then
    return old;
  end if;
  raise exception 'segment_edits is append-only';
end;
$$;

drop trigger if exists segment_edits_no_mutate on public.segment_edits;
create trigger segment_edits_no_mutate
  before update or delete on public.segment_edits
  for each row execute function public.segment_edits_no_mutate();

-- 2) One job per create-form submission. The form carries a one-time
--    submission_id in jobs.meta; a resubmit (double click, retry, refresh)
--    hits this index and the server opens the existing job instead.
create unique index if not exists jobs_submission_id_key
  on public.jobs ((meta->>'submission_id'))
  where meta ? 'submission_id';
