-- The participant's own order for their checklist.
--
-- Í dag lists the plan's modules in the order the nurse composed them, which
-- is a clinical order, not the order somebody does things in the morning.
-- A null sort_index means "wherever the plan put it", so this changes
-- nothing until a row is actually dragged.
--
-- Referenced by src/app/api/hc/actions/route.ts.

alter table hc_action_prefs add column if not exists sort_index integer;

comment on column hc_action_prefs.sort_index is
  'Participant-chosen position within its time-of-day section. Null = keep the plan order.';

-- An optional time of day for a habit.
--
-- The plan says "daglega" and the section says "Morgunn", which is as
-- precise as a nurse should be. A participant who takes something at 07:30
-- can say so; null means they have not, and the row simply shows no time.

alter table hc_action_prefs add column if not exists at_time text;

comment on column hc_action_prefs.at_time is
  'Optional HH:MM the participant chose for this habit. Null = no set time.';
