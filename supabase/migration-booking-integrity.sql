-- =============================================================
-- Booking integrity hardening (2026-04-21)
--
-- Motivation:
-- Up to now the cancel/refund flow was 4 separate writes from the
-- browser (payments row, body_comp_bookings row, station_slots
-- claim, and sometimes clients.checkin_doctor_addon_paid_at). Any
-- mid-way failure left inconsistent state — the swap-path bug that
-- cancelled a paid Foundational booking without refunding was one
-- symptom. This migration moves the whole sequence into a single
-- SECURITY DEFINER RPC so every caller (client UI, admin UI,
-- future webhook reconciliation) gets the same atomic behaviour.
--
-- Also adds:
--   • targeted station_slot release (by slot id) so we stop
--     bulk-clearing other legitimate claims
--   • partial unique index preventing two succeeded payments for
--     the same booking (defence against double-click double-charge)
-- =============================================================

-- ─── refund_and_cancel_booking: one atomic path for all cancels ────────────
create or replace function public.refund_and_cancel_booking(
  p_booking_id uuid,
  p_include_checkin_addon boolean default false
) returns table(ok boolean, error text, refunded_isk int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.body_comp_bookings%rowtype;
  v_payment_id uuid;
  v_addon_id uuid;
  v_addon_amount int := 0;
  v_refunded int := 0;
  v_is_staff boolean := false;
begin
  if v_uid is null then
    return query select false, 'unauthorized'::text, 0;
    return;
  end if;

  select * into v_booking from public.body_comp_bookings where id = p_booking_id;
  if v_booking.id is null then
    return query select false, 'not_found'::text, 0;
    return;
  end if;

  -- Caller must own the booking or be active staff
  select exists(select 1 from public.staff s where s.id = v_uid and s.active = true) into v_is_staff;
  if v_booking.client_id <> v_uid and not v_is_staff then
    return query select false, 'forbidden'::text, 0;
    return;
  end if;

  -- Idempotent: already cancelled + refunded → treat as success, no double refund
  if v_booking.status = 'cancelled' and v_booking.payment_status = 'refunded' then
    return query select true, null::text, 0;
    return;
  end if;

  -- If there's a succeeded charge, refund it (update the ledger row in place)
  if coalesce(v_booking.amount_isk, 0) > 0 and v_booking.payment_status = 'paid' then
    select id into v_payment_id
      from public.payments
      where related_type = 'body_comp_booking'
        and related_id = p_booking_id
        and status = 'succeeded'
      order by paid_at desc nulls last, created_at desc
      limit 1;
    if v_payment_id is not null then
      update public.payments
        set status = 'refunded', refunded_at = now()
        where id = v_payment_id;
      v_refunded := v_booking.amount_isk;
    end if;
  end if;

  -- Cancel the booking (flip payment_status only if we refunded a charge)
  update public.body_comp_bookings
    set status = 'cancelled',
        payment_status = case
          when v_booking.payment_status = 'paid' then 'refunded'
          else v_booking.payment_status
        end
    where id = p_booking_id;

  -- Release the station_slot claim(s) that pointed at this booking
  update public.station_slots
    set client_id = null, booking_id = null, booked_at = null
    where booking_id = p_booking_id and completed_at is null;

  -- Release the client's doctor_slots claim, if any was tied to this round.
  -- Doctor slots aren't FK-linked to the booking, so we release every active
  -- claim for this client — consistent with how book_doctor_slot enforces
  -- "one active doctor booking per client".
  update public.doctor_slots
    set client_id = null, booking_note = null, booked_at = null
    where client_id = v_booking.client_id and completed_at is null;

  -- Optional: also refund the Check-in doctor add-on (18,500 ISK)
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

grant execute on function public.refund_and_cancel_booking(uuid, boolean) to authenticated;

-- ─── release_station_slot_by_id: targeted release (no bulk) ────────────────
create or replace function public.release_station_slot_by_id(p_slot_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_is_staff boolean := false;
begin
  if v_uid is null then return false; end if;
  select exists(select 1 from public.staff s where s.id = v_uid and s.active = true) into v_is_staff;
  update public.station_slots
    set client_id = null, booking_id = null, booked_at = null
    where id = p_slot_id
      and completed_at is null
      and (client_id = v_uid or v_is_staff);
  return found;
end; $$;

grant execute on function public.release_station_slot_by_id(uuid) to authenticated;

-- ─── Prevent double-succeeded payments per booking ─────────────────────────
-- If handlePay runs twice (double-click, tab duplication, transient retry),
-- the second insert will violate this partial unique index and fail — which
-- is exactly what we want. Existing 'refunded' / 'failed' / 'pending' rows
-- are unaffected.
create unique index if not exists uq_payments_succeeded_per_related
  on public.payments (related_type, related_id)
  where status = 'succeeded' and related_id is not null;
