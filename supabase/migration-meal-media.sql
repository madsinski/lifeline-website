-- Keeping a meal's picture honest.
--
-- 110 meals shared 32 stock photos, assigned by loose category, so four
-- different breakfasts showed the same bowl of berries and cottage cheese
-- with smoked salmon showed somebody else's fruit. A picture that is wrong
-- is worse than none: people cook what they see.
--
-- illustration_key is a fingerprint of the name and ingredients the picture
-- was made for. Change the recipe and the fingerprint stops matching, and
-- scripts/hc-gen-meal-media.mjs --check says so and exits non-zero. That is
-- the part that lasts: the image source can change, the staleness check
-- cannot drift.
--
-- Applied manually in the Supabase SQL editor (see AGENTS.md).

alter table meals add column if not exists illustration_key text;
alter table meals add column if not exists illustration_credit text;

comment on column meals.illustration_key is
  'Fingerprint of (name_is, ingredients_is) when the illustration was made. Mismatch = stale, see scripts/hc-gen-meal-media.mjs.';
comment on column meals.illustration_credit is
  'Attribution to display with the image, when its licence requires one. Null for images we generated.';

notify pgrst, 'reload schema';
