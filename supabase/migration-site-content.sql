-- Website CMS: editable marketing-page content (text, section order, IS/EN).
--
-- One row per page key ("home", "coaching", ...). `draft` is what the admin
-- editor autosaves; `published` is what the public site renders. Nothing goes
-- live until an admin presses "Publish" (draft -> published).
--
-- Blob shape (both draft and published):
--   { is: {key:value}, en: {key:value}, order: string[], hidden: string[] }
--
-- API-mediated (src/app/api/admin/site-content/*, src/app/api/site-content/*):
-- all reads/writes go through the service-role client, so RLS blocks the anon
-- client entirely. See AGENTS.md "Standard table pattern for API-mediated data".

create table if not exists public.site_content (
  page          text primary key,
  draft         jsonb not null default '{}'::jsonb,
  published     jsonb,
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  updated_by    uuid references auth.users(id)
);

alter table public.site_content enable row level security;

-- Block all direct client access — the API (service role) is the only path.
drop policy if exists "site_content no client access" on public.site_content;
create policy "site_content no client access"
  on public.site_content for all
  using (false) with check (false);
