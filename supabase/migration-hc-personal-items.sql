-- Editing the exercises in a session, not just swapping them.
--
-- `swaps` already let someone replace one exercise with another from the
-- library, keyed by slot ("s0:3"). It could not express "take this one out"
-- or "add one more", so a session's exercise list was fixed at whatever the
-- programme generated.
--
-- drops: slots the person removed.
-- extra: session id → exercises they appended, snapshotted the same way a
--        swap is, so the card can render them without another lookup.
--
-- Both are keyed positionally, like swaps, and like swaps they are cleared
-- when the programme changes (training-server.ts). That is the existing
-- contract; this does not make it better or worse.
--
-- Applied manually in the Supabase SQL editor (see AGENTS.md).

alter table public.hc_training_settings add column if not exists drops jsonb not null default '[]'::jsonb;
alter table public.hc_training_settings add column if not exists extra jsonb not null default '{}'::jsonb;

comment on column public.hc_training_settings.drops is 'Slots ("s0:3") the participant removed from their sessions.';
comment on column public.hc_training_settings.extra is 'Session id → exercises the participant added, snapshotted like swaps.';

notify pgrst, 'reload schema';
