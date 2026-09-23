-- hc_knowledge: what a composite score is made of.
--
-- A 0–10 score is opaque on its own. "Svefn — venjur 5,9" tells a client
-- nothing about which habit to change; the report's own prose does ("svefntíma,
-- skjánotkunar fyrir svefn, koffínneyslu og reglufestu í svefnmynstri"), and
-- that is what belongs under the number.
--
-- Where the report states weights (Efnaskiptaheilsa: HOMA-IR, HbA1c, TG/HDL
-- and liver enzymes at 25% each) they are recorded as written.
--
-- Applied: 2026-09-23 (Supabase Management API).

alter table public.hc_knowledge
  add column if not exists components text[] not null default '{}';

comment on column public.hc_knowledge.components is
  'What this score is composed of, in the report''s own terms. Shown to clients.';
