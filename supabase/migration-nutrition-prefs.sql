-- What the participant will actually eat, and one nutrition programme.
--
-- Nothing in the system asked about food restrictions. The meal library
-- carries the tags (vegetarian, vegan, gluten-free, dairy-free) and nothing
-- used them as a filter, so a vegetarian was served a lamb casserole.
--
-- And the eight nutrition templates were not eight ways to eat. They were one
-- way — whole food, enough protein, enough fibre, little ultra-processed —
-- with a different dial turned up, and which dial is a question the report
-- already answers (see src/lib/hc/nutrition.ts, emphasisFor). So "jafnvaegi"
-- becomes the core and the rest are deactivated, not deleted: a published
-- plan stores its own copy, so existing plans keep running untouched.
--
-- Applied manually (see AGENTS.md).

alter table hc_training_settings add column if not exists nutrition_prefs jsonb not null default '{}'::jsonb;

comment on column hc_training_settings.nutrition_prefs is
  'What they eat: {diet[], snack, cooking}. Restrictions are a hard filter on the meal library. See src/lib/hc/nutrition.ts.';

update hc_nutrition_templates
   set name = 'Næringin mín',
       goal = 'Heilt fæði, nóg prótein og nógar trefjar — með áherslunni sem skýrslan þín kallar á.',
       description = 'Einn kjarni sem lagar sig að þér. Grunnurinn er sá sami fyrir alla: alvöru matur, prótein í hverri máltíð, trefjar og lítið af gjörunninni vöru. Það sem breytist er áherslan — hvort við horfum fyrst á blóðsykur, trefjar, prótein, salt eða skammta — og hún kemur úr skýrslunni þinni.'
 where key = 'jafnvaegi';

update hc_nutrition_templates set active = false where key <> 'jafnvaegi';

notify pgrst, 'reload schema';
