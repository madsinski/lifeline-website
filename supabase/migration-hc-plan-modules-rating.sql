-- Rating the action library: most effect for the least time.
--
-- Lifeline's method is "mest fyrir minnst", but the library had no way to say
-- which action that actually is, so the model ranked on prose alone. Three
-- dimensions, each 1–5 and each higher-is-better, so they can be shown to a
-- client without explanation:
--
--   effect    how much it tends to move the thing it targets
--   ease      how easily it fits into a normal week (5 = almost no friction)
--   evidence  how good the evidence is that it does what we say
--
-- minutes_per_week keeps the time cost concrete, because "ease" is a feel and
-- fifteen minutes is a fact.
--
-- evidence_grade is deliberately separate and deliberately visible:
--   A  meta-analyses or several consistent RCTs
--   B  RCTs with limits, or strong prospective cohorts
--   C  small trials, mechanistic reasoning or expert consensus
-- A grade of C is not a reason to leave something out — a lot of longevity
-- practice sits there — but it must never be shown as though it were an A.
--
-- The single score is computed in src/lib/hc/rating.ts rather than here, so
-- the weighting can be argued about without a migration.
--
-- Applied: 2026-09-23 (Supabase Management API).

alter table public.hc_plan_modules
  add column if not exists effect            smallint,
  add column if not exists ease              smallint,
  add column if not exists evidence          smallint,
  add column if not exists evidence_grade    text,
  add column if not exists evidence_note     text,
  add column if not exists minutes_per_week  smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hc_plan_modules_rating_range') then
    alter table public.hc_plan_modules
      add constraint hc_plan_modules_rating_range check (
        (effect   is null or effect   between 1 and 5) and
        (ease     is null or ease     between 1 and 5) and
        (evidence is null or evidence between 1 and 5) and
        (evidence_grade is null or evidence_grade in ('A','B','C'))
      );
  end if;
end $$;

comment on column public.hc_plan_modules.effect is '1-5, how much this tends to move what it targets. Higher is better.';
comment on column public.hc_plan_modules.ease is '1-5, how easily it fits a normal week. 5 = almost no friction.';
comment on column public.hc_plan_modules.evidence is '1-5, strength of evidence. See evidence_grade for the letter.';
comment on column public.hc_plan_modules.evidence_grade is 'A = meta-analyses/consistent RCTs, B = RCTs with limits or strong cohorts, C = small trials, mechanism or consensus.';
