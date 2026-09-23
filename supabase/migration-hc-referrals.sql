-- Referrals out of the health check.
--
-- The workstation had one free-text box and a single destination
-- (Heilsugaeslan). In practice a health check sends people five ways: the
-- GP for something found in the bloods, a physiotherapist for a knee, a
-- psychologist, a nutritionist, or a named specialist. Each one needs to
-- reach the responsible doctor as a task, not as a sentence in a note.
--
-- The nurse does not decide a referral. She proposes it; the doctor approves
-- it. That is why status starts at 'requested' and why decided_by exists.
--
-- All access through the API with the service role; RLS blocks the rest.
-- Applied: 2026-09-23 (Supabase Management API).

create table if not exists public.hc_referrals (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.hc_journeys(id) on delete cascade,
  client_id uuid not null,
  -- heilsugaesla | physio | psychologist | nutritionist | specialist
  target text not null,
  -- What the doctor is being asked to look at. Never a diagnosis made by us.
  reason text not null,
  note text,
  -- requested | approved | declined | done
  status text not null default 'requested',
  -- 'ai' when it came off the proposal, 'nurse' when typed or picked.
  suggested_by text,
  requested_by text not null,
  doctor_notified_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hc_referrals_journey_idx on public.hc_referrals (journey_id, created_at desc);
create index if not exists hc_referrals_open_idx on public.hc_referrals (status, created_at desc);

alter table public.hc_referrals enable row level security;
drop policy if exists "Block client access" on public.hc_referrals;
create policy "Block client access" on public.hc_referrals for all using (false) with check (false);
