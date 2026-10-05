-- What the participant already does every week.
--
-- Most people arrive with a half-full week — football on Mondays, CrossFit on
-- Saturdays, a swim when they can. A plan that ignores that either double-books
-- them or prescribes strength they are already getting. Each entry says which
-- day, what time, what it trains (strength / hiit / cardio) and how hard it is,
-- and the core fills only the gaps around it.
--
-- Applied manually (see AGENTS.md).

alter table hc_training_settings add column if not exists activities jsonb not null default '[]'::jsonb;

comment on column hc_training_settings.activities is
  'Weekly commitments: [{id,name,day,at,minutes,covers[],intensity}]. The core programme fills the gaps around these. See src/lib/hc/adaptive-program.ts.';

notify pgrst, 'reload schema';
