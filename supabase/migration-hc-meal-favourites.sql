-- Meals somebody wants to keep finding.
--
-- The swap library offers eighteen alternatives ranked by how close they
-- come to what they replace. That is the right default and it is useless for
-- "the one I actually like" -- which is the thing a person wants back on a
-- Tuesday evening, and which no amount of ranking will surface because the
-- ranking does not know about it.
--
-- hc_training_settings is the right home: it already owns the participant's
-- own arrangement of the plan -- meal_picks, swaps, drops, the programme key
-- -- and this is one more preference of exactly that kind. A separate table
-- would be a join for an array of ids.
--
-- Ids rather than names: a renamed or re-translated meal keeps its id, and
-- the library's Icelandic names were added in a later pass than the rows.
--
-- API: /api/hc/training (POST meal_favourites)

alter table hc_training_settings add column if not exists meal_favourites uuid[] not null default '{}';

comment on column hc_training_settings.meal_favourites is
  'Meal ids the participant marked as favourites, for filtering the swap library.';
