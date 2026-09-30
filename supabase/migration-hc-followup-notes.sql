-- The follow-up conversation gets its own notes. It used to write into
-- interview_notes, overwriting the first interview's record.
-- Idempotent.

alter table public.hc_journeys add column if not exists followup_notes jsonb;
