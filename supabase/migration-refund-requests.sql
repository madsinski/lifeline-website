-- =============================================================
-- Refund-request queue + admin cancel/refund RPC (2026-04-21)
--
-- Up to now the only cancel paths were client-side self-serve (>= 48h)
-- and direct admin intervention via the Payments or Bookings pages.
-- There was no way for a client within the 48-hour window to *ask*
-- for a cancellation (lost job, illness, emergency) — they had to
-- email support, and support had nowhere to track it.
--
-- This migration adds:
--   1. refund_requests table — a queue populated by clients from
--      the dashboard; admins approve / deny with a note.
--   2. admin_cancel_booking(booking_id, reason, refund_isk,
--      include_addon) — full-featured admin-side cancel that
--      supports partial refunds and records an admin note on the
--      booking. Full refund + cancel still routes through the
--      existing refund_and_cancel_booking for idempotency.
-- =============================================================

-- ─── refund_requests ──────────────────────────────────────────────────────
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  booking_id uuid references public.body_comp_bookings(id) on delete set null,
  booking_type text not null default 'body_comp_booking',
  reason text not null,
  -- Amount the client is asking for (ISK). Usually the full amount; admin
  -- can approve partially by setting approved_isk to something smaller.
  requested_isk int not null default 0,
  approved_isk int,
  include_checkin_addon boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','denied','withdrawn')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_refund_requests_status
  on public.refund_requests (status, created_at desc);
create index if not exists idx_refund_requests_client
  on public.refund_requests (client_id, created_at desc);

alter table public.refund_requests enable row level security;

-- Clients can see + insert their own pending requests; can withdraw them.
drop policy if exists "refund requests: client select own" on public.refund_requests;
create policy "refund requests: client select own" on public.refund_requests
  for select using (client_id = auth.uid());

drop policy if exists "refund requests: client insert own" on public.refund_requests;
create policy "refund requests: client insert own" on public.refund_requests
  for insert with check (client_id = auth.uid() and status = 'pending');

drop policy if exists "refund requests: client withdraw own" on public.refund_requests;
create policy "refund requests: client withdraw own" on public.refund_requests
  for update using (client_id = auth.uid() and status = 'pending')
  with check (client_id = auth.uid() and status in ('pending','withdrawn'));

-- Staff sees everything + resolves.
drop policy if exists "refund requests: staff all" on public.refund_requests;
create policy "refund requests: staff all" on public.refund_requests
  for all using (
    exists (select 1 from public.staff s where s.id = auth.uid() and s.active = true)
  ) with check (
    exists (select 1 from public.staff s where s.id = auth.uid() and s.active = true)
  );

