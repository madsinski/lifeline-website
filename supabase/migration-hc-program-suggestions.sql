-- A coach suggesting a programme to one person, and that person answering.
--
-- Programmes already have an "everyone" switch: hc_exercise_templates.active
-- and hc_nutrition_templates.active decide what appears in the picker for
-- all coaches and clients. What did not exist was the narrower act — "I
-- think this one suits you" — which is a different thing from publishing it
-- to everybody and needs the person to be able to say no.
--
-- One open suggestion per journey per kind: a coach who suggests a second
-- exercise programme means the first no longer stands, and two live
-- suggestions for the same slot would make the client choose between their
-- coach and their coach.

create table if not exists hc_program_suggestions (
  id            uuid primary key default gen_random_uuid(),
  journey_id    uuid not null references hc_journeys(id) on delete cascade,
  client_id     uuid not null,
  kind          text not null check (kind in ('exercise', 'nutrition')),
  template_key  text not null,
  note          text,
  suggested_by  text not null,
  status        text not null default 'open' check (status in ('open', 'accepted', 'declined', 'superseded')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz
);

-- Only one open suggestion per journey and kind. A new one supersedes the
-- old rather than stacking, which the API does before inserting.
create unique index if not exists hc_program_suggestions_open_idx
  on hc_program_suggestions (journey_id, kind)
  where status = 'open';

create index if not exists hc_program_suggestions_client_idx
  on hc_program_suggestions (client_id, status);

alter table hc_program_suggestions enable row level security;

-- API-mediated, like the rest of the workstation's tables: the client reads
-- and answers through /api/hc/suggestions, the coach through /api/vinnustod.
drop policy if exists "Block client access" on hc_program_suggestions;
create policy "Block client access" on hc_program_suggestions
  for all using (false) with check (false);
