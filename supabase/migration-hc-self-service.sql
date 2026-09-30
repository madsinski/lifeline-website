-- Self-service in the heilsuferð: the participant puts their own health report
-- in (or staff do, on their behalf and at their request) and builds or edits
-- their own action plan from the library. Idempotent.

-- The participant's own report is in (self upload, or staff on their behalf).
-- Unlike report_generated_at (a Lifeline doctor confirmed it), this needs no
-- confirmation before the participant sees it: it is their own document.
alter table public.hc_journeys add column if not exists own_report_at timestamptz;

-- Who last shaped the plan: 'staff' or 'self' (the participant).
alter table public.hc_action_plans add column if not exists edited_by_client_at timestamptz;

-- Every saved version of a plan, so staff can see what the participant changed.
create table if not exists public.hc_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.hc_action_plans(id) on delete cascade,
  journey_id uuid not null references public.hc_journeys(id) on delete cascade,
  version integer not null,
  by_kind text not null check (by_kind in ('staff', 'self')),
  by_label text,
  goals jsonb,
  modules jsonb,
  lecture_slugs text[],
  created_at timestamptz not null default now()
);
create index if not exists hc_plan_versions_plan_idx on public.hc_plan_versions (plan_id, version desc);
alter table public.hc_plan_versions enable row level security;
drop policy if exists "hc_plan_versions no client access" on public.hc_plan_versions;
create policy "hc_plan_versions no client access" on public.hc_plan_versions for all using (false) with check (false);

-- Staff-on-behalf reports count as the participant's own.
update public.hc_journeys j set own_report_at = r.created_at
from (select journey_id, min(created_at) created_at from public.hc_reports where source in ('self', 'staff_on_behalf') group by journey_id) r
where r.journey_id = j.id and j.own_report_at is null;
