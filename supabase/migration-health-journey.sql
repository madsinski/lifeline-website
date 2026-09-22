-- ═══════════════════════════════════════════════════════════════════════════
-- Heilsuferð — the self-maintained health-check journey (B2C + B2B)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- One flow for everyone: free account → profile → package + checkout
-- (self / union reimbursement / employer code) → activation code → patient
-- portal protocol (blood test at heilsugæsla, measurements at the partner
-- station) → doctor-confirmed report → nurse interview → 3-month action
-- plan → optional 3-month follow-up → re-evaluation after a year.
--
-- Nothing here needs an admin to push a person forward. Steps advance from
-- the customer's own actions, the patient-portal partner API
-- (/api/hc/partner/*) and the nurse workstation (/vinnustod). The only
-- manual clinical step — the doctor confirming the report — is watched by
-- /api/cron/hc-report-escalation, which SMSes the doctor after 5 minutes.
--
-- Every table is API-mediated: RLS on + a blocking policy. All reads and
-- writes go through /api/hc/*, /api/vinnustod/*, /api/admin/hc/* with the
-- service-role client.
--
-- Idempotent. Apply in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ─── Locations ─────────────────────────────────────────────────────────────
create table if not exists hc_locations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  region text,
  blood_test_site text,
  blood_test_address text,
  blood_test_info text,
  measurement_site text,
  measurement_address text,
  measurement_info text,
  interview_site text,
  interview_address text,
  patient_portal_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into hc_locations (slug, name, region, blood_test_site, blood_test_address, blood_test_info,
  measurement_site, measurement_address, measurement_info, interview_site, interview_address, patient_portal_url)
values (
  'vestmannaeyjar', 'Vestmannaeyjar', 'Suðurland',
  'Heilsugæslan í Vestmannaeyjum (HSU)', 'Sólhlíð 10, 900 Vestmannaeyjum',
  'Mættu fastandi frá miðnætti (vatn er í lagi). Bókaðu tíma í gegnum sjúklingagáttina eftir að þú virkjar heilsufarsskoðunina.',
  'Vera lífsgæðasetur', '[heimilisfang Veru]',
  'Blóðþrýstingur, líkamssamsetning og mælingar. Taktu um 20 mínútur frá.',
  'Vera lífsgæðasetur', '[heimilisfang Veru]',
  'https://app.medalia.is/7ca0ca21-8947-46cb-afbd-2e2d15efef6e'
) on conflict (slug) do nothing;

-- ─── Packages ──────────────────────────────────────────────────────────────
create table if not exists hc_packages (
  key text primary key,
  kind text not null check (kind in ('health_check','followup_3m','reevaluation','extra_followup')),
  name text not null,
  tagline text,
  description text,
  includes jsonb not null default '[]'::jsonb,
  price_isk integer not null check (price_isk >= 0),
  location_id uuid references hc_locations(id) on delete set null,  -- null = every location
  union_category text not null default 'health_check',             -- which union rule applies
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into hc_packages (key, kind, name, tagline, description, includes, price_isk, union_category, sort) values
('heilsufarsskodun', 'health_check', 'Heilsufarsskoðun', 'Grunnurinn að betri heilsu',
 'Heildstæð skoðun á svefni, hreyfingu, næringu og andlegri líðan ásamt mælingum og blóðprufu. Þú færð skýrslu staðfesta af lækni, viðtal við hjúkrunarfræðing og aðgerðaáætlun til þriggja mánaða.',
 '["Spurningalisti um svefn, hreyfingu, næringu og andlega líðan","Blóðprufa á Heilsugæslunni","Mælingar: blóðþrýstingur og líkamssamsetning","Skýrsla staðfest af lækni Lifeline","Viðtal við hjúkrunarfræðing","Aðgerðaáætlun til 3 mánaða","Fræðsluefni á aðganginum þínum"]'::jsonb,
 49900, 'health_check', 10),
('eftirfylgd-3m', 'followup_3m', 'Eftirfylgd eftir 3 mánuði', 'Ráðlögð en valfrjáls',
 'Viðtal við hjúkrunarfræðing þremur mánuðum eftir fyrsta viðtal. Farið er yfir árangur og áætlunin uppfærð.',
 '["Eftirfylgdarviðtal við hjúkrunarfræðing","Uppfærð aðgerðaáætlun"]'::jsonb,
 19900, 'followup', 20),
('endurmat-1ar', 'reevaluation', 'Endurmat eftir ár', 'Sjáðu hvað hefur breyst',
 'Ný heilsufarsskoðun ári síðar með samanburði við fyrri niðurstöður.',
 '["Blóðprufa og mælingar","Samanburður við fyrri niðurstöður","Viðtal og ný aðgerðaáætlun"]'::jsonb,
 49900, 'health_check', 30),
('auka-eftirfylgd', 'extra_followup', 'Aukaviðtal við hjúkrunarfræðing', 'Þegar þú vilt meiri stuðning',
 'Stakt eftirfylgdarviðtal til að fara yfir stöðuna og aðlaga áætlunina.',
 '["Viðtal við hjúkrunarfræðing","Uppfærð aðgerðaáætlun"]'::jsonb,
 19900, 'followup', 40)
on conflict (key) do nothing;

-- ─── Unions (stéttarfélög / sjúkrasjóðir) ───────────────────────────────────
-- rules jsonb shape (see src/lib/hc/reimbursement.ts → UnionRules):
--   { categories: { health_check: { percent, max_isk, period_months, min_membership_months, notes },
--                   followup:     { … } },
--     requires_receipt: bool, application_notes: text }
create table if not exists hc_unions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  kennitala text,
  region text,
  website text,
  contact_name text,
  contact_role text,
  contact_email text,
  contact_phone text,
  settlement text not null default 'reimbursement' check (settlement in ('reimbursement','direct')),
  cooperation_status text not null default 'none' check (cooperation_status in ('none','negotiating','approved','paused')),
  rules jsonb not null default '{}'::jsonb,
  rules_summary text,
  rules_verified_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seeded from src/lib/union-grants.ts (Vestmannaeyjar pilot cohort). Rules
-- carry the proposed 25.000 kr. ceiling; nothing is listed at checkout until
-- cooperation_status = 'approved' AND a signed agreement is uploaded.
insert into hc_unions (code, name, region, website, settlement, rules, rules_summary) values
('drifandi', 'Drífandi stéttarfélag', 'Vestmannaeyjar', 'https://www.drifandi.is/sjukrasjodur/', 'reimbursement',
 '{"categories":{"health_check":{"percent":100,"max_isk":25000,"period_months":12,"min_membership_months":6}},"requires_receipt":true}'::jsonb,
 'Greitt félagsgjald í sex af síðustu tólf mánuðum.'),
('jotunn', 'Sjómannafélagið Jötunn', 'Vestmannaeyjar', 'https://sjomannafelag.is/index.php/sjukrasjodur/', 'reimbursement',
 '{"categories":{"health_check":{"percent":100,"max_isk":25000,"period_months":12,"min_membership_months":12}},"requires_receipt":true}'::jsonb,
 'Greitt til sjóðsins síðustu tólf mánuði.'),
('stf-vestmannaeyja', 'Starfsmannafélag Vestmannaeyja', 'Vestmannaeyjar', 'https://www.samband.is/starfsmannafelag-vesmannaeyja', 'reimbursement',
 '{"categories":{"health_check":{"percent":100,"max_isk":25000,"period_months":12}},"requires_receipt":true}'::jsonb, null),
('verdandi', 'Skipstjóra- og stýrimannafélagið Verðandi', 'Vestmannaeyjar', 'https://ssverdandi.is/', 'reimbursement',
 '{"categories":{"health_check":{"percent":100,"max_isk":25000,"period_months":12}},"requires_receipt":true}'::jsonb, null),
('verkstjorafelag-ve', 'Verkstjórafélag Vestmannaeyja', 'Vestmannaeyjar', 'https://lsv.is/um-sjodinn/adildarfelog-lsv/', 'reimbursement',
 '{"categories":{"health_check":{"percent":100,"max_isk":25000,"period_months":12}},"requires_receipt":true}'::jsonb, null)
on conflict (code) do nothing;

create table if not exists hc_union_documents (
  id uuid primary key default gen_random_uuid(),
  union_id uuid not null references hc_unions(id) on delete cascade,
  kind text not null check (kind in ('rules','agreement','other')),
  title text,
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes integer,
  signed_at date,
  signed_by_union text,
  signed_by_lifeline text,
  valid_from date,
  valid_until date,
  extracted_text text,
  extraction jsonb,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists hc_union_documents_union_idx on hc_union_documents(union_id, kind);

-- ─── Journeys ──────────────────────────────────────────────────────────────
create table if not exists hc_journeys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid references hc_locations(id),
  stage text not null default 'account',
  entry text not null default 'b2c' check (entry in ('b2c','b2b','heilsugaesla')),
  company_id uuid,
  profile_completed_at timestamptz,
  welcome_seen_at timestamptz,
  paid_at timestamptz,
  protocol_activated_at timestamptz,
  blood_test_booked_for timestamptz,
  blood_test_done_at timestamptz,
  measurements_booked_for timestamptz,
  measurements_done_at timestamptz,
  blood_results_at timestamptz,
  report_generated_at timestamptz,
  report_generated_by text,
  report_sms_sent_at timestamptz,
  interview_booked_for timestamptz,
  interview_mode text check (interview_mode in ('in_person','video')),
  interviewer_id uuid,
  interview_done_at timestamptz,
  referral_to_heilsugaesla boolean not null default false,
  referral_note text,
  referred_at timestamptz,
  plan_published_at timestamptz,
  followup_booked_for timestamptz,
  followup_done_at timestamptz,
  reevaluation_due_at date,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hc_journeys_client_idx on hc_journeys(client_id, created_at desc);
create index if not exists hc_journeys_stage_idx on hc_journeys(location_id, stage);
create index if not exists hc_journeys_report_watch_idx on hc_journeys(blood_results_at)
  where report_generated_at is null and report_sms_sent_at is null;

-- ─── Company codes (B2B) ───────────────────────────────────────────────────
create table if not exists company_hc_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  member_id uuid,                       -- company_members.id, when tied to one employee
  code text unique not null,
  package_key text not null default 'heilsufarsskodun' references hc_packages(key),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  emailed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists company_hc_codes_company_idx on company_hc_codes(company_id);

-- ─── Orders (every purchase: health check, follow-up, re-evaluation) ───────
create table if not exists hc_orders (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references hc_journeys(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  package_key text not null references hc_packages(key),
  kind text not null,
  price_isk integer not null,
  payment_route text not null check (payment_route in ('self','union','company')),
  union_id uuid references hc_unions(id),
  union_reimbursement_isk integer not null default 0,  -- member claims it back afterwards
  union_direct_grant_isk integer not null default 0,   -- subtracted at checkout (direct settlement)
  company_id uuid,
  company_code_id uuid references company_hc_codes(id),
  amount_charged_isk integer not null default 0,
  provider text,
  provider_reference text,
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded')),
  paid_at timestamptz,
  activation_code text unique,
  activation_redeemed_at timestamptz,
  consent_text text,
  created_at timestamptz not null default now()
);
create index if not exists hc_orders_journey_idx on hc_orders(journey_id);
create index if not exists hc_orders_client_idx on hc_orders(client_id);

-- ─── Union reimbursement claims ────────────────────────────────────────────
create table if not exists hc_union_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references hc_orders(id) on delete cascade,
  union_id uuid not null references hc_unions(id),
  client_id uuid not null references auth.users(id) on delete cascade,
  amount_paid_isk integer not null,
  reimbursable_isk integer not null,
  pdf_path text,
  sent_to text,
  sent_at timestamptz,
  status text not null default 'draft' check (status in ('draft','sent','paid','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists hc_union_claims_order_idx on hc_union_claims(order_id);

-- ─── Account PIN (per trusted device) + calendar feed ──────────────────────
create table if not exists account_pin_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text unique not null,
  pin_hash text not null,
  pin_failures integer not null default 0,
  user_agent text,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists account_pin_devices_user_idx on account_pin_devices(user_id);

create table if not exists account_auth_throttle (
  id bigserial primary key,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists account_auth_throttle_idx on account_auth_throttle(key, at);

create table if not exists account_calendar_feeds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text unique not null,
  created_at timestamptz not null default now()
);

-- ─── Lectures CMS ──────────────────────────────────────────────────────────
create table if not exists hc_lectures (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,
  kind text not null check (kind in ('video','slides','article')),
  video_url text,
  slides jsonb not null default '[]'::jsonb,   -- [{ title, body, image_url }]
  article_md text,
  duration_min integer,
  pillar text check (pillar in ('sleep','exercise','nutrition','mental','general')),
  is_welcome boolean not null default false,
  sort integer not null default 0,
  published boolean not null default false,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hc_lecture_progress (
  client_id uuid not null references auth.users(id) on delete cascade,
  lecture_id uuid not null references hc_lectures(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (client_id, lecture_id)
);

insert into hc_lectures (slug, title, subtitle, kind, article_md, duration_min, pillar, is_welcome, sort, published, slides) values
('velkomin', 'Velkomin í heilsuferðina', 'Hvað gerist næst og hvers vegna', 'slides', null, 4, 'general', true, 0, true,
 '[{"title":"Velkomin","body":"Þú hefur tekið fyrsta skrefið. Hér sérðu hvernig ferlið gengur fyrir sig, skref fyrir skref."},
   {"title":"Fjórar stoðir heilsu","body":"Svefn, hreyfing, næring og andleg líðan. Við skoðum allar fjórar saman, því þær hafa áhrif hver á aðra."},
   {"title":"Mælingar og blóðprufa","body":"Blóðprufa á Heilsugæslunni og mælingar hjá samstarfsaðila okkar gefa mynd af stöðunni í dag."},
   {"title":"Viðtal og áætlun","body":"Hjúkrunarfræðingur fer yfir niðurstöðurnar með þér og saman gerið þið áætlun til þriggja mánaða."},
   {"title":"Þú stýrir ferðinni","body":"Aðgangurinn sýnir alltaf næsta skref. Þú getur farið á þínum hraða og séð hvað er búið."}]'::jsonb),
('svefn-grunnur', 'Svefn: undirstaðan', 'Af hverju svefn skiptir máli', 'article',
 E'## Svefn er ekki lúxus\n\nFlestir fullorðnir þurfa 7–9 klukkustunda svefn. Reglulegur svefntími skiptir jafn miklu máli og lengdin.\n\n## Þrjú atriði til að byrja á\n\n- Farðu á fætur á sama tíma alla daga, líka um helgar.\n- Dragðu úr skjánotkun síðustu klukkustundina fyrir svefn.\n- Hafðu svefnherbergið svalt, dimmt og hljóðlátt.',
 5, 'sleep', false, 10, true, '[]'::jsonb),
('hreyfing-grunnur', 'Hreyfing: byrjaðu þar sem þú ert', 'Lítil skref sem endast', 'article',
 E'## Öll hreyfing telur\n\nMarkmiðið er 150 mínútur af miðlungs ákefð á viku og styrktaræfingar tvisvar í viku. Það má byrja mun minna.\n\n## Góð byrjun\n\n- Rösk ganga í 10 mínútur eftir máltíð.\n- Stigar í stað lyftu.\n- Tvær stuttar styrktaræfingar í viku heima.',
 5, 'exercise', false, 20, true, '[]'::jsonb),
('naering-grunnur', 'Næring: einfaldar breytingar', 'Diskurinn sem leiðarvísir', 'article',
 E'## Diskurinn\n\nHálfur diskur af grænmeti, fjórðungur prótein og fjórðungur trefjaríkt kolvetni.\n\n## Byrjaðu hér\n\n- Prótein í hverri máltíð.\n- Vatn í stað sykraðra drykkja.\n- Skipuleggðu máltíðir vikunnar fyrir fram.',
 5, 'nutrition', false, 30, true, '[]'::jsonb),
('andleg-lidan-grunnur', 'Andleg líðan: streita og hvíld', 'Að finna jafnvægi', 'article',
 E'## Streita er eðlileg\n\nStreita verður vandamál þegar hún er stöðug og hvíldin nær ekki að vega á móti.\n\n## Einföld verkfæri\n\n- Þriggja mínútna öndunaræfing tvisvar á dag.\n- Útivera og dagsbirta á hverjum degi.\n- Tími með fólki sem skiptir þig máli.',
 5, 'mental', false, 40, true, '[]'::jsonb)
on conflict (slug) do nothing;

-- ─── Action-plan library ───────────────────────────────────────────────────
create table if not exists hc_plan_modules (
  key text primary key,
  pillar text not null check (pillar in ('sleep','exercise','nutrition','mental')),
  title text not null,
  summary text not null,
  details text,
  frequency text,
  tags text[] not null default '{}',
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists hc_exercise_templates (
  key text primary key,
  name text not null,
  level text not null check (level in ('beginner','intermediate','advanced')),
  goal text,
  days_per_week integer not null default 3,
  session_minutes integer,
  description text,
  sessions jsonb not null default '[]'::jsonb,  -- [{ day, title, focus, items: [{ name, prescription, note }] }]
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists hc_nutrition_templates (
  key text primary key,
  name text not null,
  goal text,
  description text,
  principles jsonb not null default '[]'::jsonb,   -- ["…"]
  day_example jsonb not null default '[]'::jsonb,  -- [{ meal, example }]
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists hc_plan_templates (
  key text primary key,
  name text not null,
  scenario text,
  description text,
  module_keys text[] not null default '{}',
  exercise_template_key text references hc_exercise_templates(key) on delete set null,
  nutrition_template_key text references hc_nutrition_templates(key) on delete set null,
  focus_pillars text[] not null default '{}',
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists hc_action_plans (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references hc_journeys(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  template_key text,
  headline text,
  summary text,
  goals jsonb not null default '[]'::jsonb,     -- [{ pillar, text }]
  modules jsonb not null default '[]'::jsonb,   -- [{ uid, key, pillar, title, summary, details, frequency, note }]
  exercise jsonb,                               -- copy of an exercise template, editable
  nutrition jsonb,                              -- copy of a nutrition template, editable
  nurse_note text,
  start_date date,
  review_date date,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  version integer not null default 1,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hc_action_plans_journey_uidx on hc_action_plans(journey_id);

-- Seed modules
insert into hc_plan_modules (key, pillar, title, summary, details, frequency, tags, sort) values
('svefn-fastur-timi', 'sleep', 'Fastur fótaferðartími', 'Farðu á fætur á sama tíma alla daga.', 'Líka um helgar. Frávik ekki meira en 30 mínútur. Þetta stillir líkamsklukkuna hraðar en nokkuð annað.', 'Daglega', '{grunnur}', 10),
('svefn-skjalaust', 'sleep', 'Skjálaus síðasta klukkustund', 'Engir skjáir síðustu 60 mínútur fyrir svefn.', 'Hleðslutækið fer út úr svefnherberginu. Bók, teygjur eða róleg tónlist í staðinn.', 'Daglega', '{grunnur}', 20),
('svefn-koffin', 'sleep', 'Koffín fyrir hádegi', 'Síðasti kaffibolli fyrir kl. 12.', 'Koffín hefur áhrif á svefn í 6–8 klukkustundir eftir neyslu.', 'Daglega', '{}', 30),
('svefn-dagbok', 'sleep', 'Svefndagbók í 2 vikur', 'Skráðu háttatíma, fótaferð og líðan.', 'Gefur góða mynd fyrir eftirfylgdarviðtalið.', 'Daglega í 2 vikur', '{svefnvandi}', 40),
('svefn-slokun', 'sleep', 'Slökun fyrir svefn', '10 mínútna slökunarrútína fyrir svefn.', 'Öndun 4-7-8 eða líkamsskönnun. Sama röð á hverju kvöldi.', 'Daglega', '{svefnvandi,streita}', 50),
('hreyfing-ganga', 'exercise', 'Dagleg ganga', 'Rösk 30 mínútna ganga.', 'Má skipta í 3 x 10 mínútur, t.d. eftir hverja máltíð.', '5 sinnum í viku', '{grunnur}', 10),
('hreyfing-styrkur', 'exercise', 'Styrktaræfingar', 'Styrktaræfingar fyrir allan líkamann.', 'Sjá æfingaáætlun. Stórir vöðvahópar, 2–3 sett.', '2–3 sinnum í viku', '{grunnur}', 20),
('hreyfing-kyrrseta', 'exercise', 'Rjúfa kyrrsetu', 'Stattu upp og hreyfðu þig í 2 mínútur á hverri klukkustund.', 'Stilltu áminningu í síma eða úr.', 'Á vinnudögum', '{kyrrseta}', 30),
('hreyfing-thol', 'exercise', 'Þolþjálfun', 'Æfing sem hækkar púlsinn.', 'Hjól, sund, skokk eða brekkuganga. Þú átt að geta talað en ekki sungið.', '2–3 sinnum í viku', '{blodthrystingur,efnaskipti}', 40),
('hreyfing-skref', 'exercise', 'Skrefamarkmið', 'Auka dagleg skref um 2.000 frá núverandi meðaltali.', 'Mældu meðaltal fyrstu vikuna og bættu svo við.', 'Daglega', '{kyrrseta}', 50),
('naering-diskur', 'nutrition', 'Diskaaðferðin', 'Hálfur diskur grænmeti, fjórðungur prótein, fjórðungur kolvetni.', 'Einföld leið til að stilla skammta án þess að vigta.', 'Í aðalmáltíðum', '{grunnur}', 10),
('naering-protein', 'nutrition', 'Prótein í hverri máltíð', '20–30 g prótein í hverri máltíð.', 'Skyr, egg, fiskur, kjúklingur, baunir.', 'Daglega', '{grunnur}', 20),
('naering-sykradir-drykkir', 'nutrition', 'Vatn í stað sykraðra drykkja', 'Skiptu gosi og djús út fyrir vatn eða sódavatn.', null, 'Daglega', '{efnaskipti}', 30),
('naering-salt', 'nutrition', 'Minna salt', 'Minnka unnar vörur og salt við matargerð.', 'Lestu á umbúðir: undir 0,3 g salt í 100 g telst lítið.', 'Daglega', '{blodthrystingur}', 40),
('naering-trefjar', 'nutrition', 'Trefjar og heilkorn', 'Heilkorn, baunir og grænmeti daglega.', 'Markmið 25–35 g trefjar á dag.', 'Daglega', '{efnaskipti,kolesterol}', 50),
('naering-skipulag', 'nutrition', 'Skipulag máltíða', 'Skipuleggðu matseðil vikunnar á sunnudegi.', 'Innkaupalisti út frá matseðlinum.', 'Vikulega', '{grunnur}', 60),
('naering-afengi', 'nutrition', 'Minna áfengi', 'Áfengislausir dagar minnst 5 daga vikunnar.', null, 'Vikulega', '{blodthrystingur,svefnvandi}', 70),
('andlegt-ondun', 'mental', 'Öndunaræfing', '3 mínútna öndunaræfing tvisvar á dag.', 'Anda inn á 4, halda í 4, anda út á 6.', 'Tvisvar á dag', '{streita}', 10),
('andlegt-utivera', 'mental', 'Útivera og dagsbirta', '20 mínútur úti í dagsbirtu.', 'Helst fyrir hádegi. Styður líka við svefninn.', 'Daglega', '{grunnur}', 20),
('andlegt-tengsl', 'mental', 'Tengsl', 'Hittu eða hringdu í einhvern sem skiptir þig máli.', null, 'Vikulega', '{grunnur}', 30),
('andlegt-thakklaeti', 'mental', 'Þrennt gott', 'Skrifaðu niður þrennt sem gekk vel í dag.', 'Tekur 2 mínútur fyrir svefn.', 'Daglega', '{streita}', 40),
('andlegt-mork', 'mental', 'Mörk á vinnutíma', 'Ákveðinn tími þar sem vinnupóstur er lokaður.', 'T.d. enginn vinnupóstur eftir kl. 19.', 'Á vinnudögum', '{streita}', 50)
on conflict (key) do nothing;

-- Seed exercise templates
insert into hc_exercise_templates (key, name, level, goal, days_per_week, session_minutes, description, sessions) values
('byrjandi-heima', 'Byrjandi heima', 'beginner', 'Koma hreyfingu af stað', 3, 30,
 'Engin tæki nauðsynleg. Hentar þeim sem eru að byrja eða byrja aftur.',
 '[{"day":"Mánudagur","title":"Styrkur A","focus":"Allur líkaminn","items":[{"name":"Hnébeygja að stól","prescription":"3 x 10"},{"name":"Armbeygjur við vegg","prescription":"3 x 10"},{"name":"Mjaðmalyfta","prescription":"3 x 12"},{"name":"Planki á hnjám","prescription":"3 x 20 sek"}]},
   {"day":"Miðvikudagur","title":"Ganga","focus":"Þol","items":[{"name":"Rösk ganga","prescription":"30 mín","note":"Á hraða þar sem þú getur talað"}]},
   {"day":"Föstudagur","title":"Styrkur B","focus":"Allur líkaminn","items":[{"name":"Framstig","prescription":"3 x 8 á hvorn fót"},{"name":"Róður með teygju eða vatnsbrúsum","prescription":"3 x 12"},{"name":"Uppstig á tröppu","prescription":"3 x 10 á hvorn fót"},{"name":"Fuglahundur","prescription":"3 x 8 á hvora hlið"}]}]'::jsonb),
('styrkur-likamsraekt', 'Styrkur í líkamsrækt', 'intermediate', 'Byggja upp styrk og vöðvamassa', 3, 50,
 'Þrjár æfingar á viku í tækjasal. Þyngdir auknar þegar öll sett nást.',
 '[{"day":"Mánudagur","title":"Neðri hluti","focus":"Fætur og mjaðmir","items":[{"name":"Hnébeygja","prescription":"4 x 8"},{"name":"Rúmensk réttstöðulyfta","prescription":"3 x 10"},{"name":"Fótapressa","prescription":"3 x 12"},{"name":"Kálfalyftur","prescription":"3 x 15"}]},
   {"day":"Miðvikudagur","title":"Efri hluti","focus":"Brjóst, bak og axlir","items":[{"name":"Bekkpressa","prescription":"4 x 8"},{"name":"Niðurtog","prescription":"3 x 10"},{"name":"Axlapressa með handlóðum","prescription":"3 x 10"},{"name":"Róður í kapli","prescription":"3 x 12"}]},
   {"day":"Föstudagur","title":"Allur líkaminn","focus":"Samsettar æfingar","items":[{"name":"Réttstöðulyfta","prescription":"3 x 6"},{"name":"Upphýfingar eða aðstoð","prescription":"3 x 6–8"},{"name":"Farmer carry","prescription":"4 x 30 m"},{"name":"Planki","prescription":"3 x 45 sek"}]}]'::jsonb),
('thol-og-styrkur', 'Þol og styrkur', 'intermediate', 'Bæta þol, blóðþrýsting og efnaskipti', 4, 40,
 'Tvær þolæfingar og tvær styrktaræfingar á viku.',
 '[{"day":"Mánudagur","title":"Þol","focus":"Jöfn ákefð","items":[{"name":"Hjól, sund eða skokk","prescription":"35 mín","note":"Miðlungs ákefð"}]},
   {"day":"Þriðjudagur","title":"Styrkur","focus":"Allur líkaminn","items":[{"name":"Hnébeygja með lóði","prescription":"3 x 10"},{"name":"Armbeygjur","prescription":"3 x 8–12"},{"name":"Róður","prescription":"3 x 12"},{"name":"Mjaðmalyfta","prescription":"3 x 12"}]},
   {"day":"Fimmtudagur","title":"Lotuþjálfun","focus":"Hærri púls","items":[{"name":"Upphitun","prescription":"10 mín"},{"name":"1 mín hratt / 2 mín rólega","prescription":"6 lotur"},{"name":"Niðurlag","prescription":"5 mín"}]},
   {"day":"Laugardagur","title":"Styrkur og ganga","focus":"Allur líkaminn","items":[{"name":"Framstig","prescription":"3 x 10"},{"name":"Axlapressa","prescription":"3 x 10"},{"name":"Brekkuganga","prescription":"20 mín"}]}]'::jsonb),
('lidvaent', 'Liðvæn hreyfing', 'beginner', 'Hreyfing með litlu álagi á liði', 3, 30,
 'Fyrir þá sem eru með stoðkerfisverki eða í mikilli ofþyngd. Sund, hjól og mildar styrktaræfingar.',
 '[{"day":"Mánudagur","title":"Vatnsleikfimi eða sund","focus":"Þol án álags","items":[{"name":"Sund eða ganga í vatni","prescription":"30 mín"}]},
   {"day":"Miðvikudagur","title":"Mildur styrkur","focus":"Stöðugleiki","items":[{"name":"Setið upp af stól","prescription":"3 x 8"},{"name":"Teygjuróður","prescription":"3 x 12"},{"name":"Mjaðmalyfta","prescription":"3 x 10"},{"name":"Jafnvægi á öðrum fæti við stól","prescription":"3 x 20 sek"}]},
   {"day":"Föstudagur","title":"Hjól","focus":"Þol","items":[{"name":"Þrekhjól","prescription":"25 mín","note":"Létt mótstaða"}]}]'::jsonb)
on conflict (key) do nothing;

-- Seed nutrition templates
insert into hc_nutrition_templates (key, name, goal, description, principles, day_example) values
('jafnvaegi', 'Jafnvægi', 'Almennt heilbrigt mataræði', 'Grunnreglur sem henta flestum.',
 '["Diskaaðferðin í aðalmáltíðum","Prótein í hverri máltíð","Vatn sem aðaldrykkur","Fiskur tvisvar í viku"]'::jsonb,
 '[{"meal":"Morgunmatur","example":"Hafragrautur með berjum og skyri"},{"meal":"Hádegi","example":"Fiskur, kartöflur og stórt salat"},{"meal":"Millimál","example":"Ávöxtur og handfylli af hnetum"},{"meal":"Kvöldmatur","example":"Kjúklingur, heilkornapasta og grænmeti"}]'::jsonb),
('efnaskipti', 'Blóðsykur og efnaskipti', 'Jafnari blóðsykur', 'Fyrir þá sem eru með hækkaðan blóðsykur eða blóðfitur.',
 '["Trefjarík kolvetni í stað hvítra","Prótein og grænmeti fyrst í máltíðinni","Engir sykraðir drykkir","Ganga eftir máltíðir"]'::jsonb,
 '[{"meal":"Morgunmatur","example":"Egg, gróft brauð og tómatar"},{"meal":"Hádegi","example":"Linsubaunasúpa og salat"},{"meal":"Millimál","example":"Hrein jógúrt með hnetum"},{"meal":"Kvöldmatur","example":"Lax, bygg og ofnbakað grænmeti"}]'::jsonb),
('blodthrystingur', 'Hjarta og blóðþrýstingur', 'Minna salt, meira grænmeti', 'Byggt á DASH-mataræðinu.',
 '["Minna salt og unnar vörur","Grænmeti og ávextir í hverri máltíð","Fitulitlar mjólkurvörur","Hófleg áfengisneysla"]'::jsonb,
 '[{"meal":"Morgunmatur","example":"Hafragrautur með banana"},{"meal":"Hádegi","example":"Heimagert salat með kjúklingi og baunum"},{"meal":"Millimál","example":"Gulrætur og hummus"},{"meal":"Kvöldmatur","example":"Þorskur, kartöflur og gufusoðið grænmeti"}]'::jsonb)
on conflict (key) do nothing;

-- Seed plan templates (common scenarios)
insert into hc_plan_templates (key, name, scenario, description, module_keys, exercise_template_key, nutrition_template_key, focus_pillars, sort) values
('almennt', 'Almenn heilsuefling', 'Niðurstöður innan marka', 'Viðhald og smávægilegar úrbætur á öllum stoðum.',
 '{svefn-fastur-timi,hreyfing-ganga,hreyfing-styrkur,naering-diskur,naering-protein,andlegt-utivera}', 'byrjandi-heima', 'jafnvaegi', '{exercise,nutrition}', 10),
('kyrrseta', 'Lítil hreyfing og kyrrseta', 'Lítil dagleg hreyfing, skrifstofustarf', 'Koma hreyfingu inn í daglegt líf.',
 '{hreyfing-kyrrseta,hreyfing-skref,hreyfing-styrkur,naering-skipulag,andlegt-utivera}', 'byrjandi-heima', 'jafnvaegi', '{exercise}', 20),
('blodthrystingur', 'Hækkaður blóðþrýstingur', 'Blóðþrýstingur yfir viðmiðum, lífsstílsþættir', 'Lífsstílsþættir sem hafa áhrif á blóðþrýsting.',
 '{hreyfing-thol,hreyfing-ganga,naering-salt,naering-afengi,svefn-fastur-timi,andlegt-ondun}', 'thol-og-styrkur', 'blodthrystingur', '{exercise,nutrition}', 30),
('efnaskipti', 'Blóðsykur og blóðfitur', 'Hækkaður blóðsykur, HbA1c eða blóðfitur', 'Hreyfing og næring sem styðja við efnaskipti.',
 '{naering-sykradir-drykkir,naering-trefjar,hreyfing-ganga,hreyfing-styrkur,hreyfing-thol,svefn-fastur-timi}', 'thol-og-styrkur', 'efnaskipti', '{nutrition,exercise}', 40),
('thyngd', 'Þyngdarstjórnun', 'Hátt fituhlutfall eða mittismál', 'Varanlegar breytingar á mataræði og hreyfingu.',
 '{naering-diskur,naering-protein,naering-skipulag,hreyfing-styrkur,hreyfing-skref,svefn-fastur-timi}', 'lidvaent', 'jafnvaegi', '{nutrition,exercise}', 50),
('svefn-streita', 'Svefn og streita', 'Svefnvandi, mikil streita eða lítil orka', 'Endurheimt og jafnvægi áður en álag er aukið.',
 '{svefn-fastur-timi,svefn-skjalaust,svefn-slokun,svefn-koffin,andlegt-ondun,andlegt-mork,andlegt-thakklaeti,hreyfing-ganga}', 'byrjandi-heima', 'jafnvaegi', '{sleep,mental}', 60)
on conflict (key) do nothing;

-- ─── Nurse / doctor workstation (/vinnustod) ───────────────────────────────
-- Own auth, NOT Supabase Auth: Vera nurses must never become auth.users in
-- the Lifeline project (a stray "authenticated" RLS policy could let them in).
create table if not exists hc_workers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  phone text,
  organization text not null default 'lifeline' check (organization in ('lifeline','vera','heilsugaesla')),
  role text not null default 'nurse' check (role in ('nurse','doctor','admin')),
  location_ids uuid[] not null default '{}',
  receives_report_sms boolean not null default false,
  password_hash text,
  pin_hash text,
  failed_logins integer not null default 0,
  locked_until timestamptz,
  invite_token_hash text,
  invite_expires_at timestamptz,
  invited_at timestamptz,
  last_login_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists hc_ws_sessions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references hc_workers(id) on delete cascade,
  token_hash text unique not null,
  method text not null,
  user_agent text,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists hc_ws_devices (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references hc_workers(id) on delete cascade,
  token_hash text unique not null,
  pin_failures integer not null default 0,
  user_agent text,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hc_audit (
  id bigserial primary key,
  actor text not null,
  action text not null,
  journey_id uuid,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists hc_audit_journey_idx on hc_audit(journey_id, at desc);

-- ─── Storage buckets ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('union-documents', 'union-documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('hc-claims', 'hc-claims', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('hc-lecture-media', 'hc-lecture-media', true) on conflict (id) do nothing;

-- ─── RLS: API-only ─────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'hc_locations','hc_packages','hc_unions','hc_union_documents','hc_journeys','company_hc_codes','hc_orders',
    'hc_union_claims','account_pin_devices','account_auth_throttle','account_calendar_feeds','hc_lectures',
    'hc_lecture_progress','hc_plan_modules','hc_exercise_templates','hc_nutrition_templates','hc_plan_templates',
    'hc_action_plans','hc_workers','hc_ws_sessions','hc_ws_devices','hc_audit'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "Block client access" on %I', t);
    execute format('create policy "Block client access" on %I for all using (false) with check (false)', t);
  end loop;
end $$;
