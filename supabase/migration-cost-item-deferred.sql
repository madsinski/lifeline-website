-- Per-company health-check cost line "deferred" flag (Accounting →
-- Financial position).
--
-- A deferred debt line is a real liability we are in no hurry to settle
-- (a supplier we'll pay later, a payment plan). It moves to the Deferred
-- column in the position panel and drops out of the net-position math,
-- exactly like the internal founder-loan defer flags. Orthogonal to
-- status (a line is paid/unpaid AND, separately, deferred or not).
--
-- Apply manually in the Supabase SQL editor. Idempotent.

alter table company_cost_item_status
  add column if not exists deferred boolean not null default false;
