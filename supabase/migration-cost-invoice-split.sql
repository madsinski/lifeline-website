-- Split a cost invoice across several companies (added 2026-06-13).
-- A blood-test / measurement invoice that covers people from multiple
-- companies (e.g. HSU, 102 people) is split into one row per company,
-- each carrying its share of the amount and client count and sharing
-- the same stored PDF. split_group_id links the siblings.
--
-- Apply manually in the Supabase SQL editor. Idempotent.

alter table accounting_expense_invoices add column if not exists split_group_id uuid;
create index if not exists idx_accounting_expense_invoices_split
  on accounting_expense_invoices (split_group_id);
