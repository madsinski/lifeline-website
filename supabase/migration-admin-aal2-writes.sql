-- Admin AAL2 on browser-side writes.
--
-- The /admin UI writes some tables straight through the anon client (RLS),
-- and is_admin_staff() / is_active_staff() don't look at MFA. A leaked AAL1
-- session token could therefore write these tables directly via PostgREST
-- even though every /api/admin mutation now requires AAL2.
--
-- This migration:
--   1. adds three SECURITY DEFINER helpers that also require aal2 on the JWT
--        is_admin_staff_aal2()   — role admin                     (staff table)
--        is_staff_manager_aal2() — role admin OR manage_team perm  (companies,
--                                  discount_codes; mirrors the admin nav's
--                                  "admin or manage_team sees everything")
--        is_staff_writer_aal2()  — active, not lawyer/medical_advisor
--                                  (scheduling: slots + community events are
--                                  run by coach/nurse/doctor/psychologist)
--   2. splits the staff "FOR ALL" policies into an unchanged read side and an
--      AAL2 write side (INSERT / UPDATE / DELETE).
--
-- SELECT policies are left exactly as they were. Client-facing policies
-- (contact person manages own company, app users create/edit their own
-- community events) are kept; the wide-open "Allow all community_events"
-- policy and the spoofable staff_created=true policies are removed.
--
-- Booking RPCs (book_slot, book_doctor_slot, admin_cancel_booking, …) are
-- SECURITY DEFINER and owned by the table owner, so RLS changes don't affect
-- them. Never inline EXISTS(SELECT FROM staff) in staff policies (recursion):
-- the staff table only uses the SECURITY DEFINER helpers.
--
-- Idempotent. Apply: supabase db query --linked -f supabase/migration-admin-aal2-writes.sql

begin;

-- ── 1. Helpers ────────────────────────────────────────────────────────────

create or replace function public.is_admin_staff_aal2()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_admin_staff() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.is_staff_manager_aal2()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.staff s
        where s.id = auth.uid()
          and s.active = true
          and (s.role = 'admin' or 'manage_team' = any(coalesce(s.permissions, '{}')))
     );
$$;

create or replace function public.is_staff_writer_aal2()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.staff s
        where s.id = auth.uid()
          and s.active = true
          and s.role not in ('lawyer', 'medical_advisor')
     );
$$;

revoke all on function public.is_admin_staff_aal2()   from public, anon;
revoke all on function public.is_staff_manager_aal2() from public, anon;
revoke all on function public.is_staff_writer_aal2()  from public, anon;
grant execute on function public.is_admin_staff_aal2()   to authenticated, service_role;
grant execute on function public.is_staff_manager_aal2() to authenticated, service_role;
grant execute on function public.is_staff_writer_aal2()  to authenticated, service_role;

-- ── 2. staff (admin + AAL2) ───────────────────────────────────────────────
-- Read side unchanged: "Admins can read all staff", "Active staff can view
-- team", own-row policies etc. stay as they are.

drop policy if exists "Admins can manage staff" on public.staff;
drop policy if exists "Admin can manage staff" on public.staff;
drop policy if exists "staff admin insert aal2" on public.staff;
drop policy if exists "staff admin update aal2" on public.staff;
drop policy if exists "staff admin delete aal2" on public.staff;

create policy "staff admin insert aal2" on public.staff
  for insert to authenticated with check (public.is_admin_staff_aal2());
create policy "staff admin update aal2" on public.staff
  for update to authenticated using (public.is_admin_staff_aal2()) with check (public.is_admin_staff_aal2());
create policy "staff admin delete aal2" on public.staff
  for delete to authenticated using (public.is_admin_staff_aal2());

-- ── 3. companies (admin / manage_team + AAL2) ─────────────────────────────

drop policy if exists "staff manage all companies" on public.companies;
drop policy if exists "staff read all companies" on public.companies;
drop policy if exists "staff insert companies aal2" on public.companies;
drop policy if exists "staff update companies aal2" on public.companies;
drop policy if exists "staff delete companies aal2" on public.companies;

create policy "staff read all companies" on public.companies
  for select using (public.is_active_staff());
create policy "staff insert companies aal2" on public.companies
  for insert to authenticated with check (public.is_staff_manager_aal2());
create policy "staff update companies aal2" on public.companies
  for update to authenticated using (public.is_staff_manager_aal2()) with check (public.is_staff_manager_aal2());
create policy "staff delete companies aal2" on public.companies
  for delete to authenticated using (public.is_staff_manager_aal2());
-- kept: "contact manages own company", "employees read own company",
--       "secondary admins read own company"

-- ── 4. discount_codes (admin / manage_team + AAL2) ────────────────────────

drop policy if exists "discount_codes_staff_all" on public.discount_codes;
drop policy if exists "discount_codes_staff_read" on public.discount_codes;
drop policy if exists "discount_codes_staff_insert_aal2" on public.discount_codes;
drop policy if exists "discount_codes_staff_update_aal2" on public.discount_codes;
drop policy if exists "discount_codes_staff_delete_aal2" on public.discount_codes;

