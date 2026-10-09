-- Client confirmation of provenance for a staff-uploaded report.
--
-- Until now hc_reports.on_behalf_consent_at was written by the vinnustöð
-- import route from the NURSE's answer to "Hvernig kom skýrslan hingað?".
-- That records the interested party vouching for their own conduct, under a
-- name that implies the client agreed. The client never approved anything.
--
-- This adds the client's own act. A staff upload is held with
-- approval_requested_at set; the person confirms it from their own
-- authenticated session, which writes client_approved_at. Same gesture as
-- the nurse tapping a box, completely different evidentiary weight: one is
-- authenticated as them.
--
-- It is confirmation of PROVENANCE, not consent to process. The lawful basis
-- is Art. 9(2)(h) — care by a health professional — which by the first
-- coaching session is already in place. Calling it consent would import a
-- withdrawal right that cannot be honoured for a report the whole plan rests
-- on.
--
-- Idempotent; safe to re-run.

alter table public.hc_reports
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approval_requested_by text,
  add column if not exists client_approved_at    timestamptz;

comment on column public.hc_reports.approval_requested_at is
  'Set when staff upload a report on the client''s behalf. Until client_approved_at is set, the report is not shown on the client''s own surfaces.';
comment on column public.hc_reports.client_approved_at is
  'The client confirmed, in their own authenticated session, that this report is theirs and that they asked for it to be entered. Provenance, not Art. 9(2)(a) consent.';

-- A self-upload needs no approval: the person did it themselves, from their
-- own session. Backfill so existing self rows are not hidden.
update public.hc_reports
   set client_approved_at = coalesce(client_approved_at, created_at)
 where source = 'self' and client_approved_at is null;

-- The client-facing read. Mirrors hc_report_latest but shows only what the
-- person has approved. Staff keep using hc_report_latest: reading the report
-- to do the consultation is the care itself, and does not wait on a tap.
create or replace function public.hc_report_latest_approved(p_journey uuid)
returns table(payload jsonb, method text, source text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select public.decrypt_text(r.payload_enc)::jsonb, r.method, r.source, r.created_at
  from public.hc_reports r
  where r.journey_id = p_journey
    and r.payload_enc is not null
    and r.client_approved_at is not null
  order by r.created_at desc
  limit 1
$$;

notify pgrst, 'reload schema';
