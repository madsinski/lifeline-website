-- "Lifeline þjálfun" — the coaching tier beside "Lifeline appið".
--
-- Mads, 2026-10-15: app 3.490 kr./mán. (self-service, no staff); coaching
-- 7.990 kr./mán. = the app + a nurse/health coach: messaging, one 20-minute
-- video check-in a month, one on-site measurement every two months.
-- Vestmannaeyjar only to start; the coach works one day a week.
--
-- What this does:
--   1. subscriptions.tier may be 'coaching' (the CHECK only allowed
--      free-trial / self-maintained / premium — a coaching purchase would
--      have failed at insert without this).
--   2. subscriptions.package_key — which hc_packages row was bought.
--   3. hc_packages.quota (jsonb) — the coaching tier's knobs, editable with
--      one UPDATE and no deploy: video_per_month, video_minutes,
--      measurement_every_months, service_weekday (0=sun … 6=lau), region,
--      postcodes. Code fallbacks: src/lib/hc/coaching-config.ts.
--   4. The 'coaching-monthly' package row (DO NOTHING if it exists, so edits
--      made later are kept), at the Vestmannaeyjar location.
--
-- Code: src/lib/hc/coaching.ts, src/lib/hc/coaching-config.ts,
--       src/app/api/hc/subscribe/route.ts, src/app/api/hc/coach/route.ts
--
-- Idempotent. Applied with `supabase db query --linked -f`.

alter table public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table public.subscriptions add constraint subscriptions_tier_check
  check (tier = any (array['free-trial', 'self-maintained', 'premium', 'coaching']));

alter table public.subscriptions add column if not exists package_key text;
comment on column public.subscriptions.package_key is
  'hc_packages.key bought: app-monthly ("Lifeline appið") or coaching-monthly ("Lifeline þjálfun"). Null on rows from before the coaching tier.';

alter table public.hc_packages add column if not exists quota jsonb;
comment on column public.hc_packages.quota is
  'Coaching tier knobs: {video_per_month, video_minutes, measurement_every_months, service_weekday (0=sun..6=sat), region, postcodes[]}. Read by src/lib/hc/coaching-config.ts readQuota().';

insert into public.hc_packages (key, kind, name, tagline, description, includes, price_isk, interval_months, location_id, sort, active, quota)
select
  'coaching-monthly', 'subscription', 'Lifeline þjálfun',
  'Appið og heilsuþjálfi í Vestmannaeyjum',
  'Allt appið, auk hjúkrunarfræðings sem heilsuþjálfa: skilaboð, mánaðarlegt myndsamtal og mælingar á staðnum.',
  '["Allt sem fylgir Lifeline appinu", "Skilaboð við heilsuþjálfa (hjúkrunarfræðing)", "Eitt 20 mínútna myndsamtal á mánuði", "Mæling á staðnum á 2 mánaða fresti", "Skilaboðum er svarað á þjónustudegi vikunnar"]'::jsonb,
  7990, 1,
  (select id from public.hc_locations where slug = 'vestmannaeyjar'),
  (select coalesce(max(sort), 0) + 1 from public.hc_packages),
  true,
  '{"video_per_month": 1, "video_minutes": 20, "measurement_every_months": 2, "service_weekday": 3, "region": "vestmannaeyjar", "postcodes": ["900", "902"]}'::jsonb
on conflict (key) do nothing;