create policy "discount_codes_staff_read" on public.discount_codes
  for select using (public.is_active_staff());
create policy "discount_codes_staff_insert_aal2" on public.discount_codes
  for insert to authenticated with check (public.is_staff_manager_aal2());
create policy "discount_codes_staff_update_aal2" on public.discount_codes
  for update to authenticated using (public.is_staff_manager_aal2()) with check (public.is_staff_manager_aal2());
create policy "discount_codes_staff_delete_aal2" on public.discount_codes
  for delete to authenticated using (public.is_staff_manager_aal2());

-- ── 5. Slot tables (write-authorized staff + AAL2) ────────────────────────

-- available_slots
drop policy if exists "staff manage slots" on public.available_slots;
drop policy if exists "staff read slots" on public.available_slots;
drop policy if exists "staff insert slots aal2" on public.available_slots;
drop policy if exists "staff update slots aal2" on public.available_slots;
drop policy if exists "staff delete slots aal2" on public.available_slots;
create policy "staff read slots" on public.available_slots
  for select using (public.is_active_staff());
create policy "staff insert slots aal2" on public.available_slots
  for insert to authenticated with check (public.is_staff_writer_aal2());
create policy "staff update slots aal2" on public.available_slots
  for update to authenticated using (public.is_staff_writer_aal2()) with check (public.is_staff_writer_aal2());
create policy "staff delete slots aal2" on public.available_slots
  for delete to authenticated using (public.is_staff_writer_aal2());

-- station_slots (read side already covered by "clients read station slots",
-- which includes active staff)
drop policy if exists "staff manage station slots" on public.station_slots;
drop policy if exists "staff insert station slots aal2" on public.station_slots;
drop policy if exists "staff update station slots aal2" on public.station_slots;
drop policy if exists "staff delete station slots aal2" on public.station_slots;
create policy "staff insert station slots aal2" on public.station_slots
  for insert to authenticated with check (public.is_staff_writer_aal2());
create policy "staff update station slots aal2" on public.station_slots
  for update to authenticated using (public.is_staff_writer_aal2()) with check (public.is_staff_writer_aal2());
create policy "staff delete station slots aal2" on public.station_slots
  for delete to authenticated using (public.is_staff_writer_aal2());

-- doctor_slots (read side already covered by "clients read doctor slots",
-- which includes active staff)
drop policy if exists "staff manage doctor slots" on public.doctor_slots;
drop policy if exists "staff insert doctor slots aal2" on public.doctor_slots;
drop policy if exists "staff update doctor slots aal2" on public.doctor_slots;
drop policy if exists "staff delete doctor slots aal2" on public.doctor_slots;
create policy "staff insert doctor slots aal2" on public.doctor_slots
  for insert to authenticated with check (public.is_staff_writer_aal2());
create policy "staff update doctor slots aal2" on public.doctor_slots
  for update to authenticated using (public.is_staff_writer_aal2()) with check (public.is_staff_writer_aal2());
create policy "staff delete doctor slots aal2" on public.doctor_slots
  for delete to authenticated using (public.is_staff_writer_aal2());

-- ── 6. community_events ───────────────────────────────────────────────────
-- Before: "Allow all community_events" (FOR ALL USING true) let anyone —
-- including anon — insert/update/delete any event, and "Staff can create
-- events" / "Staff can update events" only checked the client-settable
-- staff_created flag. Now:
--   read   — unchanged ("Anyone can view events")
--   app    — a signed-in user creates / edits / cancels their OWN,
--            non-staff events (lifeline-app createEvent/updateEvent/cancelEvent)
--   staff  — write-authorized staff + AAL2 manage any event (/admin calendar)

drop policy if exists "Allow all community_events" on public.community_events;
drop policy if exists "Staff can create events" on public.community_events;
drop policy if exists "Staff can update events" on public.community_events;
drop policy if exists "Users can create events" on public.community_events;
drop policy if exists "Creators update own events" on public.community_events;
drop policy if exists "staff insert events aal2" on public.community_events;
drop policy if exists "staff update events aal2" on public.community_events;
drop policy if exists "staff delete events aal2" on public.community_events;

create policy "Users can create events" on public.community_events
  for insert to authenticated
  with check (creator_id = auth.uid() and coalesce(staff_created, false) = false);
create policy "Creators update own events" on public.community_events
  for update to authenticated
  using (creator_id = auth.uid() and coalesce(staff_created, false) = false)
  with check (creator_id = auth.uid() and coalesce(staff_created, false) = false);
create policy "staff insert events aal2" on public.community_events
  for insert to authenticated with check (public.is_staff_writer_aal2());
create policy "staff update events aal2" on public.community_events
  for update to authenticated using (public.is_staff_writer_aal2()) with check (public.is_staff_writer_aal2());
create policy "staff delete events aal2" on public.community_events
  for delete to authenticated using (public.is_staff_writer_aal2());

commit;