-- ─── admin_cancel_booking: full- OR partial-refund with audit trail ───────
--
-- Parameters:
--   p_booking_id         — booking to cancel
--   p_reason             — admin's reason, stored on the booking's notes
--   p_refund_isk         — amount to refund in ISK (0 = cancel, no refund)
--   p_include_checkin_addon — also refund the 18,500 ISK Check-in addon
--
-- Behaviour:
--   • Verifies caller is active staff.
--   • If p_refund_isk = 0 and p_include_checkin_addon = false, just cancels
--     the booking (used for no-show / clinic-initiated cancellations).
--   • If p_refund_isk >= booking amount AND p_include_checkin_addon is
--     as-expected, delegates to refund_and_cancel_booking (full-refund
--     path is already idempotent + consistent).
--   • Partial refund path: marks the original payment refunded (full),
--     then inserts a COMPENSATING row for the withheld portion so the
--     ledger balances correctly for reporting. Slot + doctor release
--     still happen.
-- Returns (ok, error, refunded_isk).
create or replace function public.admin_cancel_booking(
  p_booking_id uuid,
  p_reason text,
  p_refund_isk int default null,
  p_include_checkin_addon boolean default false
) returns table(ok boolean, error text, refunded_isk int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_is_staff boolean := false;
  v_booking public.body_comp_bookings%rowtype;
  v_refund int;
  v_payment record;
  v_refunded int := 0;
  v_addon_amount int := 0;
  v_addon_id uuid;
begin
  if v_uid is null then
    return query select false, 'unauthorized'::text, 0;
    return;
  end if;
  select exists(select 1 from public.staff s where s.id = v_uid and s.active = true) into v_is_staff;
  if not v_is_staff then
    return query select false, 'forbidden'::text, 0;
    return;
  end if;

  select * into v_booking from public.body_comp_bookings where id = p_booking_id;
  if v_booking.id is null then
    return query select false, 'not_found'::text, 0;
    return;
  end if;

  v_refund := coalesce(p_refund_isk, coalesce(v_booking.amount_isk, 0));
  if v_refund < 0 or v_refund > coalesce(v_booking.amount_isk, 0) then
    return query select false, 'invalid_refund_amount'::text, 0;
    return;
  end if;

  -- Full-refund path → reuse the client RPC so behaviour matches exactly.
  if v_refund = coalesce(v_booking.amount_isk, 0) and v_booking.payment_status = 'paid' then
    -- Stamp the reason on the booking before delegating
    update public.body_comp_bookings
      set notes = coalesce(notes || E'\n', '') || 'Admin cancel: ' || coalesce(p_reason, '—')
      where id = p_booking_id;
    return query
      select rc.ok, rc.error, rc.refunded_isk
        from public.refund_and_cancel_booking(p_booking_id, p_include_checkin_addon) rc;
    return;
  end if;

  -- Partial refund OR cancel-without-refund path
  if v_refund > 0 and v_booking.payment_status = 'paid' then
    select id, amount_isk, provider_reference
      into v_payment
      from public.payments
      where related_type = 'body_comp_booking'
        and related_id = p_booking_id
        and status = 'succeeded'
      order by paid_at desc nulls last, created_at desc
      limit 1;
    if v_payment.id is not null then
      -- Mark the full original charge refunded (it's going away)
      update public.payments
        set status = 'refunded', refunded_at = now()
        where id = v_payment.id;
      -- Re-bill the withheld portion as a separate manual-provider row so
      -- the ledger net-effect equals the partial refund we're giving.
      if v_payment.amount_isk > v_refund then
        insert into public.payments (
          owner_type, owner_id, amount_isk, currency, description,
          provider, status, related_type, related_id, paid_at
        ) values (
          'client', v_booking.client_id, v_payment.amount_isk - v_refund, 'ISK',
          'Lifeline Health — partial charge retained (' || coalesce(p_reason, 'admin cancel') || ')',
          'manual', 'succeeded', 'body_comp_booking', p_booking_id, now()
        );
      end if;
      v_refunded := v_refund;
    end if;
  end if;

  update public.body_comp_bookings
    set status = 'cancelled',
        payment_status = case
          when v_booking.payment_status = 'paid' and v_refund > 0 then 'refunded'
          else v_booking.payment_status
        end,
        notes = coalesce(notes || E'\n', '') || 'Admin cancel: ' || coalesce(p_reason, '—')
    where id = p_booking_id;

  update public.station_slots
    set client_id = null, booking_id = null, booked_at = null
    where booking_id = p_booking_id and completed_at is null;

  update public.doctor_slots
    set client_id = null, booking_note = null, booked_at = null
    where client_id = v_booking.client_id and completed_at is null;

  -- Check-in doctor add-on refund, full-only for now
  if p_include_checkin_addon then
    select id, amount_isk into v_addon_id, v_addon_amount
      from public.payments
      where owner_type = 'client'
        and owner_id = v_booking.client_id
        and related_type = 'checkin_doctor_addon'
        and status = 'succeeded'
      order by paid_at desc nulls last, created_at desc
      limit 1;
    if v_addon_id is not null then
      update public.payments
        set status = 'refunded', refunded_at = now()
        where id = v_addon_id;
      update public.clients
        set checkin_doctor_addon_paid_at = null
        where id = v_booking.client_id;
      v_refunded := v_refunded + coalesce(v_addon_amount, 0);
    end if;
  end if;

  return query select true, null::text, v_refunded;
end; $$;

grant execute on function public.admin_cancel_booking(uuid, text, int, boolean) to authenticated;
