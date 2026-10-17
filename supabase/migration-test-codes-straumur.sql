-- Test codes, the Straumur pending→webhook plumbing, and closing the
-- browser-side "mark it paid" paths. 2026-10-17.
--
-- ── Why ──────────────────────────────────────────────────────────────
--
-- createStraumurCharge was a mock that returned success, so every purchase
-- completed without money moving. It now fails closed. Two things replace
-- it:
--
--   1. hc_test_codes — a pool of internal codes staff generate in
--      /admin/heilsuferd (Prófunarkóðar). A valid code brings the price of
--      one purchase or one subscription period to 0 kr. and the rest of the
--      real flow runs (Medalia code from the pool, emails, journey). The
--      order/subscription is recorded with provider = 'test_code' and
--      provider_reference = the code's id, so reports can tell it apart and
--      accounting never counts it (no payments row is written for it).
--
--   2. straumur_checkouts — one row per Straumur Hosted Checkout session.
--      Nothing is fulfilled when the session is created; the order, the
--      subscription or the add-on only comes into being when a verified
--      webhook (or our own server-to-server status check) says the session
--      was paid. See src/lib/straumur-server.ts and
--      src/app/api/straumur/webhook/route.ts.
--
-- Plus three DB guards for browser writes that could mark something paid:
--   clients.checkin_doctor_addon_paid_at, body_comp_bookings payment
--   columns and payments rows with an amount.
--
-- Idempotent. Apply with:
--   supabase db query --linked -f supabase/migration-test-codes-straumur.sql

-- ── 1. Test codes ───────────────────────────────────────────────────

create table if not exists hc_test_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  -- purchase: anything sold via /api/hc/checkout (and the check-in doctor
  -- add-on); subscription: /api/hc/subscribe; any: both.
  scope         text not null default 'purchase' check (scope in ('purchase', 'subscription', 'any')),
  -- null = any package of that scope. Otherwise an hc_packages key, or
  -- 'checkin-doctor-addon'.
  package_key   text,
  single_use    boolean not null default true,
  -- The last (for a single-use code: the only) use.
  used_by       uuid references auth.users(id) on delete set null,
  used_at       timestamptz,
  used_order_id uuid,
  used_subscription_id uuid,
  use_count     integer not null default 0,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid,
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists hc_test_codes_created_idx on hc_test_codes (created_at desc);

-- Every redemption, including released ones (a purchase that failed after
-- the claim). Multi-use codes are only legible through this.
create table if not exists hc_test_code_uses (
  id              uuid primary key default gen_random_uuid(),
  code_id         uuid not null references hc_test_codes(id) on delete cascade,
  client_id       uuid not null references auth.users(id) on delete cascade,
  target          text not null,          -- package key or 'checkin-doctor-addon'
  order_id        uuid,
  subscription_id uuid,
  used_at         timestamptz not null default now(),
  released_at     timestamptz
);
create index if not exists hc_test_code_uses_code_idx on hc_test_code_uses (code_id);
create index if not exists hc_test_code_uses_client_idx on hc_test_code_uses (client_id, used_at desc);

alter table hc_test_codes enable row level security;
alter table hc_test_code_uses enable row level security;
drop policy if exists "Block client access" on hc_test_codes;
create policy "Block client access" on hc_test_codes for all using (false) with check (false);
drop policy if exists "Block client access" on hc_test_code_uses;
create policy "Block client access" on hc_test_code_uses for all using (false) with check (false);

