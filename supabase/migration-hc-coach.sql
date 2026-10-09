-- The Þjálfari surface: a real message thread, a coach you can see and
-- change, and a monthly allowance for video consultations.
--
-- Why a new table for the thread. hc_messages is an outbound notification
-- log — channel, recipient, template, provider_id — and hc_requests is one
-- question with one reply. Neither is a conversation, and the page needs
-- one. hc_chat is that, encrypted the same way as everything else clinical
-- here: a bytea column written through a _decrypted view with INSTEAD OF
-- triggers, exactly as hc_requests does it.
--
-- Applied via the Supabase Management API. Idempotent.

-- ── 1. A coach a person can actually look at ────────────────────────────
alter table hc_workers add column if not exists bio text;
alter table hc_workers add column if not exists photo_url text;
alter table hc_workers add column if not exists credentials text;
alter table hc_workers add column if not exists specialties text[];
-- Someone at capacity should not appear in the list of coaches to switch to.
alter table hc_workers add column if not exists accepting_clients boolean not null default true;

-- ── 2. Who your coach is, and how many video calls the month holds ──────
-- interviewer_id is who took the intake interview, which is usually the
-- same person but is a record of an event rather than a relationship — a
-- journey can change coach without rewriting who did the interview.
alter table hc_journeys add column if not exists coach_id uuid references hc_workers(id);
alter table hc_journeys add column if not exists coach_changed_at timestamptz;
alter table hc_journeys add column if not exists video_consults_per_month smallint not null default 2;

update hc_journeys
   set coach_id = interviewer_id
 where coach_id is null and interviewer_id is not null;

-- ── 3. The thread ───────────────────────────────────────────────────────
create table if not exists hc_chat (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references hc_journeys(id) on delete cascade,
  client_id uuid not null,
  -- Who wrote it. "coach" covers any worker writing in the thread.
  author_kind text not null check (author_kind in ('client', 'coach')),
  author_id uuid,
  -- Denormalised so an old message still says who sent it after a coach
  -- change, without joining to a worker who may no longer be on the journey.
  author_name text,
  -- A nudge is a coach message the client did not ask for, kept apart so
  -- the thread can show it differently and so nudges can be rate-limited.
  kind text not null default 'message' check (kind in ('message', 'nudge')),
  body_enc bytea not null,
  created_at timestamptz not null default now(),
  read_by_client_at timestamptz,
  read_by_coach_at timestamptz
);

create index if not exists hc_chat_journey_idx on hc_chat (journey_id, created_at desc);
create index if not exists hc_chat_unread_idx on hc_chat (client_id) where read_by_client_at is null;

alter table hc_chat enable row level security;
-- Every read and write goes through the API with the service role, which is
-- the house pattern for clinical tables: the client never queries directly.
drop policy if exists "Block client access" on hc_chat;
create policy "Block client access" on hc_chat for all using (false) with check (false);

create or replace view hc_chat_decrypted as
select id, journey_id, client_id, author_kind, author_id, author_name, kind,
       decrypt_text(body_enc) as body,
       created_at, read_by_client_at, read_by_coach_at
  from hc_chat;

-- Writing plaintext through the view, so no caller has to know the cipher.
create or replace function hc_chat_ins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into hc_chat (id, journey_id, client_id, author_kind, author_id, author_name,
                       kind, body_enc, created_at, read_by_client_at, read_by_coach_at)
  values (coalesce(new.id, gen_random_uuid()), new.journey_id, new.client_id,
          new.author_kind, new.author_id, new.author_name,
          coalesce(new.kind, 'message'), encrypt_text(new.body),
          coalesce(new.created_at, now()), new.read_by_client_at, new.read_by_coach_at);
  return new;
end $$;

drop trigger if exists hc_chat_ins_trg on hc_chat_decrypted;
create trigger hc_chat_ins_trg instead of insert on hc_chat_decrypted
  for each row execute function hc_chat_ins();

create or replace function hc_chat_upd() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update hc_chat set
    body_enc = case when new.body is distinct from old.body then encrypt_text(new.body) else body_enc end,
    read_by_client_at = new.read_by_client_at,
    read_by_coach_at = new.read_by_coach_at
  where id = old.id;
  return new;
end $$;

drop trigger if exists hc_chat_upd_trg on hc_chat_decrypted;
create trigger hc_chat_upd_trg instead of update on hc_chat_decrypted
  for each row execute function hc_chat_upd();

notify pgrst, 'reload schema';

-- ── 4. Repeatable bookings with the coach ───────────────────────────────
--
-- hc_journeys carries blood_test_booked_for, measurements_booked_for,
-- interview_booked_for and followup_booked_for — one slot each, because
-- each is a step of the journey that happens once. A monthly video
-- allowance and a measurement you take again every few weeks are not
-- that shape, so they need a log rather than a column.
create table if not exists hc_bookings (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references hc_journeys(id) on delete cascade,
  client_id uuid not null,
  coach_id uuid references hc_workers(id),
  kind text not null check (kind in ('video', 'measurement', 'vo2max', 'strength')),
  starts_at timestamptz not null,
  minutes smallint not null default 30,
  status text not null default 'booked' check (status in ('booked', 'done', 'cancelled')),
  -- Google Meet, for a video consultation.
  meeting_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hc_bookings_client_idx on hc_bookings (client_id, starts_at desc);
-- The index the monthly allowance is counted on.
create index if not exists hc_bookings_video_idx on hc_bookings (client_id, starts_at)
  where kind = 'video' and status <> 'cancelled';

alter table hc_bookings enable row level security;
drop policy if exists "Block client access" on hc_bookings;
create policy "Block client access" on hc_bookings for all using (false) with check (false);

notify pgrst, 'reload schema';
