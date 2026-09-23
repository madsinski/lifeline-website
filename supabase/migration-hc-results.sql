-- Measured values for a health-check journey: what the nurse reads off the
-- blood panel and the measurement station. One row per marker per journey.
--
-- `marker` matches hc_knowledge.slug, so the workstation can flag a value
-- against Lifeline's own reference bands and open the reference entry from it.
-- The formal medical record stays in Medalia; this is the working copy the
-- workstation reasons about (and what the partner API will write into when it
-- goes live — hence `source`).
--
-- API-mediated (src/app/api/vinnustod/results): service role only.

create table if not exists public.hc_results (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references public.hc_journeys(id) on delete cascade,
  client_id   uuid not null,
  marker      text not null,                    -- hc_knowledge.slug
  value       numeric not null,
  unit        text,
  measured_at date,
  source      text not null default 'manual' check (source in ('manual','medalia','biody','lab')),
  note        text,
  entered_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (journey_id, marker)
);

create index if not exists hc_results_journey_idx on public.hc_results (journey_id);

alter table public.hc_results enable row level security;
drop policy if exists "hc_results no client access" on public.hc_results;
create policy "hc_results no client access"
  on public.hc_results for all using (false) with check (false);
