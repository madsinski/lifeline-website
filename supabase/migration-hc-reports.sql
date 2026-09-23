-- The parsed Grunnheilsa report: every score, risk, measurement and marker
-- the report prints, with its traffic light, its history and the report's own
-- advice. Read out of the PDF on our own server — the PDF itself is never
-- stored, only what it said.
--
-- One row per import; the newest is what the workstation and the client's
-- account show. Keeping the older ones gives us the re-evaluation comparison
-- for free.
--
-- API-mediated (src/app/api/vinnustod/intake, src/app/api/hc/report).

create table if not exists public.hc_reports (
  id           uuid primary key default gen_random_uuid(),
  journey_id   uuid not null references public.hc_journeys(id) on delete cascade,
  client_id    uuid not null,
  report_date  date,
  -- "local" = parsed here, "ai" = read by the model (document left our servers)
  method       text not null default 'local' check (method in ('local','ai')),
  payload      jsonb not null,
  imported_by  text,
  created_at   timestamptz not null default now()
);

create index if not exists hc_reports_journey_idx on public.hc_reports (journey_id, created_at desc);

alter table public.hc_reports enable row level security;
drop policy if exists "hc_reports no client access" on public.hc_reports;
create policy "hc_reports no client access"
  on public.hc_reports for all using (false) with check (false);
