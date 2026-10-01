-- Link the stored exercise programmes' items to the exercise library, so
-- every exercise shows its picture, video, muscles and how-to (templates
-- written by hand had names only). Items that already carry an image are left
-- alone. Also updates published plans' snapshots of those programmes.
-- Idempotent.

create temporary table ex_map (item text primary key, lib text) on commit drop;
insert into ex_map values
  ('Rösk ganga','Walking, Treadmill'),
  ('Ganga','Walking, Treadmill'),
  ('Þol','Cycling'),
  ('Zone 2','Cycling'),
  ('4×4','HIIT Intervals'),
  ('Hnébeygja með eigin þyngd eða léttri stöng','Bodyweight Squat'),
  ('Hnébeygja','Goblet Squat'),
  ('Upp úr stól','Chair Squat'),
  ('Axlapressa með handlóðum','Seated Dumbbell Shoulder Press'),
  ('Axlapressa','Seated Dumbbell Shoulder Press'),
  ('Axlalyftur með léttum lóðum','Seated Dumbbell Shoulder Press'),
  ('Róður í vél','Seated Cable Rows'),
  ('Róður','Seated Cable Rows'),
  ('Róður með teygju','Seated Cable Rows'),
  ('Mjaðmalyfta með léttri þyngd','Barbell Hip Thrust'),
  ('Mjaðmalyfta','Barbell Hip Thrust'),
  ('Mjaðmabrú','Glute Bridges'),
  ('Mjaðmabrú á gólfi','Glute Bridges'),
  ('Brjóstpressa í vél','Machine Bench Press'),
  ('Bekkpressa','Dumbbell Bench Press'),
  ('Bekkpressa eða axlapressa','Dumbbell Bench Press'),
  ('Niðurtog','Wide-Grip Lat Pulldown'),
  ('Upphífing','Pullups'),
  ('Upphífing með teygju eða niðurtog','Band Assisted Pull-Up'),
  ('Kviðæfing','Dead Bug'),
  ('Planki','Plank'),
  ('Hliðarplanki á hnjám','Side Plank'),
  ('Farmer''s carry','Farmer''s Walk'),
  ('Réttstöðulyfta','Barbell Deadlift'),
  ('Mjaðmalyfta eða réttstöðulyfta','Barbell Hip Thrust'),
  ('Framstig','Dumbbell Lunges'),
  ('Framstig með stuðningi','Dumbbell Lunges'),
  ('Standa á öðrum fæti','Balance Board'),
  ('Jafnvægi á öðrum fæti','Balance Board'),
  ('Hælar og tær eftir línu','Balance Board'),
  ('Kálfalyftur','Standing Calf Raises'),
  ('Fugl-hundur','Bird Dog'),
  ('Hliðarskref með teygju','Monster Walk'),
  ('Standa á öðrum fæti með augun lokuð','Balance Board'),
  ('Fótapressa','Leg Press'),
  ('Mjaðmahreyfanleiki','Standing Hip Circles');

create or replace function pg_temp.link_items(sessions jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_agg(
    s || jsonb_build_object('items', (
      select coalesce(jsonb_agg(
        case when (it->>'image') is null and e.id is not null then
          it || jsonb_build_object(
            'exercise_id', e.id, 'image', e.illustration_url, 'video', e.video_url,
            'muscles', to_jsonb(coalesce(e.primary_muscles, array[]::text[])), 'equipment', e.equipment,
            'cues', coalesce(it->'cues', '[]'::jsonb) || to_jsonb(coalesce((coalesce(e.instructions_is, e.instructions))[1:3], array[]::text[])))
        else it end order by ord), '[]'::jsonb)
      from jsonb_array_elements(s->'items') with ordinality as x(it, ord)
      left join ex_map m on m.item = it->>'name'
      left join lateral (select * from public.exercises where name = m.lib limit 1) e on true
    )) order by so), '[]'::jsonb)
  from jsonb_array_elements(sessions) with ordinality as y(s, so)
$$;

update public.hc_exercise_templates set sessions = pg_temp.link_items(sessions) where jsonb_array_length(sessions) > 0;

update public.hc_action_plans_decrypted
set exercise = exercise || jsonb_build_object('sessions', pg_temp.link_items(exercise->'sessions'))
where exercise is not null and jsonb_array_length(coalesce(exercise->'sessions', '[]'::jsonb)) > 0;

-- Run after seed-exercises-is.sql: library how-to lines copied in English
-- above are swapped for their Icelandic translation (or dropped if none).
create or replace function pg_temp.icelandic_cues(sessions jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_agg(
    s || jsonb_build_object('items', (
      select coalesce(jsonb_agg(
        case when e.id is null then it else it || jsonb_build_object('cues', (
          select coalesce(jsonb_agg(c2 order by co), '[]'::jsonb) from (
            select co, case when array_position(e.instructions, c #>> '{}') is not null
                         then to_jsonb(e.instructions_is[array_position(e.instructions, c #>> '{}')])
                         else c end as c2
            from jsonb_array_elements(coalesce(it->'cues', '[]'::jsonb)) with ordinality as z(c, co)
          ) q where c2 is not null and c2 <> 'null'::jsonb))
        end order by ord), '[]'::jsonb)
      from jsonb_array_elements(s->'items') with ordinality as x(it, ord)
      left join public.exercises e on e.id::text = it->>'exercise_id'
    )) order by so), '[]'::jsonb)
  from jsonb_array_elements(sessions) with ordinality as y(s, so)
$$;
update public.hc_exercise_templates set sessions = pg_temp.icelandic_cues(sessions) where jsonb_array_length(sessions) > 0;
update public.hc_action_plans_decrypted
set exercise = exercise || jsonb_build_object('sessions', pg_temp.icelandic_cues(exercise->'sessions'))
where exercise is not null and jsonb_array_length(coalesce(exercise->'sessions', '[]'::jsonb)) > 0;
