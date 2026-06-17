-- Recurring-overhead lifecycle status (active / paused / cancelled).
--
-- The legacy `active` boolean stays in sync (active = status='active'), so the
-- monthly report accrual — which filters active=true — keeps working unchanged:
-- only 'active' overheads are billed next month. Applied manually. Idempotent.

alter table accounting_overheads
  add column if not exists status text not null default 'active'
    check (status in ('active','paused','cancelled'));

-- Backfill: rows that were already deactivated become 'paused' (recoverable).
update accounting_overheads set status = 'paused'
  where active = false and status = 'active';

notify pgrst, 'reload schema';
