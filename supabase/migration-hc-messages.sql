-- Messages (SMS / email) sent to clients from the nurse workstation.
-- Written by /api/vinnustod/journeys/[id] (action "message"). Idempotent.

create table if not exists hc_messages (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references hc_journeys(id) on delete cascade,
  client_id   uuid not null references auth.users(id) on delete cascade,
  channel     text not null check (channel in ('sms','email')),
  recipient   text not null,
  template    text,
  subject     text,
  body        text not null,
  status      text not null default 'sent' check (status in ('sent','failed','dry-run')),
  error       text,
  provider_id text,
  sent_by     text not null,
  sent_at     timestamptz not null default now()
);
create index if not exists hc_messages_journey_idx on hc_messages(journey_id, sent_at desc);

alter table hc_messages enable row level security;
drop policy if exists "Block client access" on hc_messages;
create policy "Block client access" on hc_messages for all using (false) with check (false);
