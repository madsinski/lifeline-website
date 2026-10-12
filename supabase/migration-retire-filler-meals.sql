-- Retire the 40 filler meals.
--
-- Decided by Mads 2026-10-12. These are macro-only gap entries, not
-- recipes: the name is the whole thing ("Epli + 6 möndlur", "Köld
-- kjúklingabringa, 100 g"). They were already unreachable — is_filler is
-- read in exactly two places, src/lib/hc/compose.ts and
-- src/app/api/hc/library/route.ts, and both exclude it — so this makes the
-- exclusion explicit rather than dependent on a flag nobody reads
-- positively. A later change to is_filler cannot resurrect them on its own.
--
-- Rows are retired, never deleted: see migration-meals-retire.sql for why.
-- Nothing points at these anyway — meal_log records a description and
-- macros rather than a meal_id, action_meals has no rows referencing a
-- filler, and no journey's meal_picks names one. All three were checked
-- before this ran.
--
-- NOTE for whoever considers un-retiring these. Their ingredients_is lines
-- were derived from the meal names by scripts/meal-ingredients-from-name.py
-- and are NOT nutritionist-reviewed; 24 of the 40 were hand-written
-- judgement calls. They are inert on a retired row. If these rows are ever
-- brought back, have the lines reviewed first — on a live row they become
-- dietary content.

update meals
set retired = true
where is_filler = true
  and retired = false;

-- What should be true afterwards: 116 meals offered, 40 retired.
-- select count(*) filter (where retired = false) as offered,
--        count(*) filter (where retired = true)  as retired
-- from meals;
