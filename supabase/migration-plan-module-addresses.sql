-- Which report rows each action actually targets.
--
-- Until now the only link from an action to the report was its pillar, so
-- every sleep action looked equally relevant to a bad sleep score and the
-- participant had no way to see which one was aimed at THEIR worst number.
-- `addresses` holds the hc_knowledge slugs an action is meant to move, and
-- src/lib/hc/fit.ts turns that plus the report's traffic lights into a
-- personal score.
--
-- Seeded by scripts/hc-seed-addresses.mjs. Applied manually (see AGENTS.md).

alter table hc_plan_modules add column if not exists addresses text[] not null default '{}';

comment on column hc_plan_modules.addresses is
  'hc_knowledge slugs this action is meant to improve. Drives the personal fit score in src/lib/hc/fit.ts.';

notify pgrst, 'reload schema';
