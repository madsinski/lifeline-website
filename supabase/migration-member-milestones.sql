-- Per-employee process milestones for the company roster view
-- (added 2026-06-13). The employee list shows a tickable circle per
-- milestone; "done" merges an auto-detected signal with an admin tick:
--
--   measurement   auto = station_slots.completed_at (by client_id)
--   doctor_review auto = doctor_slots.completed_at (by client_id)
--   app_access    auto = clients.biody_patient_id present
--   blood_test    no hard signal — manual tick (journey_checks hint)
--   questionnaire no hard signal — manual tick (journey_checks hint)
--
-- A manual tick here is authoritative for the no-signal milestones and
-- can force-complete the auto ones; removing a tick falls back to the
-- auto signal. API-mediated only (RLS blocks direct client access).

create table if not exists company_member_milestones (
  member_id uuid not null references company_members(id) on delete cascade,
  milestone text not null check (milestone in (
    'measurement', 'blood_test', 'questionnaire', 'doctor_review', 'app_access'
  )),
  done_at timestamptz not null default now(),
  marked_by uuid,
  primary key (member_id, milestone)
);
create index if not exists idx_company_member_milestones_member
  on company_member_milestones (member_id);

alter table company_member_milestones enable row level security;
drop policy if exists "Block client access" on company_member_milestones;
create policy "Block client access" on company_member_milestones
  for all using (false) with check (false);
