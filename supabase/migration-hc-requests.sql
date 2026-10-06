-- What the participant asks the coach for.
--
-- Everything in point 7 of the audit is the same shape from both sides: the
-- participant needs something, the coach picks it up. One object with a kind
-- beats five mechanisms — a question, a video call, a new measurement, a
-- change to the programme, an injury. hc_messages is a send log for outbound
-- email and SMS, not a conversation, so it could not carry this.
--
-- body and reply are free text and can describe an injury, so they are
-- encrypted with the same pgcrypto + Vault key as hc_results and messages
-- (migration-encryption-foundation.sql). kind, status and detail stay plain:
-- they are categorical and the queue filters on them.
--
-- Applied manually in the Supabase SQL editor (see AGENTS.md).

create table if not exists public.hc_requests (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references public.hc_journeys(id) on delete cascade,
  client_id   uuid not null,
  kind        text not null check (kind in ('help','appointment','measurement','program','injury')),
  -- Structured choices: which measurements, which pillar, preferred times.
  detail      jsonb not null default '{}'::jsonb,
  body_enc    bytea,
  status      text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  reply_enc   bytea,
  replied_by  text,
  replied_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists hc_requests_journey_idx on public.hc_requests (journey_id, created_at desc);
create index if not exists hc_requests_open_idx    on public.hc_requests (status, created_at) where status in ('open','in_progress');

alter table public.hc_requests enable row level security;
drop policy if exists "Block client access" on public.hc_requests;
create policy "Block client access" on public.hc_requests for all using (false) with check (false);

-- Read and write through the view; the API is the only path.
create or replace view public.hc_requests_decrypted
with (security_invoker = true) as
select id, journey_id, client_id, kind, detail,
       public.decrypt_text(body_enc)  as body,
       status,
       public.decrypt_text(reply_enc) as reply,
       replied_by, replied_at, created_at, updated_at
from public.hc_requests;

revoke all on public.hc_requests_decrypted from public, anon, authenticated;
grant select, insert, update on public.hc_requests_decrypted to service_role;

create or replace function public.hc_requests_ins() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Assign onto NEW, not just into the INSERT: an INSTEAD OF trigger returns
  -- the NEW record, so a caller doing .insert().select() would otherwise get
  -- a null id back for a row that exists.
  new.id := coalesce(new.id, gen_random_uuid());
  new.created_at := coalesce(new.created_at, now());
  insert into public.hc_requests (id, journey_id, client_id, kind, detail, body_enc, status, reply_enc, replied_by, replied_at)
  values (new.id, new.journey_id, new.client_id, new.kind,
          coalesce(new.detail, '{}'::jsonb), public.encrypt_text(new.body),
          coalesce(new.status, 'open'), public.encrypt_text(new.reply), new.replied_by, new.replied_at);
  return new;
end $$;

create or replace function public.hc_requests_upd() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.hc_requests set
    kind = new.kind, detail = coalesce(new.detail, '{}'::jsonb),
    body_enc = public.encrypt_text(new.body), status = new.status,
    reply_enc = public.encrypt_text(new.reply), replied_by = new.replied_by,
    replied_at = new.replied_at, updated_at = now()
  where id = old.id;
  return new;
end $$;

drop trigger if exists hc_requests_ins_trg on public.hc_requests_decrypted;
create trigger hc_requests_ins_trg instead of insert on public.hc_requests_decrypted
  for each row execute function public.hc_requests_ins();
drop trigger if exists hc_requests_upd_trg on public.hc_requests_decrypted;
create trigger hc_requests_upd_trg instead of update on public.hc_requests_decrypted
  for each row execute function public.hc_requests_upd();

notify pgrst, 'reload schema';
