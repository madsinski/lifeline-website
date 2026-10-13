-- Queue dismissals: "I have dealt with this, stop showing it to me."
--
-- The "Bíður þín" list is DERIVED from each journey's state, not stored, so
-- there is no row to delete when a coach wants an item gone. This records
-- the dismissal instead, and the derivation filters against it.
--
-- Keyed by (actor, journey, task) on purpose. The task key is part of the
-- key so that dismissing "book a follow-up" does not also hide "the report
-- needs confirming" when the journey moves on — a dismissal is about one
-- piece of work, not about the person. It is per actor because one coach
-- clearing their own list should not clear a colleague's.
--
-- actor_key is text rather than a foreign key because the workstation has
-- two kinds of actor: an hc_worker signed in directly, and a Lifeline staff
-- member acting through one. Both need to dismiss, and neither table can
-- hold a key for the other.

create table if not exists hc_queue_dismissed (
  id          uuid primary key default gen_random_uuid(),
  actor_key   text not null,
  journey_id  uuid not null references hc_journeys(id) on delete cascade,
  task_key    text not null,
  created_at  timestamptz not null default now(),
  unique (actor_key, journey_id, task_key)
);

create index if not exists hc_queue_dismissed_actor_idx
  on hc_queue_dismissed (actor_key);

alter table hc_queue_dismissed enable row level security;

-- Everything goes through the API with the service role, as with the rest of
-- the workstation's tables.
drop policy if exists "Block client access" on hc_queue_dismissed;
create policy "Block client access" on hc_queue_dismissed
  for all using (false) with check (false);
