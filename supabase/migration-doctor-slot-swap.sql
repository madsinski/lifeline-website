-- =============================================================
-- change_doctor_slot: atomic swap from one doctor slot to another
--
-- The existing client flow for "change my consultation time" was
-- cancel_doctor_slot → book_doctor_slot. If the new claim failed
-- (slot just taken, RLS blocked, network error), the old claim was
-- already released and now free for anyone else — the user lost
-- their consultation.
--
-- This RPC claims the new slot first, then clears the old only if
-- the claim succeeded. It returns the same shape as book_doctor_slot
-- so the client can reuse its error handling.
-- =============================================================

create or replace function public.change_doctor_slot(
  p_to_slot_id uuid,
  p_note text default null
) returns table(ok boolean, error text, slot_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_client_company uuid;
  v_slot_company uuid;
  v_slot_at timestamptz;
begin
  if v_uid is null then
    return query select false, 'unauthorized'::text, null::timestamptz;
    return;
  end if;

  -- Honor company reservations (same logic as book_doctor_slot)
  select company_id into v_client_company from public.clients where id = v_uid;
  select company_id into v_slot_company from public.doctor_slots where id = p_to_slot_id;
  if v_slot_company is not null and v_slot_company is distinct from v_client_company then
    return query select false, 'company_reserved'::text, null::timestamptz;
    return;
  end if;

  -- Atomic claim of the NEW slot. Only succeeds if it's still open and in the future.
  -- Qualify column refs with the table name: slot_at is also an OUT
  -- parameter on this function (see `returns table(... slot_at ...)`), so
  -- Postgres errors with "column reference slot_at is ambiguous" on any
  -- unqualified use. Same applies to id / client_id / company_id below.
  update public.doctor_slots
    set client_id = v_uid,
        company_id = coalesce(doctor_slots.company_id, v_client_company),
        booking_note = nullif(trim(coalesce(p_note, '')), ''),
        booked_at = now()
    where doctor_slots.id = p_to_slot_id
      and doctor_slots.client_id is null
      and doctor_slots.slot_at > now()
    returning doctor_slots.slot_at into v_slot_at;

  if v_slot_at is null then
    return query select false, 'slot_unavailable'::text, null::timestamptz;
    return;
  end if;

  -- New claim succeeded — now release any OTHER active claim the user holds.
  update public.doctor_slots
    set client_id = null, booking_note = null, booked_at = null
    where doctor_slots.client_id = v_uid
      and doctor_slots.id <> p_to_slot_id
      and doctor_slots.completed_at is null;

  return query select true, null::text, v_slot_at;
end; $$;

grant execute on function public.change_doctor_slot(uuid, text) to authenticated;