-- Claim atomically: one UPDATE … WHERE still-usable … RETURNING, so two
-- people pressing at the same moment cannot both spend a single-use code.
-- Returns the use id, or null when the code is not usable for this.
create or replace function public.claim_test_code(p_code text, p_client uuid, p_scope text, p_target text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_use uuid;
begin
  if p_scope not in ('purchase', 'subscription') then
    return null;
  end if;
  update hc_test_codes c
     set used_by = p_client,
         used_at = now(),
         use_count = c.use_count + 1
   where c.code = upper(trim(p_code))
     and c.revoked_at is null
     and (c.expires_at is null or c.expires_at > now())
     and (c.scope = p_scope or c.scope = 'any')
     and (c.package_key is null or c.package_key = p_target)
     and (not c.single_use or c.used_at is null)
  returning c.id into v_id;
  if v_id is null then
    return null;
  end if;
  insert into hc_test_code_uses (code_id, client_id, target)
  values (v_id, p_client, p_target)
  returning id into v_use;
  return v_use;
end;
$$;

-- Undo a claim when the purchase failed after it.
create or replace function public.release_test_code(p_use uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code uuid;
begin
  update hc_test_code_uses set released_at = now()
   where id = p_use and released_at is null and order_id is null and subscription_id is null
  returning code_id into v_code;
  if v_code is null then
    return;
  end if;
  update hc_test_codes c
     set use_count = greatest(0, c.use_count - 1),
         used_at = case when c.single_use then null else c.used_at end,
         used_by = case when c.single_use then null else c.used_by end
   where c.id = v_code;
end;
$$;

revoke all on function public.claim_test_code(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_test_code(uuid) from public, anon, authenticated;
grant execute on function public.claim_test_code(text, uuid, text, text) to service_role;
grant execute on function public.release_test_code(uuid) to service_role;

-- ── 2. Straumur Hosted Checkout sessions ────────────────────────────

create table if not exists straumur_checkouts (
  id                 uuid primary key default gen_random_uuid(),
  -- Our merchant reference, sent as `reference` (max 200 chars at Straumur).
  reference          text not null unique,
  kind               text not null check (kind in ('hc_order', 'subscription', 'checkin_addon')),
  client_id          uuid not null references auth.users(id) on delete cascade,
  amount_isk         integer not null check (amount_isk > 0),
  -- Straumur's session id (checkoutReference) and, once paid, the payment's
  -- payfacReference (what refunds take).
  checkout_reference text unique,
  payfac_reference   text,
  status             text not null default 'pending'
                       check (status in ('pending', 'paid', 'expired', 'failed')),
  -- Everything fulfilment needs, decided and priced on the server at the
  -- moment the session was created. Never from the browser afterwards.
  payload            jsonb not null default '{}'::jsonb,
  last_decline       text,
  paid_at            timestamptz,
  fulfil_started_at  timestamptz,
  fulfilled_at       timestamptz,
  fulfil_error       text,
  order_id           uuid,
  subscription_id    uuid,
  created_at         timestamptz not null default now()
);
create index if not exists straumur_checkouts_client_idx on straumur_checkouts (client_id, created_at desc);
alter table straumur_checkouts enable row level security;
drop policy if exists "Block client access" on straumur_checkouts;
create policy "Block client access" on straumur_checkouts for all using (false) with check (false);

-- Every webhook delivery, verified or not, for tracing; and the
-- idempotency key for the events we act on.
create table if not exists straumur_webhook_events (
  id                uuid primary key default gen_random_uuid(),
  received_at       timestamptz not null default now(),
  correlation_id    text,
  event_type        text,
  checkout_reference text,
  payfac_reference  text,
  merchant_reference text,
  success           text,
  verified          boolean not null default false,
  -- The body minus card data we do not need (masked PAN is dropped).
  body              jsonb
);
create index if not exists straumur_webhook_events_ref_idx on straumur_webhook_events (checkout_reference);
alter table straumur_webhook_events enable row level security;
drop policy if exists "Block client access" on straumur_webhook_events;
create policy "Block client access" on straumur_webhook_events for all using (false) with check (false);

-- ── 3. Subscriptions say how they were paid ────────────────────────

alter table subscriptions add column if not exists provider text;
alter table subscriptions add column if not exists provider_reference text;

-- ── 4. Browser writes that could mark something paid ───────────────

-- 4a. clients.checkin_doctor_addon_paid_at. Written from the browser
-- through clients_decrypted after a client-side "charge" until today. The
-- INSTEAD OF trigger on the view is SECURITY DEFINER, so current_user is
-- the owner there; the caller's JWT role is what tells a client from the
-- server. Clearing it (refund_and_cancel_booking) stays allowed; setting it
-- is for the server (/api/account/checkin-addon) and staff only.
create or replace function public.clients_guard_paid_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') or public.is_active_staff() then
    return new;
  end if;
  if new.checkin_doctor_addon_paid_at is not null
     and new.checkin_doctor_addon_paid_at is distinct from old.checkin_doctor_addon_paid_at then
    raise exception 'clients.checkin_doctor_addon_paid_at is set by the server only' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists clients_guard_paid_columns on public.clients;
create trigger clients_guard_paid_columns
  before update on public.clients
  for each row execute function public.clients_guard_paid_columns();

-- 4b. body_comp_bookings. Clients insert and update their own rows
-- directly (/account/book), and RLS only constrains status — so a client
-- could insert or flip a booking to payment_status 'paid' at any price.
-- Direct client writes run as current_user 'authenticated'; the
-- SECURITY DEFINER RPCs (refund_and_cancel_booking, book_station_slot) and
-- the service role do not, and pass.
create or replace function public.body_comp_bookings_guard_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_price integer;
begin
  if current_user not in ('authenticated', 'anon') or public.is_active_staff() then
    return new;
  end if;
  v_price := case new.package
    when 'foundational' then 49900
    when 'checkin' then 19900
    when 'self-checkin' then 0
    else null end;
  if tg_op = 'INSERT' then
    if v_price is not null and new.amount_isk is distinct from v_price then
      raise exception 'body_comp_bookings.amount_isk must be the package price' using errcode = '42501';
    end if;
    -- Only the free package may arrive already settled.
    if (new.payment_status is distinct from 'pending' or new.paid_at is not null
        or new.payment_reference is not null or new.payment_provider is not null)
       and not (new.package = 'self-checkin' and coalesce(new.amount_isk, 0) = 0) then
      raise exception 'body_comp_bookings payment fields are set by the server only' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.amount_isk is distinct from old.amount_isk or new.package is distinct from old.package then
    raise exception 'body_comp_bookings price and package cannot be changed' using errcode = '42501';
  end if;
  if (new.payment_status is distinct from old.payment_status
      or new.paid_at is distinct from old.paid_at
      or new.payment_reference is distinct from old.payment_reference
      or new.payment_provider is distinct from old.payment_provider)
     and not (old.package = 'self-checkin' and coalesce(old.amount_isk, 0) = 0) then
    raise exception 'body_comp_bookings payment fields are set by the server only' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists body_comp_bookings_guard_payment on public.body_comp_bookings;
create trigger body_comp_bookings_guard_payment
  before insert or update on public.body_comp_bookings
  for each row execute function public.body_comp_bookings_guard_payment();

-- 4c. payments. "client payments insert own" lets a client insert a
-- 'succeeded' row of any amount — a receipt and, in accounting, revenue
-- that never happened. Clients may still record a 0 kr. row (the free
-- self check-in mirrors one); anything with an amount is the server's.
create or replace function public.payments_guard_client_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_active_staff() then
    return new;
  end if;
  if coalesce(new.amount_isk, 0) <> 0 then
    raise exception 'payments with an amount are recorded by the server only' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists payments_guard_client_insert on public.payments;
create trigger payments_guard_client_insert
  before insert or update on public.payments
  for each row execute function public.payments_guard_client_insert();
