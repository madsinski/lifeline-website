-- Accounting module (admin/business → Accounting tab)
--
-- Monthly P&L is DERIVED, not double-entered:
--   income   = company_invoices issued in month (B2B, invoiced basis)
--            + payments succeeded in month with provider != 'payday'
--              (B2C cards; payday rows are mirrors of company_invoices
--              and would double-count)
--   COGS     = completed station_slots × measurement rate
--            + completed doctor_slots  × doctor-interview rate
--   expenses = uploaded cost invoices (blood tests etc., AI-parsed PDFs)
--            + recurring overheads (ISK or USD × monthly FX)
--            + manual adjustments
--
-- Apply manually in the Supabase SQL editor. Idempotent.

-- ── Per-unit cost rates, date-effective so historical months keep the
--    rate that applied at the time. The blood_test rate is reference
--    only (actual blood-test cost comes from uploaded Sameind invoices);
--    measurement + doctor_interview drive derived COGS.
create table if not exists accounting_cost_rates (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null check (rate_key in ('blood_test', 'measurement', 'doctor_interview')),
  label text not null,
  amount_isk integer not null check (amount_isk >= 0),
  effective_from date not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (rate_key, effective_from)
);

insert into accounting_cost_rates (rate_key, label, amount_isk, effective_from)
values
  ('blood_test',       'Blood test (Sameind)',       9000, '2026-01-01'),
  ('measurement',      'Body measurement',           2000, '2026-01-01'),
  ('doctor_interview', 'Doctor interview (salary)', 14500, '2026-01-01')
on conflict (rate_key, effective_from) do nothing;

-- ── Recurring monthly overheads. ISK items (Medalia seats) use
--    amount_isk; USD-billed SaaS (Vercel, Supabase, Claude, …) use
--    amount_usd and are converted with the month's FX rate.
create table if not exists accounting_overheads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_isk integer check (amount_isk >= 0),
  amount_usd numeric(10,2) check (amount_usd >= 0),
  quantity integer not null default 1 check (quantity >= 1),
  active boolean not null default true,
  effective_from date not null default date_trunc('month', now())::date,
  effective_to date,
  note text,
  created_at timestamptz not null default now(),
  check (amount_isk is not null or amount_usd is not null)
);

-- Seed amounts are observed monthly averages from the Landsbankinn
-- statement (Sep 2025 – Jun 2026). Medalia invoices 18.600 kr. per
-- seat (15.000 + 24% VSK; input VAT not reclaimable — health services
-- are VAT-exempt on sale). Card-billed SaaS settles in ISK, so these
-- are ISK rows; switch any to amount_usd in the UI for FX-exact
-- tracking instead.
insert into accounting_overheads (name, amount_isk, quantity, effective_from, note)
select v.name, v.amount_isk, v.quantity, '2026-06-01'::date, v.note
from (values
  ('Medalia — doctor seats', 18600, 2, 'Per doctor user per month (15.000 + 24% VSK)'),
  ('Claude (Anthropic)',     15600, 1, 'Varies 13.6–25k/mo on statement'),
  ('Payday',                 10044, 1, 'Monthly invoice'),
  ('Typeform',                8100, 1, null),
  ('Google Workspace',        4000, 1, null),
  ('Supabase',                3200, 1, null),
  ('Zoom',                    2900, 1, null),
  ('Vercel',                  2500, 1, null),
  ('Expo (650 Industries)',   2500, 1, null),
  ('Bitwarden',               2500, 1, null),
  ('OpenAI API',              1200, 1, 'Varies with usage'),
  ('Landsbankinn fees',        300, 1, 'Þjónustu- og færslugjöld')
) as v(name, amount_isk, quantity, note)
where not exists (select 1 from accounting_overheads o where o.name = v.name);

-- ── Uploaded cost invoices (PDF in the accounting-invoices bucket,
--    fields AI-extracted then human-confirmed). One invoice can cover a
--    whole month of clients (e.g. Sameind monthly blood-test invoice).
create table if not exists accounting_expense_invoices (
  id uuid primary key default gen_random_uuid(),
  month date not null, -- first day of the accounting month it belongs to
  vendor text,
  description text,
  category text not null default 'other'
    check (category in ('blood_tests', 'measurements', 'doctor', 'saas', 'other')),
  amount_isk integer not null default 0 check (amount_isk >= 0),
  currency text not null default 'ISK',
  amount_original numeric(12,2),
  invoice_number text,
  invoice_date date,
  client_count integer,
  storage_path text,
  content_type text,
  size_bytes integer,
  ai_extracted jsonb,
  ai_confidence text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_accounting_expense_invoices_month
  on accounting_expense_invoices (month);

-- ── Manual one-off corrections per month (extra income or expense the
--    derived numbers miss).
create table if not exists accounting_adjustments (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  kind text not null check (kind in ('income', 'expense')),
  description text not null,
  amount_isk integer not null check (amount_isk >= 0),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_accounting_adjustments_month
  on accounting_adjustments (month);

-- ── Per-company cost attribution (added 2026-06-12): tag a cost
--    invoice or adjustment to a company so the per-company overview
--    can show invoiced vs paid vs outstanding vs costs. Nullable —
--    untagged costs roll up as "Unassigned".
alter table accounting_expense_invoices
  add column if not exists company_id uuid references companies(id) on delete set null;
alter table accounting_adjustments
  add column if not exists company_id uuid references companies(id) on delete set null;

-- ── USD→ISK rate per month. Auto-fetched on first use, manually
--    overridable from the UI.
create table if not exists accounting_fx_rates (
  month date primary key,
  usd_isk numeric(10,4) not null check (usd_isk > 0),
  source text not null default 'open.er-api.com',
  fetched_at timestamptz not null default now()
);

-- ── Log of monthly reports sent to the accounting firm (cron
--    idempotency + audit trail).
create table if not exists accounting_report_runs (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  sent_to text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text,
  triggered_by text not null default 'cron' check (triggered_by in ('cron', 'manual')),
  created_at timestamptz not null default now()
);
create index if not exists idx_accounting_report_runs_month
  on accounting_report_runs (month);

-- ── RLS: API-mediated only (supabaseAdmin), block all client access.
alter table accounting_cost_rates enable row level security;
alter table accounting_overheads enable row level security;
alter table accounting_expense_invoices enable row level security;
alter table accounting_adjustments enable row level security;
alter table accounting_fx_rates enable row level security;
alter table accounting_report_runs enable row level security;

drop policy if exists "Block client access" on accounting_cost_rates;
create policy "Block client access" on accounting_cost_rates for all using (false) with check (false);
drop policy if exists "Block client access" on accounting_overheads;
create policy "Block client access" on accounting_overheads for all using (false) with check (false);
drop policy if exists "Block client access" on accounting_expense_invoices;
create policy "Block client access" on accounting_expense_invoices for all using (false) with check (false);
drop policy if exists "Block client access" on accounting_adjustments;
create policy "Block client access" on accounting_adjustments for all using (false) with check (false);
drop policy if exists "Block client access" on accounting_fx_rates;
create policy "Block client access" on accounting_fx_rates for all using (false) with check (false);
drop policy if exists "Block client access" on accounting_report_runs;
create policy "Block client access" on accounting_report_runs for all using (false) with check (false);

-- ── Private bucket for uploaded cost-invoice PDFs (no public access;
--    the API serves 10-minute signed URLs).
insert into storage.buckets (id, name, public)
values ('accounting-invoices', 'accounting-invoices', false)
on conflict (id) do nothing;
