-- Adaptive training programme + lectures attached to a plan (heilsuferð).
--
--   hc_training_settings — the participant's own programme settings: level
--     (beginner → 4-week adaptation block / active), plus-minus load step and
--     injured areas. Written from /account/heilsuferd/aaetlun (own journey)
--     and from the workstation. The sessions themselves are computed in
--     src/lib/hc/adaptive-program.ts.
--   hc_action_plans.lecture_slugs / hc_plan_templates.lecture_slugs — which
--     fræðsla (hc_lectures) belongs to the plan; shown on the áætlun page.
--
-- Seeds the "hiit-styrkur" exercise template and the "hiit-styrkur" plan
-- template. The lecture itself is seeded by scripts (see the commit).
-- Idempotent; API-only (RLS blocks direct client access).

create table if not exists public.hc_training_settings (
  journey_id  uuid primary key references public.hc_journeys(id) on delete cascade,
  client_id   uuid not null,
  level       text not null default 'beginner' check (level in ('beginner', 'active')),
  load_step   int  not null default 0 check (load_step between -2 and 2),
  injuries    text[] not null default '{}',
  started_on  date,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

alter table public.hc_training_settings enable row level security;
drop policy if exists "hc_training_settings no client access" on public.hc_training_settings;
create policy "hc_training_settings no client access"
  on public.hc_training_settings for all using (false) with check (false);

alter table public.hc_action_plans   add column if not exists lecture_slugs text[] not null default '{}';
alter table public.hc_plan_templates add column if not exists lecture_slugs text[] not null default '{}';

insert into public.hc_exercise_templates (key, name, level, goal, days_per_week, session_minutes, description, sessions, principles, progression, active)
values (
  'hiit-styrkur',
  'HIIT og styrkur',
  'beginner',
  'Byggja upp vöðva og þol, þrisvar í viku',
  3,
  40,
  'Styrktaræfingar fyrir stóru vöðvahópana og stuttar, ákafar lotur (HIIT) þrisvar í viku. Áætlunin lagar sig að þér: byrjendur fá aðlögunartímabil, þú stillir álagið sjálf/ur og æfingum er skipt út ef þú ert með meiðsli í öxl, hné eða baki.',
  '[]'::jsonb,
  '["Stórir vöðvahópar fyrst: hnébeygja, réttstöðulyfta, að ýta og toga.", "Vöðvar eru sá vefur sem notar mesta orku, líka í hvíld.", "Styrktaræfingin á að vera krefjandi: síðustu endurtekningarnar eru erfiðar en tæknin helst góð.", "HIIT í 10–20 mínútur: stuttar lotur nálægt hámarki með hvíld á milli.", "Byrjendur byrja rólega. Sinar aðlagast hægar en vöðvar.", "Verkur sem eykst er merki um að stoppa. Hafðu samband ef hann hverfur ekki."]'::jsonb,
  '[]'::jsonb,
  true
)
on conflict (key) do update set
  name = excluded.name, goal = excluded.goal, description = excluded.description,
  principles = excluded.principles, days_per_week = excluded.days_per_week,
  session_minutes = excluded.session_minutes, active = true;

insert into public.hc_plan_templates (key, name, scenario, description, module_keys, exercise_template_key, nutrition_template_key, focus_pillars, lecture_slugs, sort, active)
values (
  'hiit-styrkur',
  'Innri kviðfita og insúlínviðnám',
  'Hópnámskeið: HIIT og styrkur með fræðslu',
  'Svefn, ró, styrkur, HIIT og próteinríkt mataræði með minna af gjörunnum mat. Fylgir fyrirlestrinum „Innri kviðfita og insúlínviðnám“.',
  array['svefn-fastur-timi', 'andlegt-ondun', 'andlegt-tengsl', 'hreyfing-styrkur', 'hreyfing-vo2max', 'naering-protein', 'naering-unnin', 'naering-vidbaettur-sykur'],
  'hiit-styrkur',
  null,
  array['exercise', 'nutrition', 'sleep', 'mental']::text[],
  array['innri-kvidfita'],
  5,
  true
)
on conflict (key) do update set
  name = excluded.name, scenario = excluded.scenario, description = excluded.description,
  module_keys = excluded.module_keys, exercise_template_key = excluded.exercise_template_key,
  focus_pillars = excluded.focus_pillars, lecture_slugs = excluded.lecture_slugs, active = true;
