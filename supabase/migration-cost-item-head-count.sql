-- Per-company health-check head count override for the expected external
-- debt (Accounting → Financial position).
--
-- The expected external supplier cost of a company's health checks is
-- head_count × rate, per cost line (measurements 2.000/head, blood tests
-- 9.000 Sameind / 12.500 Heilsugæslan per head). The head count normally
-- rolls up from the roster (parent + divisions — employees are listed under
-- the divisions), but some companies were measured/blood-tested before the
-- roster was populated (e.g. Vélaverkstæðið Þór: empty roster, 21 heads from
-- a paid 42.000 measurement invoice). This nullable override pins the count
-- for such cases; null = use the group roster headcount.
--
-- Apply manually in the Supabase SQL editor. Idempotent.

alter table company_cost_item_status
  add column if not exists head_count integer check (head_count >= 0);
