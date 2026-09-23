-- Uppflettirit: the clinical reference a nurse looks things up in from the
-- workstation (/vinnustod → Fletta upp). One row per topic: a marker, a body
-- measure, a questionnaire, a lifestyle recommendation or a piece of Lifeline
-- methodology. `bands` holds the value ranges so the workstation can answer
-- "insúlín 18" directly. Managed in /admin/knowledge.
--
-- API-mediated (src/app/api/vinnustod/knowledge, src/app/api/admin/hc/knowledge):
-- reads and writes go through the service-role client.

create table if not exists public.hc_knowledge (
  slug          text primary key,
  category      text not null check (category in ('blood','body','mental','lifestyle','score','method')),
  title         text not null,
  aliases       text[] not null default '{}',   -- other names a nurse might type (incl. English)
  unit          text,
  summary       text not null,                  -- the one-line answer
  body_md       text,                           -- deeper explanation + what to advise
  bands         jsonb not null default '[]'::jsonb,  -- [{label,tone,min,max,sex,note}]
  higher_better boolean,
  sources       text[] not null default '{}',
  tags          text[] not null default '{}',
  sort          int not null default 100,
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

create index if not exists hc_knowledge_category_idx on public.hc_knowledge (category, sort);

alter table public.hc_knowledge enable row level security;
drop policy if exists "hc_knowledge no client access" on public.hc_knowledge;
create policy "hc_knowledge no client access"
  on public.hc_knowledge for all using (false) with check (false);
