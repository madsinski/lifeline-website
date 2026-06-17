-- Supplier-invoice payment status (outstanding vs paid) on cost invoices.
--
-- One shared column so every surface — the month-by-month breakdown, the
-- Financial-position health-check section, and the companies page — reads the
-- same paid/outstanding state (bilateral by construction). Net position still
-- runs off the derived expected health-check cost; this status is the
-- actual-invoice overlay shown alongside it.
--
-- Existing rows default to 'paid' (historical invoices are assumed settled);
-- the column default is then switched to 'outstanding' so freshly uploaded
-- supplier invoices start unpaid until marked paid. Applied manually. Idempotent.

alter table accounting_expense_invoices
  add column if not exists status text not null default 'paid'
    check (status in ('outstanding','paid'));

alter table accounting_expense_invoices
  alter column status set default 'outstanding';

notify pgrst, 'reload schema';
