-- When in the day each habit belongs.
--
-- Í dag grouped by pillar — Svefn, Hreyfing, Næring, Andleg líðan — which is
-- how a nurse thinks about a plan and not how anybody lives a day. Nobody
-- wakes up and does "næring". They get up, and later they eat, and later
-- still they go to bed. Grouping by time of day is what Productive and
-- Habitify settled on and it answers the question people actually open the
-- page with, which is "what now".
--
-- Four buckets, and the fourth matters: plenty of habits genuinely have no
-- hour. "Prótein í hverri máltíð" is every meal; "Vatn" is all day. Forcing
-- those into a slot would be a lie that makes the morning list wrong.
--
-- Applied via the Supabase Management API. Idempotent.

alter table hc_plan_modules
  add column if not exists when_of_day text not null default 'anytime';

alter table hc_plan_modules drop constraint if exists hc_plan_modules_when_check;
alter table hc_plan_modules add constraint hc_plan_modules_when_check
  check (when_of_day in ('morning', 'midday', 'evening', 'anytime'));

-- ── The first pass ──────────────────────────────────────────────────────
-- Tagged from what each habit actually is, not from its pillar. Caffeine
-- sits at midday because the rule is a boundary at noon, not a morning
-- action; the bedroom-environment ones sit in the evening because that is
-- when you would change them.

update hc_plan_modules set when_of_day = 'morning' where key in (
  'svefn-fastur-timi', 'svefn-dagsljos', 'naering-protein-morgunmatur', 'andlegt-utivera'
);

update hc_plan_modules set when_of_day = 'midday' where key in (
  'svefn-koffin', 'hreyfing-ganga-eftir-mat', 'hreyfing-kyrrseta', 'andlegt-mork'
);

update hc_plan_modules set when_of_day = 'evening' where key in (
  'svefn-skjalaust', 'svefn-afengi', 'svefn-kvoldmatur', 'svefn-slokun',
  'svefn-birta', 'svefn-hitastig', 'svefn-loftgaedi', 'svefn-lengd', 'svefn-dagbok',
  'naering-snarl-kvold', 'naering-timabil',
  'andlegt-skjar', 'andlegt-thakklaeti'
);

-- Everything else keeps 'anytime': the all-day food habits, the training
-- (which the programme places on its own days), and the referrals.

notify pgrst, 'reload schema';
