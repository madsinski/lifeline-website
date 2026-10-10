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
