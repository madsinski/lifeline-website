-- The opt-in guided setup at /app/uppsetning: where somebody has got to.
--
-- Replaces the onboarding that used to start by itself on /app. Nothing here
-- is a gate — each step is "done" or "skipped" by the person's own choice,
-- and the row only exists so the setup resumes where they left it, on any
-- device. Written only through /api/hc/setup (service role), so clients get
-- no direct access.
--
--   steps         { "<step>": { "status": "done" | "skipped", "at": iso } }
--   data          small answers the later steps reuse (chosen training days,
--                 reminder hour) — never health data
--   current       the step to resume on
--   started_at    first time "Byrja" was pressed
--   dismissed_at  "Ekki núna" on the /app card: hide the big card, keep a link
--   completed_at  reached the done screen
--
-- Idempotent. Apply: supabase db query --linked -f supabase/migration-hc-setup-progress.sql

create table if not exists hc_setup_progress (
  client_id     uuid primary key references auth.users(id) on delete cascade,
  steps         jsonb not null default '{}'::jsonb,
  data          jsonb not null default '{}'::jsonb,
  current       text,
  started_at    timestamptz,
  dismissed_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table hc_setup_progress enable row level security;
drop policy if exists "Block client access" on hc_setup_progress;
create policy "Block client access" on hc_setup_progress
  for all using (false) with check (false);
drop policy if exists "Active staff can read" on hc_setup_progress;
create policy "Active staff can read" on hc_setup_progress
  for select using (public.is_active_staff());
