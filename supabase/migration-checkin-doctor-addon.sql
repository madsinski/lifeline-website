-- =============================================================
-- Check-in package optional doctor consultation add-on
-- 18,500 ISK, paid separately from the Check-in package itself.
-- Column flips to a timestamp on successful Straumur charge; the
-- client is then allowed to book a doctor_slot for their Check-in
-- round.
-- =============================================================

alter table public.clients
  add column if not exists checkin_doctor_addon_paid_at timestamptz;

create index if not exists idx_clients_checkin_doctor_addon
  on public.clients (checkin_doctor_addon_paid_at)
  where checkin_doctor_addon_paid_at is not null;
