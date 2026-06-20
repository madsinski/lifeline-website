-- Business onboarding tester feedback.
--
-- Backs the "Tester feedback" composer in the /admin/business Testing guide
-- tab (any active staff member can submit free-text notes while walking the
-- B2B onboarding flow) and the admin "Test feedback" review tab.
--
-- API-mediated only: src/app/api/admin/business/test-feedback/route.ts is the
-- single read/write path (uses supabaseAdmin). Direct client access is blocked
-- by RLS per the repo convention.
--
-- Idempotent — safe to re-run in the Supabase SQL editor.

create table if not exists public.business_test_feedback (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  tester_id       uuid,
  tester_email    text not null,
  tester_name     text,
  -- Optional tag for the phase/step the note is about. step_key is the
  -- machine key from the guide; step_label is the human-readable title.
  step_key        text,
  step_label      text,
  body            text not null,
  -- 'open' until an admin reviews it, then 'resolved'.
  status          text not null default 'open',
  admin_note      text,
  resolved_at     timestamptz,
  resolved_by_email text
);

create index if not exists business_test_feedback_created_idx
  on public.business_test_feedback (created_at desc);
create index if not exists business_test_feedback_status_idx
  on public.business_test_feedback (status);
create index if not exists business_test_feedback_tester_idx
  on public.business_test_feedback (tester_email);

alter table public.business_test_feedback enable row level security;

-- All reads/writes go through the API with the service-role client.
drop policy if exists "Block client access" on public.business_test_feedback;
create policy "Block client access" on public.business_test_feedback
  for all using (false) with check (false);
