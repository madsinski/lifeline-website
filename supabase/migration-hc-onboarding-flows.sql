-- Onboarding as a thing an admin arranges, not a thing a component decides.
--
-- The pieces all existed — a slideshow, a consent form, three questions, a
-- track chooser, 24 lectures, a booking screen — in a fixed order spread
-- across several components, so changing the order meant changing code. The
-- registry in src/lib/hc/onboarding-modules.ts names the pieces; this stores
-- the arrangement.
--
-- One row per flow, steps as jsonb rather than a child table: a flow is read
-- whole and written whole, never queried step-by-step, and a join to put
-- eight rows back in order is work nobody asked for. The registry validates
-- the shape on write.

create table if not exists hc_onboarding_flows (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  /** Which audience this is for: both tracks, or one of them. */
  audience    text not null default 'all' check (audience in ('all', 'check', 'coach')),
  steps       jsonb not null default '[]'::jsonb,
  /** Exactly one flow per audience may be live; enforced below. */
  active      boolean not null default false,
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One live flow per audience. Without this, two active flows means the app
-- picks whichever the query happened to return first — which looks like a
-- random bug months later rather than a missing constraint today.
create unique index if not exists hc_onboarding_flows_active_idx
  on hc_onboarding_flows (audience) where active;

alter table hc_onboarding_flows enable row level security;

-- Clients read the active flow through /api/hc/onboarding; admins write it
-- through /api/admin/hc/onboarding. Neither touches the table directly.
drop policy if exists "Block client access" on hc_onboarding_flows;
create policy "Block client access" on hc_onboarding_flows
  for all using (false) with check (false);

-- Where somebody has got to. Separate from the flow so editing a flow does
-- not rewrite anybody's progress, and so a person who is halfway through an
-- older arrangement is not thrown back to the start by a publish.
create table if not exists hc_onboarding_progress (
  client_id   uuid primary key,
  flow_slug   text not null,
  step_index  integer not null default 0,
  answers     jsonb not null default '{}'::jsonb,
  done_at     timestamptz,
  updated_at  timestamptz not null default now()
);

alter table hc_onboarding_progress enable row level security;
drop policy if exists "Block client access" on hc_onboarding_progress;
create policy "Block client access" on hc_onboarding_progress
  for all using (false) with check (false);
