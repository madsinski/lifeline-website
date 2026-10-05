-- Carry a programme rename into plans that were already published.
--
-- Same drift as hc_action_plans.modules: a published plan stores its own copy
-- of the exercise and nutrition template, so renaming "Jafnvægi" to
-- "Næringin mín" left every existing plan still showing the old name. The
-- snapshot is right for substance — sessions, meals and anything staff wrote
-- must not change under someone — but a name is not substance.
--
-- Copies name, goal and description only, matched by key, and only from
-- templates that still exist. Written through the decrypted view so the
-- INSTEAD OF triggers re-encrypt. Re-runnable.
--
-- Applied manually (see AGENTS.md).

update hc_action_plans_decrypted p
   set nutrition = p.nutrition || jsonb_build_object('name', t.name, 'goal', t.goal, 'description', t.description)
  from hc_nutrition_templates t
 where p.nutrition is not null
   and t.key = p.nutrition->>'key'
   and (t.name is distinct from p.nutrition->>'name'
     or t.goal is distinct from p.nutrition->>'goal'
     or t.description is distinct from p.nutrition->>'description');

update hc_action_plans_decrypted p
   set exercise = p.exercise || jsonb_build_object('name', t.name, 'goal', t.goal, 'description', t.description)
  from hc_exercise_templates t
 where p.exercise is not null
   and t.key = p.exercise->>'key'
   and (t.name is distinct from p.exercise->>'name'
     or t.goal is distinct from p.exercise->>'goal'
     or t.description is distinct from p.exercise->>'description');
