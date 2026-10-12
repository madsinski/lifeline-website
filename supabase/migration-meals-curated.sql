-- Room for the curated information that comes with a Lifeline meal.
--
-- The meals table holds what a recipe IS — name, macros, ingredients,
-- steps. The curated list Mads supplied carries a second layer that has no
-- column anywhere: why the meal is in the method, what it is notable for,
-- a tip, a FODMAP note, whether it keeps or freezes, which prep components
-- it uses and makes, and a generative illustration spec.
--
-- That is the part that makes it "the Lifeline method" rather than a
-- recipe list, so it is kept rather than dropped on import. One jsonb
-- column instead of eleven sparse ones: nothing queries these yet, they
-- arrive and leave together as a block, and a surface that wants to show
-- them can read what it needs.
--
-- Shape, as written by scripts/import-lifeline-meals.py:
--   { why, highlights[], tip, fodmap_note, serving_note, keeps_days,
--     meal_prep, freezer, uses_prep[], makes[], illustration{},
--     source_id, source_category }

alter table meals add column if not exists curated jsonb;

comment on column meals.curated is
  'Curated Lifeline-method context for this meal: why it is included, highlights, tip, FODMAP note, keeping/freezing, prep components used and made, and the illustration spec. Written by the meal import; no query depends on its shape.';
