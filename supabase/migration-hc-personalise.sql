-- Participant personalisation of the plan's programmes (Æfingar / Næring tabs),
-- stored beside the adaptive-programme settings in hc_training_settings:
--   program_key  which exercise programme the days/swaps below were made for
--                (a new programme starts clean)
--   days         session id → weekday (0 = mánudagur … 6 = sunnudagur)
--   hiit_split   HIIT moved out of the strength sessions onto its own days
--   swaps        "<session id>:<item index>" → a library exercise snapshot
--   meal_picks   meal slot → meals.id chosen for "dagurinn þinn"
-- Plus Icelandic names/texts for the exercise and meal libraries.
-- Idempotent.

alter table public.hc_training_settings add column if not exists program_key text;
alter table public.hc_training_settings add column if not exists days jsonb not null default '{}'::jsonb;
alter table public.hc_training_settings add column if not exists hiit_split boolean not null default false;
alter table public.hc_training_settings add column if not exists swaps jsonb not null default '{}'::jsonb;
alter table public.hc_training_settings add column if not exists meal_picks jsonb not null default '{}'::jsonb;
-- Level/load are only meaningful for the adaptive programme; others save without them.
alter table public.hc_training_settings alter column level set default 'beginner';
alter table public.hc_training_settings alter column load_step set default 0;

alter table public.exercises add column if not exists name_is text;
alter table public.exercises add column if not exists instructions_is text[];
alter table public.meals add column if not exists name_is text;
alter table public.meals add column if not exists description_is text;
alter table public.meals add column if not exists ingredients_is text[];
alter table public.meals add column if not exists instructions_is text[];
