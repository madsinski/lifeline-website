-- The app subscription, as a product.
--
-- Two things are sold and they are charged differently: the health check is
-- a single fee, and the app -- æfingar, næring, daily follow-up -- is a
-- monthly subscription. Only the first existed as a product. hc_packages
-- held four one-off kinds, the `subscriptions` table was written only by the
-- admin side and the B2B provisioning route, and no journey step anywhere
-- offered the app for sale. The coaching and app-only tracks therefore had
-- no way to pay for the thing they had just chosen.
--
-- A recurring product in the same table as the one-offs, rather than a table
-- of its own: it has a key, a name, a price and what it includes, exactly
-- like the others, and the thing that differs -- that paying it starts a
-- period rather than settles a bill -- belongs in the checkout, not the
-- catalogue. `interval_months` is what says which it is.
--
-- 3.490 kr/month is the figure in the pricing work (premium tier, ~EUR 23).
--
-- Note on reality: createStraumurCharge in src/lib/straumur.ts is still a
-- stub that returns a fake reference. The health-check checkout is in the
-- same position, so the subscription checkout is built to the same shape and
-- becomes real when Straumur does. Nothing here moves money.
--
-- API: /api/hc/subscribe
-- Steps: src/lib/hc/stages.ts ("subscription")

alter table hc_packages drop constraint if exists hc_packages_kind_check;
alter table hc_packages add constraint hc_packages_kind_check
  check (kind = any (array[
    'health_check'::text, 'followup_3m'::text, 'reevaluation'::text,
    'extra_followup'::text, 'subscription'::text
  ]));

alter table hc_packages add column if not exists interval_months smallint;
comment on column hc_packages.interval_months is
  'Null for a one-off. 1 for a monthly subscription — what makes this package recurring.';

insert into hc_packages (key, kind, name, tagline, description, includes, price_isk, interval_months, sort, active)
values (
  'app-monthly', 'subscription', 'Lifeline appið',
  'Æfingar, næring og dagleg eftirfylgd',
  'Áætlunin þín í símanum: æfingaprógramm sem þyngist með þér, máltíðir vikunnar, daglegur gátlisti og fræðsla. Þú getur sagt upp hvenær sem er.',
  -- jsonb, like the other packages' includes.
  jsonb_build_array(
    'Æfingaprógramm sem aðlagast þér',
    'Máltíðir vikunnar og uppskriftir',
    'Daglegur gátlisti og áminningar',
    'Fræðsla um svefn, næringu, hreyfingu og andlega líðan'
  ),
  3490, 1, 10, true
)
on conflict (key) do update set
  kind = excluded.kind, name = excluded.name, tagline = excluded.tagline,
  description = excluded.description, includes = excluded.includes,
  price_isk = excluded.price_isk, interval_months = excluded.interval_months,
  active = excluded.active, updated_at = now();
