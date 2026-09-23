-- AI plan proposals made in the workstation. Kept for the audit trail: what
-- the model was shown, what it proposed, which model, and who asked. The
-- nurse edits the proposal before anything reaches the client, and the doctor
-- confirms the report — this table is evidence, not the plan itself.
--
-- API-mediated (src/app/api/vinnustod/journeys/[id]/analyze): service role only.

create table if not exists public.hc_ai_proposals (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references public.hc_journeys(id) on delete cascade,
  client_id   uuid not null,
  input       jsonb not null,
  output      jsonb not null,
  model       text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists hc_ai_proposals_journey_idx on public.hc_ai_proposals (journey_id, created_at desc);

alter table public.hc_ai_proposals enable row level security;
drop policy if exists "hc_ai_proposals no client access" on public.hc_ai_proposals;
create policy "hc_ai_proposals no client access"
  on public.hc_ai_proposals for all using (false) with check (false);
