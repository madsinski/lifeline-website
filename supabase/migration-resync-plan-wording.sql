-- Carry a wording fix into plans that were already published.
--
-- A published plan stores its own copy of each action (title, summary,
-- details, frequency) so that editing the library cannot change what someone
-- was handed. That is right for substance and wrong for language: renaming
-- "Háákefðarlotur" to "HIIT" left every existing plan still saying the word
-- nobody understands.
--
-- So this copies the WORDING only — title, summary, details, frequency — from
-- hc_plan_modules into published plans, matched by key. It does not touch
-- which actions are in a plan, their order, the participant's own notes, or
-- anything the nurse wrote. Written through the decrypted view, which carries
-- the INSTEAD OF triggers that re-encrypt.
--
-- Re-runnable. Applied manually (see AGENTS.md).

update hc_action_plans_decrypted p
   set modules = (
     select jsonb_agg(
              case when lib.key is null then m
                   else m || jsonb_build_object(
                          'title', lib.title,
                          'summary', lib.summary,
                          'details', lib.details,
                          'frequency', lib.frequency)
              end
              order by t.ord)
       from jsonb_array_elements(p.modules) with ordinality as t(m, ord)
       left join hc_plan_modules lib on lib.key = m->>'key'
   )
 where p.modules is not null
   and jsonb_typeof(p.modules) = 'array'
   and exists (
     select 1
       from jsonb_array_elements(p.modules) e
       join hc_plan_modules lib on lib.key = e->>'key'
      where lib.title    is distinct from e->>'title'
         or lib.summary  is distinct from e->>'summary'
         or lib.details  is distinct from e->>'details'
         or lib.frequency is distinct from e->>'frequency'
   );
