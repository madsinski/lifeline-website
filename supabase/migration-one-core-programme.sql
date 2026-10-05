-- One core programme instead of eleven.
--
-- The library had grown to eleven exercise templates that mostly differed by
-- which situation they were named after ("Grunnur heima", "Minnsti tími",
-- "Liðvæn hreyfing"). Those are not different programmes — they are the same
-- programme with a different place, a different number of days and different
-- limitations, all of which the adaptive core now takes as settings.
--
-- So `hiit-styrkur` becomes the core and the rest are deactivated, not
-- deleted: a published plan stores its own copy of the template in
-- hc_action_plans.exercise, so existing plans keep running exactly as they
-- are. Deactivating only stops them being chosen again.
--
-- Applied manually (see AGENTS.md).

update hc_exercise_templates
   set name = 'Styrkur og þol',
       goal = 'Tveir heilir styrktartímar í viku og rólegt þol — HIIT bætist við þegar líkaminn er tilbúinn.',
       description = 'Einn kjarni sem lagar sig að þér: hvar þú æfir, hvaða daga þú kemst, hvort þú þarft aðlögun fyrst og hvað þarf að taka tillit til. Tveir heilir styrktartímar þjálfa allar stóru hreyfingarnar tvisvar í viku, rólegt þol byggir grunninn og HIIT kemur inn þegar sinar og þol ráða við það.'
 where key = 'hiit-styrkur';

update hc_exercise_templates set active = false where key <> 'hiit-styrkur';

notify pgrst, 'reload schema';
