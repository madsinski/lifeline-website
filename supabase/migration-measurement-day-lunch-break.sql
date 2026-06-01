-- =============================================================
-- Measurement-day lunch break + multi-day scheduling support
-- (2026-06-01)
--
-- Adds an optional per-day break window to body_comp_events so the
-- on-site nurse gets a lunch break (default 12:00–13:00) and no
-- employee can book a 5-minute slot inside it.
--
-- Apply manually in the Supabase SQL editor (project
-- cfnibfxzltxiriqxvvru), per the repo convention. Idempotent.
--
-- ⚠️  RECONCILIATION REQUIRED on list_event_slots / book_body_comp_slot
--     -----------------------------------------------------------------
--     These two RPCs already exist in the live DB but their source is
--     NOT checked into this repo (they were authored directly in the
--     SQL editor). The list_event_slots body below is RECONSTRUCTED
--     from its call-site contract (src/app/account/welcome/SlotPicker.tsx
--     expects rows of { slot_at timestamptz, booked_count int,
--     is_mine boolean }) and from the booking link table
--     body_comp_event_bookings(slot_at, event_id, client_id) seen in
--     src/app/account/page.tsx.
--
--     Before running the CREATE OR REPLACE below, open your live
--     list_event_slots in the SQL editor and compare. If the live
--     version differs (different booking source, capacity handling,
--     completed-slot logic, etc.), DO NOT replace it wholesale — instead
--     port only the single break-skip predicate, marked
--     "-- ▼▼ BREAK SKIP ▼▼ ... -- ▲▲ BREAK SKIP ▲▲" below, into your
--     live query's WHERE clause.
--
--     The column additions (break_start / break_end) are safe and
--     certain — run those regardless.
-- =============================================================

begin;

-- ── Break window columns ─────────────────────────────────────────────
-- Nullable: NULL break_start/break_end == "no break" (back-compat with
-- every existing row). The app defaults new days to 12:00–13:00 but a
-- scheduler can adjust or clear the window per day.
alter table public.body_comp_events
  add column if not exists break_start time,
  add column if not exists break_end   time;

-- ── list_event_slots — RECONSTRUCTED, see reconciliation note above ──
-- Generates the bookable 5-minute slots for an event, skipping any slot
-- that starts inside the [break_start, break_end) window, and reports
-- how many people have booked each slot + whether the caller has.
create or replace function public.list_event_slots(p_event_id uuid)
returns table(slot_at timestamptz, booked_count int, is_mine boolean)
language sql security definer set search_path = public as $$
  with ev as (
    select
      e.id,
      (e.event_date + e.start_time)::timestamptz                 as start_ts,
      (e.event_date + e.end_time)::timestamptz                   as end_ts,
      coalesce(e.slot_minutes, 5)                                as step_min,
      e.break_start,
      e.break_end
    from public.body_comp_events e
    where e.id = p_event_id
  ),
  series as (
    select gs as slot_at
    from ev,
         generate_series(
           ev.start_ts,
           ev.end_ts - make_interval(mins => ev.step_min),
           make_interval(mins => ev.step_min)
         ) as gs
    where
      -- ▼▼ BREAK SKIP ▼▼  (port THIS clause into the live RPC if it differs)
      not (
        ev.break_start is not null
        and ev.break_end is not null
        and (gs at time zone 'UTC')::time >= ev.break_start
        and (gs at time zone 'UTC')::time <  ev.break_end
      )
      -- ▲▲ BREAK SKIP ▲▲
  )
  select
    s.slot_at,
    count(b.client_id)::int                                       as booked_count,
    coalesce(bool_or(b.client_id = auth.uid()), false)            as is_mine
  from series s
  left join public.body_comp_event_bookings b
    on b.event_id = p_event_id
   and b.slot_at  = s.slot_at
  group by s.slot_at
  order by s.slot_at;
$$;

grant execute on function public.list_event_slots(uuid) to authenticated;

commit;

-- ── OPTIONAL server-side hard guard in book_body_comp_slot ───────────
-- list_event_slots above already hides break slots from the picker, and
-- the client filters them too, but a hand-crafted RPC call could still
-- aim at a break-window time. Your live book_body_comp_slot is not in
-- this repo, so we do NOT rewrite it here (it owns the capacity check +
-- insert and a blind rewrite would be risky). To close the gap, add the
-- following guard near the top of your live book_body_comp_slot, right
-- after you load the event row:
--
--   if v_event.break_start is not null
--      and v_event.break_end is not null
--      and (p_slot_at at time zone 'UTC')::time >= v_event.break_start
--      and (p_slot_at at time zone 'UTC')::time <  v_event.break_end then
--     raise exception 'slot_in_break';
--   end if;
--
-- (SlotPicker maps the raise to a generic message; add a friendlier one
-- if you want.)
