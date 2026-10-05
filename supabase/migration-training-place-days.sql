-- The practical half of the training programme.
--
-- The adaptive programme knew the body (level, load, injuries) but nothing
-- about the week it has to fit into: where the person can train, which days
-- they actually have, and how much hard cardio they tolerate. Without that
-- it prescribed a barbell to someone training in a living room and Monday /
-- Wednesday / Friday to someone who works weekends.
--
-- `training_days` is Monday-first 0-6 and is the days they CAN train, which
-- is not the same as hc_training_settings.days (jsonb) — that one is their
-- drag-and-drop arrangement of individual sessions onto weekdays.
--
-- Applied manually (see AGENTS.md).

alter table hc_training_settings add column if not exists place text not null default 'gym';
alter table hc_training_settings add column if not exists cardio text not null default 'full';
alter table hc_training_settings add column if not exists training_days smallint[] not null default '{0,2,4}';

alter table hc_training_settings drop constraint if exists hc_training_settings_place_chk;
alter table hc_training_settings add constraint hc_training_settings_place_chk check (place in ('gym','class','home'));
alter table hc_training_settings drop constraint if exists hc_training_settings_cardio_chk;
alter table hc_training_settings add constraint hc_training_settings_cardio_chk check (cardio in ('full','easy','limited'));

comment on column hc_training_settings.place is 'Where they train: gym | class | home. Picks the equipment the programme assumes.';
comment on column hc_training_settings.cardio is 'How much hard cardio is safe: full | easy | limited. Gates HIIT.';
comment on column hc_training_settings.training_days is 'Weekdays they can train, Monday-first 0-6.';

notify pgrst, 'reload schema';
