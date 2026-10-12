-- Discount codes.
--
-- Two products are sold at different cadences — the health check as a single
-- fee, the app as a monthly subscription — so a code has to say which it is
-- for. A launch code for the app is not a code for a 49.900 kr workup.
--
-- ── What the shapes mean ──────────────────────────────────────────────
--
--   percent       value is 0-100, taken off the price
--   amount        value is ISK, taken off the price, never below zero
--   free_months   value is a count of months; the price is zero for that
--                 many periods and normal afterwards. Only meaningful for a
--                 subscription, which the check constraint enforces.
--
-- ── Why redemptions are their own table ──────────────────────────────
--
-- used_count alone cannot answer "has this person already used it", which is
-- the question that stops one launch code becoming a permanent price cut for
-- somebody willing to re-subscribe. The redemption row also says what it was
-- applied to, which is what makes a refund or a dispute answerable later.
--
-- ── Enforcement ──────────────────────────────────────────────────────
--
-- Both tables are API-mediated: the client may neither read nor write them.
-- A code must never be validated in the browser and a discounted amount must
-- never arrive from one — the server looks the code up, computes the price
-- and charges it. /api/hc/discount only ever reports what a code would do;
-- it is /api/hc/subscribe that redeems it.
--
-- Failures are deliberately indistinguishable to the caller: expired, spent,
-- wrong product and never-existed all answer the same way, so the endpoint
-- cannot be used to enumerate which codes are real.
--
-- API: src/app/api/hc/discount/route.ts, src/app/api/hc/subscribe/route.ts

create table if not exists hc_discount_codes (
  code          text primary key,
  kind          text not null check (kind in ('percent', 'amount', 'free_months')),
  value         numeric(10,2) not null check (value > 0),
  applies_to    text not null default 'subscription'
                  check (applies_to in ('subscription', 'health_check', 'both')),
  -- Null is unlimited. 0 would be a code that cannot be used, which is what
  -- `active = false` is for.
  max_uses      integer check (max_uses is null or max_uses > 0),
  used_count    integer not null default 0 check (used_count >= 0),
  max_per_client integer not null default 1 check (max_per_client > 0),
  starts_at     timestamptz,
  expires_at    timestamptz,
  active        boolean not null default true,
  -- Why it exists, for whoever finds it in a year.
  note          text,
  created_at    timestamptz not null default now(),
  -- free_months only makes sense for something with months.
  constraint hc_discount_months_subscription
    check (kind <> 'free_months' or applies_to in ('subscription', 'both')),
  -- A percentage over 100 would be a refund.
  constraint hc_discount_percent_range
    check (kind <> 'percent' or value <= 100)
);

create table if not exists hc_discount_redemptions (
  id           uuid primary key default gen_random_uuid(),
  code         text not null references hc_discount_codes(code) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  applied_to   text not null check (applied_to in ('subscription', 'health_check')),
  -- What it was worth when it was used, because the code's value may change.
  amount_off_isk integer not null default 0,
  months_free  smallint not null default 0,
  redeemed_at  timestamptz not null default now()
);

create index if not exists hc_discount_redemptions_code_idx on hc_discount_redemptions (code);
create index if not exists hc_discount_redemptions_client_idx on hc_discount_redemptions (client_id);

alter table hc_discount_codes enable row level security;
alter table hc_discount_redemptions enable row level security;

-- API-mediated: a client must not be able to read the code list (that is the
-- whole secret) nor write a redemption.
drop policy if exists "Block client access" on hc_discount_codes;
create policy "Block client access" on hc_discount_codes for all using (false) with check (false);
drop policy if exists "Block client access" on hc_discount_redemptions;
create policy "Block client access" on hc_discount_redemptions for all using (false) with check (false);

-- Staff may see and manage codes from the admin app.
drop policy if exists "Staff manage discount codes" on hc_discount_codes;
create policy "Staff manage discount codes" on hc_discount_codes
  for all using (is_active_staff() and not is_active_lawyer())
  with check (is_active_staff() and not is_active_lawyer());
drop policy if exists "Staff read redemptions" on hc_discount_redemptions;
create policy "Staff read redemptions" on hc_discount_redemptions
  for select using (is_active_staff() and not is_active_lawyer());
