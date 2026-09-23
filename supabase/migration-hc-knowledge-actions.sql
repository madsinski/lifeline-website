-- hc_knowledge: what moves a value, in both directions.
--
-- The report view teaches, not just reports: every row opens to show its
-- reference range, why the number matters, and what pushes it the right way
-- or the wrong way. The first two already lived here (bands, summary,
-- body_md); these are the two that were missing.
--
-- Lifestyle levers only. Nothing here diagnoses, treats or prescribes — that
-- is the doctor's report in Medalia, not the reference book.
--
-- Applied: 2026-09-23 (Supabase Management API).

alter table public.hc_knowledge
  add column if not exists improves text[] not null default '{}',
  add column if not exists worsens  text[] not null default '{}';

comment on column public.hc_knowledge.improves is
  'Lifestyle actions that tend to move this value the right way. Shown to clients.';
comment on column public.hc_knowledge.worsens is
  'What tends to move it the wrong way. Shown to clients.';
