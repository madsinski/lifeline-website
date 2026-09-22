-- Workstation v2: guided interview notes + nurse → doctor review requests.
-- Used by /vinnustod (src/app/vinnustod/page.tsx) via /api/vinnustod/journeys/[id].
-- Idempotent.

alter table hc_journeys add column if not exists interview_notes jsonb not null default '{}'::jsonb;
-- { sleep, exercise, nutrition, mental, measurements, goals, other } — free text per pillar.
alter table hc_journeys add column if not exists doctor_review_requested_at timestamptz;
alter table hc_journeys add column if not exists doctor_review_note text;
alter table hc_journeys add column if not exists doctor_reviewed_at timestamptz;
