-- A report imported from Medalia (PDF drop / re-import) is not the same as a
-- report a Lifeline doctor has confirmed. Until now the import set
-- report_generated_at ("confirmed by a doctor"), which skipped the doctor,
-- the escalation SMS and the "your report is ready" email.
--
--   report_imported_at  — the parsed report is in (nurse can prepare and book
--                         the interview)
--   report_generated_at — a doctor confirmed it (participant sees it)
-- Idempotent.

alter table public.hc_journeys add column if not exists report_imported_at timestamptz;

-- Existing imports: keep what the workstation showed before (confirmed), and
-- record that a report was imported.
update public.hc_journeys j
set report_imported_at = coalesce(j.report_imported_at, (select min(r.created_at) from public.hc_reports r where r.journey_id = j.id))
where j.report_imported_at is null and exists (select 1 from public.hc_reports r where r.journey_id = j.id);
