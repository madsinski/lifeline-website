-- Keeping a parsed report is reviewed, not assumed.
--
-- The PDF is never stored anywhere; what persists is the parsed result,
-- encrypted. That is still health data, and Art. 5(1)(e) says it is kept no
-- longer than necessary. Because Lifeline positions itself as a viewer and
-- not a sjúkraskrá, lög 55/2009's retention duty does not apply and storage
-- limitation genuinely bites.
--
-- Rather than expire it on a timer, the person is asked. That works here for
-- one specific reason: the original lives in Medalia, so removing Lifeline's
-- copy loses nothing — they can import it again in one step. The question is
-- therefore honest and low-stakes, which is what stops people clicking
-- "keep" out of fear and turning the review into theatre.
--
-- Idempotent; safe to re-run.

alter table public.hc_reports
  add column if not exists retention_asked_at     timestamptz,
  add column if not exists retention_reminded_at  timestamptz,
  add column if not exists retention_confirmed_at timestamptz;

comment on column public.hc_reports.retention_asked_at is
  'When the person was last asked whether to keep this report. Null = never asked.';
comment on column public.hc_reports.retention_confirmed_at is
  'When they last said keep. Resets the review clock. Also set by real use — a report the plan is actively built on does not need asking about.';

create index if not exists hc_reports_retention_idx
  on public.hc_reports (retention_confirmed_at, retention_asked_at)
  where client_approved_at is not null;

-- Existing reports start their clock now rather than counting from upload,
-- so nobody is asked about a report the day this ships.
update public.hc_reports
   set retention_confirmed_at = coalesce(retention_confirmed_at, created_at)
 where retention_confirmed_at is null;

notify pgrst, 'reload schema';
