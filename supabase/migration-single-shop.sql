-- Lifeline is the single shop (Mads, 2026-10-16).
--
-- Lifeline sells every product. After payment the client gets a Medalia
-- 100% code from that product's pool (hc_activation_code_pool.kinds =
-- hc_packages.kind, src/lib/hc/code-pool.ts). Medalia's own checkout is
-- only for people who arrive there directly.
--
-- What this does:
--   1. hc_packages.kind may be 'measurement', 'blood_test' or
--      'doctor_interview' — the three parts of the health check sold on
--      their own.
--   2. The three product rows (DO NOTHING if they exist, so later edits are
--      kept): maeling 8.900, blodprufa 17.900, laeknisvidtal 19.900.
--      laeknisvidtal.quota holds the doctor's day:
--      {"doctor_weekday": 3, "slot_minutes": 30} (0 = sunnudagur …
--      6 = laugardagur). 3 = miðvikudagur, the same placeholder as the
--      nurse's service day (coaching-monthly.quota.service_weekday) until
--      Mads names the doctor's day. Code fallback: src/lib/hc/shop.ts.
--   3. The bundle (heilsufarsskodun) goes to 59.900 and lists what is in
--      it: measurement + blood test + doctor interview (46.700 if bought
--      separately) plus the Grunnheilsa report, the questionnaire, the
--      Áætlunarsamtal (bundle only) and the personal plan.
--   4. companies.hc_price_isk / hc_price_locked_until — a company's agreed
--      health-check price, kept until renewal. Backfilled to 49.900 for
--      companies that had an agreement (signed or accepted) or company
--      codes before this change. Checkout uses it when the order uses that
--      company's code (src/app/api/hc/checkout/route.ts).
--   5. hc_bookings: kind 'doctor', order_id + slot_id, and one active
--      booking per paid order and kind (src/app/api/hc/shop/book/route.ts).
--
-- Idempotent. Applied with `supabase db query --linked -f`.

-- 1 ───────────────────────────────────────────────────────────────────────
alter table public.hc_packages drop constraint if exists hc_packages_kind_check;
alter table public.hc_packages add constraint hc_packages_kind_check
  check (kind = any (array['health_check', 'followup_3m', 'reevaluation', 'extra_followup', 'subscription',
                           'measurement', 'blood_test', 'doctor_interview']));

-- 2 ───────────────────────────────────────────────────────────────────────
-- union_category 'none': unions and employers only take part in the bundle.
insert into public.hc_packages (key, kind, name, tagline, description, includes, price_isk, union_category, sort, active)
values
  ('maeling', 'measurement', 'Mæling — líkamssamsetning og blóðþrýstingur',
   'Stök mæling á Lifeline-stöð',
   'Líkamssamsetning og blóðþrýstingur mæld á stöð Lifeline. Þú bókar tíma hér í appinu og niðurstöðurnar eru skráðar í sjúklingagáttina.',
   jsonb_build_array('Mæling á líkamssamsetningu', 'Blóðþrýstingsmæling', 'Niðurstöður í sjúklingagáttinni (Medalia)'),
   8900, 'none', 50, true),
  ('blodprufa', 'blood_test', 'Blóðprufa',
   'Markviss blóðprufa',
   'Blóðprufa með þeim þáttum sem Lifeline notar í heilsufarsskoðuninni. Hún er pöntuð í sjúklingagáttinni þegar þú hefur virkjað kóðann og þú mætir fastandi á rannsóknarstofu.',
   jsonb_build_array('Markvissir blóðþættir', 'Engin tímabókun: mætt fastandi á rannsóknarstofu', 'Niðurstöður í sjúklingagáttinni (Medalia)'),
   17900, 'none', 51, true),
  ('laeknisvidtal', 'doctor_interview', 'Læknisviðtal',
   'Viðtal við lækni á læknadegi',
   'Viðtal við lækni Lifeline. Þú bókar tíma hér á læknadegi vikunnar og viðtalið er haldið og skráð í sjúklingagáttinni.',
   jsonb_build_array('Viðtal við lækni', 'Bókað hér á læknadegi vikunnar', 'Skráð í sjúklingagáttinni (Medalia)'),
   19900, 'none', 52, true)
on conflict (key) do nothing;

update public.hc_packages
   set quota = coalesce(quota, '{}'::jsonb) || '{"doctor_weekday": 3, "slot_minutes": 30}'::jsonb
 where key = 'laeknisvidtal' and (quota is null or not quota ? 'doctor_weekday');

-- 3 ───────────────────────────────────────────────────────────────────────
update public.hc_packages
   set price_isk = 59900,
       description = 'Heildstæð skoðun á svefni, hreyfingu, næringu og andlegri líðan ásamt mælingu, blóðprufu og læknisviðtali. Þú færð Grunnheilsuskýrslu, áætlunarsamtal við hjúkrunarfræðing og persónulega áætlun til þriggja mánaða.',
       includes = jsonb_build_array(
         'Mæling: líkamssamsetning og blóðþrýstingur',
         'Blóðprufa á rannsóknarstofu',
         'Læknisviðtal þar sem farið er yfir niðurstöðurnar',
         'Spurningalisti um svefn, hreyfingu, næringu og andlega líðan',
         'Grunnheilsuskýrsla staðfest af lækni',
         'Áætlunarsamtal við hjúkrunarfræðing (aðeins í pakkanum)',
         'Persónuleg áætlun til þriggja mánaða',
         'Fræðsluefni í appinu'
       ),
       updated_at = now()
 where key = 'heilsufarsskodun' and price_isk = 49900;

-- 4 ───────────────────────────────────────────────────────────────────────
alter table public.companies add column if not exists hc_price_isk integer;
alter table public.companies add column if not exists hc_price_locked_until date;
alter table public.companies drop constraint if exists companies_hc_price_isk_check;
alter table public.companies add constraint companies_hc_price_isk_check check (hc_price_isk is null or hc_price_isk >= 0);
comment on column public.companies.hc_price_isk is
  'Agreed health-check (heilsufarsskodun) price for orders that use this company''s code. Null = list price. Set to 49900 for companies with an agreement or codes before the 59.900 list price (migration-single-shop.sql).';
comment on column public.companies.hc_price_locked_until is
  'Last day hc_price_isk applies (renewal). Null = until changed by staff.';

update public.companies c
   set hc_price_isk = 49900,
       hc_price_locked_until = c.next_renewal_eligible_at::date
 where c.hc_price_isk is null
   and (c.agreement_signed_at is not null
        or c.agreement_accepted_at is not null
        or exists (select 1 from public.b2b_agreements a where a.company_id = c.id)
        or exists (select 1 from public.company_hc_codes h where h.company_id = c.id and h.revoked_at is null));

-- 5 ───────────────────────────────────────────────────────────────────────
alter table public.hc_bookings drop constraint if exists hc_bookings_kind_check;
alter table public.hc_bookings add constraint hc_bookings_kind_check
  check (kind = any (array['video', 'measurement', 'doctor']));
alter table public.hc_bookings add column if not exists order_id uuid references public.hc_orders(id) on delete set null;
alter table public.hc_bookings add column if not exists slot_id uuid;
comment on column public.hc_bookings.order_id is
  'The paid hc_orders row this booking redeems (shop products and the doctor interview of the health check). One active booking per order and kind.';
comment on column public.hc_bookings.slot_id is
  'station_slots.id (kind measurement) or doctor_slots.id (kind doctor) that was claimed for this booking.';
create unique index if not exists hc_bookings_order_active_uq
  on public.hc_bookings (order_id, kind) where order_id is not null and status <> 'cancelled';
