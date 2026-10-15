-- The §18(1)(d) withdrawal waiver, as a column rather than only an audit line.
--
-- Söluskilmálar gr. 8 / d-liður 1. mgr. 18. gr. laga nr. 16/2016: a service
-- that starts inside the 14-day cooling-off period is only exempt from
-- withdrawal once fully performed if the consumer asked for it to start at
-- once and acknowledged that. Until now the tick was recorded only in
-- hc_audit.detail. These columns put the server's own timestamp of that tick
-- on the purchase itself, so "did this customer waive?" is one lookup.
--
-- Written by:
--   src/app/api/hc/subscribe/route.ts  (subscriptions.withdrawal_waiver_at)
--   src/app/api/hc/checkout/route.ts   (hc_orders.withdrawal_waiver_at)
--
-- Always server time (now() on the server), never a time sent by the browser.
-- The routes keep writing the hc_audit line as well. If this migration has not
-- been run, the routes log once and carry on with the audit line only — a
-- purchase is never refused because a column is missing.
--
-- Run manually in the Supabase SQL editor. Idempotent.

alter table public.subscriptions add column if not exists withdrawal_waiver_at timestamptz;
comment on column public.subscriptions.withdrawal_waiver_at is
  'Server time the consumer ticked the §18(1)(d) waiver (laga nr. 16/2016) when starting this subscription. Null = not recorded.';

alter table public.hc_orders add column if not exists withdrawal_waiver_at timestamptz;
comment on column public.hc_orders.withdrawal_waiver_at is
  'Server time the consumer ticked the §18(1)(d) waiver (laga nr. 16/2016) at checkout. Null = not recorded.';
