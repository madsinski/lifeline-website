-- The coaching-only track.
--
-- Every journey so far has run through the health check: pay, get measured,
-- give blood, read the report, talk to a nurse, receive a plan. Somebody who
-- wants the coaching and not the workup had nowhere to go — they hit the
-- package step and stopped, with an app full of surfaces that needed a
-- report they were never going to have.
--
-- entry = 'coach' is that person. The steps are account → upplýsingar →
-- móttökufyrirlestur → their own plan, built from the library by themselves
-- (/api/hc/my-plan, which already existed and already works without a
-- report; it just loses the report-derived suggestions). Æfingar and Næring
-- read hc_training_settings and the meal library, not the report, so they
-- work on day one.
--
-- Nothing is removed. A coaching member can add the health check later,
-- which is a track change rather than a new journey — so their habits,
-- streaks and plan history survive it.
--
-- Steps: src/lib/hc/stages.ts (COACH_TRACK)
-- Switch: POST /api/hc/journey { action: "choose_track", track: "coach" | "check" }

alter table hc_journeys drop constraint if exists hc_journeys_entry_check;
alter table hc_journeys add constraint hc_journeys_entry_check
  check (entry = any (array['b2c'::text, 'b2b'::text, 'heilsugaesla'::text, 'coach'::text]));

comment on column hc_journeys.entry is
  'How this journey began: b2c (self-paid health check), b2b (employer), heilsugaesla (referral), coach (coaching only, no health check).';
