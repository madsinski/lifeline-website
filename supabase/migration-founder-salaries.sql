-- Founders' salaries, editable month by month (Accounting tab).
--
-- The company budgets a total monthly cost for the two founders' salaries
-- (gross + employer on-costs: pension, tryggingagjald, etc.). It is not the
-- same every month, so each month is stored explicitly. A month with no row
-- counts as 0 (not paying themselves that month) — the default below is only
-- a pre-fill suggestion in the UI, never auto-applied to the P&L.
--
-- Flows into the monthly report's expenses and the Plan tab's burn / runway.
--
-- Apply manually in the Supabase SQL editor. Idempotent.

create table if not exists accounting_founder_salaries (
  month date primary key,                       -- first of month
  amount_isk integer not null check (amount_isk >= 0),
  note text,
  updated_at timestamptz not null default now()
);

alter table accounting_founder_salaries enable row level security;
drop policy if exists "Block client access" on accounting_founder_salaries;
create policy "Block client access" on accounting_founder_salaries
  for all using (false) with check (false);

-- Suggested monthly total (2 founders × 800.000 fully loaded). Pre-fill only.
insert into accounting_settings (key, value_numeric)
values ('founder_salary_default_isk', 1600000)
on conflict (key) do nothing;
