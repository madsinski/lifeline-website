-- Using the app alone, as distinct from using it with a coach.
--
-- 'coach' was carrying two different products. It meant "no health check",
-- which lumped together somebody who wants to set their own programme up and
-- get on with it, and somebody who wants a health coach working with them.
-- Those are different offerings at different prices with different steps --
-- one of them involves another human being -- and they cannot share a column
-- value.
--
--   app   -- on your own. Own plan, own programme, nobody assigned.
--   coach -- with a health coach. Same app, plus the person.
--   b2c   -- the health check: measurements, blood, report, interview.
--
-- Nothing is lost by moving between them: a track change keeps the journey,
-- so habits, streaks and plan history survive somebody deciding they want a
-- coach after a month on their own.
--
-- Existing 'coach' rows stay as they are. Anyone who chose the coaching-only
-- track before this split asked for coaching, which is what 'coach' still
-- means, so there is nothing to migrate.
--
-- Steps: src/lib/hc/stages.ts (APP_TRACK, COACH_TRACK)

alter table hc_journeys drop constraint if exists hc_journeys_entry_check;
alter table hc_journeys add constraint hc_journeys_entry_check
  check (entry = any (array['b2c'::text, 'b2b'::text, 'heilsugaesla'::text, 'coach'::text, 'app'::text]));

comment on column hc_journeys.entry is
  'How this journey began: b2c (self-paid health check), b2b (employer), heilsugaesla (referral), coach (health coaching, no check), app (the app on their own).';
