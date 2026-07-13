-- Measurement-station instruction documents ─────────────────────────────────
-- Editable operating instructions for a measurement station (e.g. the Lyfja
-- station in Smáratorg), shown in the admin editor and on a public, printable
-- link. Content is a JSON block document (see src/lib/station-instructions.ts).
--
-- API-mediated: all reads/writes go through /api/admin/station-instructions and
-- the public /leidbeiningar/[slug] server route using the service-role key, so
-- no client access is granted. Applied manually in the Supabase SQL editor.

create table if not exists public.station_instructions (
  slug          text primary key,
  title         text not null default '',
  doc           jsonb not null default '{}'::jsonb,
  is_published  boolean not null default false,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id)
);

alter table public.station_instructions enable row level security;

drop policy if exists "Block client access" on public.station_instructions;
create policy "Block client access" on public.station_instructions
  for all using (false) with check (false);
