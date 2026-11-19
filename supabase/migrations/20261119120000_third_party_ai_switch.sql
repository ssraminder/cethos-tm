-- Third-party AI switch.
--
-- Third-party AI means any call that sends job content to an outside AI
-- provider: DeepL, Google Translate (machine translation) and the Claude
-- Opus QA pass. It is OFF unless explicitly allowed.
--
--   clients.third_party_ai_allowed  default for new jobs of that client
--   jobs.third_party_ai_allowed     the value actually enforced for the job
--
-- Existing rows default to false, so nothing is sent to an outside AI
-- provider until a PM or admin turns the switch on for a job.

alter table public.clients
  add column if not exists third_party_ai_allowed boolean not null default false;

alter table public.jobs
  add column if not exists third_party_ai_allowed boolean not null default false;

comment on column public.clients.third_party_ai_allowed is
  'Default for new jobs of this client: may job content be sent to third-party AI providers (DeepL, Google, Claude)?';
comment on column public.jobs.third_party_ai_allowed is
  'Enforced per job: may this job''s content be sent to third-party AI providers (DeepL, Google, Claude)? Off by default.';
