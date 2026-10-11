-- Fibre for the meal library.
--
-- The Prógrammið sleeve wanted to report fibre against 25–35 g a day and
-- could not: protein, carbs and fat are on all 164 rows and there was no
-- fibre column at all. Showing a 0 g bar would have told every participant
-- their plan fails on fibre, which is a claim about their food we cannot
-- make, so the sleeve said fibre was missing instead. This is the fix.
--
-- ── Where the numbers come from ───────────────────────────────────────
--
-- Computed from each recipe's own ingredient list against a table of fibre
-- per 100 g for the foods that actually appear in it
-- (scripts/meal-fibre.py, which carries the table and the portion weights).
-- It is arithmetic over a documented table, not a guess: the script is in
-- the repo, so any number here can be recomputed and argued with.
--
-- fibre_g is NULL unless the computation covered enough of the recipe.
-- Coverage counts animal products, oils and dairy as known zeros rather
-- than unknowns — chicken contributes no fibre, and that is a fact, not a
-- gap — so a chicken-and-rice dish is fully determined. What leaves a row
-- NULL is an ingredient the table does not know, in enough quantity to
-- matter.
--
-- fibre_coverage records the share of the recipe's weight that was
-- identified, so the UI can say "áætlað" honestly and a later pass can find
-- the weak rows. These are estimates from a recipe, like the macros beside
-- them; they are not a laboratory assay and nothing should present them as
-- one.

alter table meals add column if not exists fibre_g numeric(5,1);
alter table meals add column if not exists fibre_coverage numeric(4,3);

comment on column meals.fibre_g is
  'Estimated dietary fibre in grams per serving, computed from the ingredient list by scripts/meal-fibre.py. NULL where ingredient coverage was too low to stand behind.';
comment on column meals.fibre_coverage is
  'Share of the recipe weight the fibre computation could identify (0–1). Known-zero foods such as meat, eggs, oil and dairy count as identified.';
