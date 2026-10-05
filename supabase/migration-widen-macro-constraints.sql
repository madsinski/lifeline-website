-- Two CHECK constraints that are narrower than the code that writes them.
--
-- Found while porting the app's nutrition module to the web, and confirmed
-- against live data rather than inferred:
--
-- 1. macro_targets.method allowed only 'mifflin' and 'katch_mcardle', but the
--    app's calculateTargets returns 'measured' whenever a Biody scan gives a
--    BMR in range. The writer deactivates the current row and THEN inserts,
--    so the insert failing leaves the user with no active target at all and
--    silently falls back to a hard-coded 2000 kcal / 150 g. The table has 6
--    rows and 0 active, which is exactly that.
--
-- 2. meal_log.source allowed 'planned', 'swap' and 'custom', but the app's
--    "fill the gap" snack button writes 'filler'. Its handler swallows the
--    error, so the button spins and logs nothing.
--
-- Both values are legitimate; the constraints were simply never widened when
-- the features landed. Widening cannot invalidate an existing row.
--
-- Applied manually (see AGENTS.md).

alter table macro_targets drop constraint if exists macro_targets_method_check;
alter table macro_targets add constraint macro_targets_method_check
  check (method = any (array['mifflin', 'katch_mcardle', 'measured']));

alter table meal_log drop constraint if exists meal_log_source_check;
alter table meal_log add constraint meal_log_source_check
  check (source = any (array['planned', 'swap', 'custom', 'filler']));
