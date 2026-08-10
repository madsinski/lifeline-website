-- Master on/off switch for the coming-soon gate (src/proxy.ts).
-- Stored in system_settings.public_site_gated (jsonb boolean, default true =
-- gated). The proxy runs on the anon client, which can't read system_settings
-- (staff-only RLS), so it reads the value through this SECURITY DEFINER
-- function instead. Admin writes go through /api/admin/site-gate (service role).

insert into public.system_settings (key, value)
values ('public_site_gated', 'true'::jsonb)
on conflict (key) do nothing;

create or replace function public.public_site_gated()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Default to TRUE (gated) when the row is missing or malformed — fail closed.
  select coalesce(
    (select (value)::text::boolean from public.system_settings where key = 'public_site_gated'),
    true
  );
$$;

grant execute on function public.public_site_gated() to anon, authenticated;
