-- Retiring a meal without deleting it.
--
-- The meal library is shared with lifeline-app, and meal_log rows reference
-- meals by description and action_key, so deleting a row would orphan real
-- history. A retired meal stays in the table and stays readable by anything
-- that already points at it; it simply stops being offered in new plans.
--
-- Applied manually in the Supabase SQL editor (see AGENTS.md).

alter table meals add column if not exists retired boolean not null default false;

comment on column meals.retired is
  'Excluded from new plans (the /api/hc/library feed) but kept for existing references.';

create index if not exists meals_category_live_idx on meals (category) where retired = false;

notify pgrst, 'reload schema';
