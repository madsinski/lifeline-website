-- Employer + union on the same purchase.
-- An employer code can cover the whole price (default), a percentage, or a
-- fixed amount; the member pays the rest and can claim union reimbursement
-- on what they actually paid. Idempotent.

alter table company_hc_codes add column if not exists contribution_percent integer not null default 100
  check (contribution_percent between 0 and 100);
alter table company_hc_codes add column if not exists contribution_isk integer
  check (contribution_isk is null or contribution_isk >= 0);   -- fixed amount; overrides percent when set

alter table hc_orders add column if not exists company_contribution_isk integer not null default 0;

alter table hc_orders drop constraint if exists hc_orders_payment_route_check;
alter table hc_orders add constraint hc_orders_payment_route_check
  check (payment_route in ('self','union','company','company_union'));
