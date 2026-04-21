-- =============================================================
-- Doctor slots: allow reserving a slot for a specific company
--
-- Until now, every slot was effectively open to anyone — the booking
-- RPC stamped company_id from the client's own profile, ignoring
-- whatever company_id the admin had pre-set on the slot. This lets
-- admins carve out slots that only employees of a given company can
-- see and book.
--
-- Changes:
--   1. book_doctor_slot RPC now respects a pre-set company_id:
--        • slot.company_id IS NULL         → any client can book
--        • slot.company_id = client company→ book OK
--        • else                            → 'company_reserved'
--      The RPC no longer *overwrites* the slot's company_id — it
--      only sets it when the slot was previously unclaimed AND
--      unreserved.
--   2. Client read RLS hides company-reserved slots from other
--      companies and from personal accounts. Own bookings + staff
--      still see everything.
-- =============================================================

create or replace function public.book_doctor_slot(p_slot_id uuid, p_note text default null)
returns table(ok boolean, error text, slot_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_client_company uuid;
  v_slot_company uuid;
  v_existing uuid;
  v_slot_at timestamptz;
begin
  if v_uid is null then
    return query select false, 'unauthorized'::text, null::timestamptz;
    return;
  end if;

  -- Caller's own company (null for personal accounts)
  select company_id into v_client_company from public.clients where id = v_uid;

  -- The slot's reservation (null = open to anyone)
  select company_id into v_slot_company
  from public.doctor_slots
  where id = p_slot_id;

  -- If the slot is reserved for a specific company, the caller must
  -- belong to it. Otherwise reject.
  if v_slot_company is not null and v_slot_company is distinct from v_client_company then
    return query select false, 'company_reserved'::text, null::timestamptz;
    return;
  end if;

  -- One active booking per client
  select id into v_existing
    from public.doctor_slots
    where client_id = v_uid and completed_at is null;
  if v_existing is not null then
    return query select false, 'already_booked'::text, null::timestamptz;
    return;
  end if;

  update public.doctor_slots
    set client_id = v_uid,
        -- Preserve a pre-set company reservation; only fill it from
        -- the client's own company when the slot was open to anyone.
        company_id = coalesce(company_id, v_client_company),
        booking_note = nullif(trim(coalesce(p_note, '')), ''),
        booked_at = now()
    where id = p_slot_id
      and client_id is null
      and slot_at > now()
    returning doctor_slots.slot_at into v_slot_at;

  if v_slot_at is null then
    return query select false, 'slot_unavailable'::text, null::timestamptz;
    return;
  end if;

  return query select true, null::text, v_slot_at;
end; $$;

grant execute on function public.book_doctor_slot(uuid, text) to authenticated;

-- ─── Read RLS: hide company-reserved slots from other companies ──
drop policy if exists "clients read doctor slots" on public.doctor_slots;
create policy "clients read doctor slots" on public.doctor_slots
  for select using (
    -- Own bookings are always visible
    client_id = auth.uid()
    -- Unclaimed future slots that are either open to anyone or
    -- reserved for the caller's own company
    or (
      client_id is null
      and slot_at > now()
      and (
        company_id is null
        or company_id = (select company_id from public.clients where id = auth.uid())
      )
    )
    -- Active staff see everything
    or exists (select 1 from public.staff s where s.id = auth.uid() and s.active = true)
  );
