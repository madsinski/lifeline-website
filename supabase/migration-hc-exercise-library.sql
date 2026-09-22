-- Exercise templates built from the exercise library (/admin/content).
-- Items in hc_exercise_templates.sessions / hc_action_plans.exercise now carry
-- exercise_id + a media/cue snapshot (jsonb, no schema change needed); the
-- template itself gains principles and a 12-week progression.
alter table hc_exercise_templates add column if not exists principles jsonb not null default '[]'::jsonb;
alter table hc_exercise_templates add column if not exists progression jsonb not null default '[]'::jsonb;
