-- Union (stéttarfélag) grant claims — Vestmannaeyjar direct-settlement pilot.
--
-- Written by /api/bookings/grant (see that route). One row per booking:
-- which fund the member declared, what we discounted at checkout, and where
-- the claim stands in the monthly invoice cycle to the fund.
--
-- Kennitala is stored encrypted with the same pgcrypto/Vault mechanism as the
-- rest of the PII in this database (public.encrypt_text / public.decrypt_text
-- from migration-encryption-foundation.sql). No plaintext kennitala column
-- exists here, and the decrypting read is a separate SECURITY DEFINER
-- function so that reading it is an explicit, auditable act.
--
-- Idempotent: safe to re-run.

create table if not exists public.union_grant_claims (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.body_comp_bookings(id) on delete cascade,
  client_id         uuid not null,

  -- Snapshot of the fund as it was at checkout. We keep the name as text
  -- rather than joining a lookup table so a later rename or renegotiation
  -- can't silently rewrite what the member actually agreed to.
  union_code        text not null,
  union_name        text not null,
  settlement        text not null default 'direct'
                      check (settlement in ('direct', 'reimbursement')),

  gross_isk         integer not null check (gross_isk >= 0),
  grant_isk         integer not null default 0 check (grant_isk >= 0),
  net_isk           integer not null check (net_isk >= 0),

  kennitala_enc     bytea,
  kennitala_last4_enc bytea,

  consent_version   text,
  consented_at      timestamptz,

  -- pending  → recorded at checkout, not yet billed to the fund
  -- invoiced → included on a monthly invoice to the fund
  -- settled  → fund paid it
  -- rejected → fund refused the line (we absorb it, per the agreement)
  -- void     → booking cancelled/refunded before we invoiced
  status            text not null default 'pending'
                      check (status in ('pending', 'invoiced', 'settled', 'rejected', 'void')),
  invoice_reference text,
  invoiced_at       timestamptz,
  settled_at        timestamptz,
  rejected_reason   text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One claim per booking. Makes the write in record_union_grant_claim an
-- upsert, so a resumed or double-submitted checkout can't create duplicates
-- that would double-bill the fund.
create unique index if not exists union_grant_claims_booking_uniq
  on public.union_grant_claims (booking_id);

create index if not exists union_grant_claims_status_idx
  on public.union_grant_claims (status, union_code);
create index if not exists union_grant_claims_client_idx
  on public.union_grant_claims (client_id);

alter table public.union_grant_claims enable row level security;

-- API-mediated table: everything goes through supabaseAdmin in the route.
drop policy if exists "Block client access" on public.union_grant_claims;
create policy "Block client access" on public.union_grant_claims
  for all using (false) with check (false);

-- Admin UI reads the claim queue directly (no kennitala — that column is
-- bytea and useless without decrypt_text, which is not granted here).
drop policy if exists "Active staff can read grant claims" on public.union_grant_claims;
create policy "Active staff can read grant claims" on public.union_grant_claims
  for select using (public.is_active_staff());

-- ─── Write path ────────────────────────────────────────────────────────────
-- Called from /api/bookings/grant with the service-role key. client_id is
-- derived from the booking rather than taken from the caller so it can't be
-- spoofed, and the encryption happens inside the database so the application
-- never handles the passphrase.

create or replace function public.record_union_grant_claim(
  p_booking_id      uuid,
  p_union_code      text,
  p_union_name      text,
  p_settlement      text,
  p_gross_isk       integer,
  p_grant_isk       integer,
  p_kennitala       text,
  p_consent_version text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_client_id uuid;
  v_status    text;
  v_id        uuid;
begin
  select client_id, status into v_client_id, v_status
    from public.body_comp_bookings
    where id = p_booking_id;

  if v_client_id is null then
    raise exception 'booking_not_found';
  end if;
  if v_status = 'cancelled' then
    raise exception 'booking_cancelled';
  end if;
  if p_grant_isk > p_gross_isk then
    raise exception 'grant_exceeds_price';
  end if;

  insert into public.union_grant_claims (
    booking_id, client_id, union_code, union_name, settlement,
    gross_isk, grant_isk, net_isk,
    kennitala_enc, kennitala_last4_enc,
    consent_version, consented_at
  ) values (
    p_booking_id, v_client_id, p_union_code, p_union_name,
    coalesce(p_settlement, 'direct'),
    p_gross_isk, coalesce(p_grant_isk, 0), p_gross_isk - coalesce(p_grant_isk, 0),
    public.encrypt_text(p_kennitala),
    public.encrypt_text(right(regexp_replace(coalesce(p_kennitala, ''), '[^0-9]', '', 'g'), 4)),
    p_consent_version, now()
  )
  on conflict (booking_id) do update set
    union_code          = excluded.union_code,
    union_name          = excluded.union_name,
    settlement          = excluded.settlement,
    gross_isk           = excluded.gross_isk,
    grant_isk           = excluded.grant_isk,
    net_isk             = excluded.net_isk,
    kennitala_enc       = excluded.kennitala_enc,
    kennitala_last4_enc = excluded.kennitala_last4_enc,
    consent_version     = excluded.consent_version,
    consented_at        = excluded.consented_at,
    updated_at          = now()
  -- Never rewrite a claim we've already billed the fund for.
  where union_grant_claims.status = 'pending'
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.union_grant_claims where booking_id = p_booking_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_union_grant_claim(uuid, text, text, text, integer, integer, text, text) from public;
grant execute on function public.record_union_grant_claim(uuid, text, text, text, integer, integer, text, text) to service_role;

-- ─── Cancellation ──────────────────────────────────────────────────────────
-- A cancelled or refunded booking must never end up on a fund invoice.
-- Voiding only touches claims we haven't billed yet; an already-invoiced
-- claim is settled with the fund out-of-band so it keeps its status.

create or replace function public.void_union_grant_claim_for_booking(p_booking_id uuid)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.union_grant_claims
    set status = 'void', updated_at = now()
    where booking_id = p_booking_id
      and status = 'pending';
$$;

revoke all on function public.void_union_grant_claim_for_booking(uuid) from public;
grant execute on function public.void_union_grant_claim_for_booking(uuid) to service_role;

-- Belt and braces: if a booking is cancelled by any path (the client's own
-- cancel button, refund_and_cancel_booking, or an admin), void the pending
-- claim with it rather than relying on every caller to remember.
create or replace function public.tg_void_grant_claim_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    update public.union_grant_claims
      set status = 'void', updated_at = now()
      where booking_id = new.id
        and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists void_grant_claim_on_cancel on public.body_comp_bookings;
create trigger void_grant_claim_on_cancel
  after update of status on public.body_comp_bookings
  for each row execute function public.tg_void_grant_claim_on_cancel();

-- ─── Read path for invoicing ───────────────────────────────────────────────
-- The monthly fund invoice is the only place a full kennitala is needed.
-- Kept as its own function so that decrypting is a deliberate call, and so
-- the admin claim list can be read without touching plaintext at all.

create or replace function public.list_union_grant_claims_for_invoice(
  p_union_code text,
  p_from       timestamptz,
  p_to         timestamptz
) returns table (
  claim_id     uuid,
  booking_id   uuid,
  kennitala    text,
  grant_isk    integer,
  net_isk      integer,
  gross_isk    integer,
  service_at   timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select c.id, c.booking_id,
         public.decrypt_text(c.kennitala_enc),
         c.grant_isk, c.net_isk, c.gross_isk,
         b.scheduled_at
    from public.union_grant_claims c
    join public.body_comp_bookings b on b.id = c.booking_id
   where c.union_code = p_union_code
     and c.status = 'pending'
     and c.grant_isk > 0
     and b.status <> 'cancelled'
     and b.payment_status = 'paid'
     and c.created_at >= p_from
     and c.created_at < p_to
   order by c.created_at;
$$;

revoke all on function public.list_union_grant_claims_for_invoice(text, timestamptz, timestamptz) from public;
grant execute on function public.list_union_grant_claims_for_invoice(text, timestamptz, timestamptz) to service_role;
