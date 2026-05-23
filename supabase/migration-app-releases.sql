-- =============================================================
-- MDR design-history-file tables.
--
-- Two tables that together form the audit trail an EU MDR notifying
-- body asks for:
--
-- 1. app_releases
--    One row per shipped binary (RN app or website deploy). Captures
--    the version, build number, git sha, channel (preview /
--    production), risk assessment summary, link to the SBOM blob,
--    and free-text release notes. Together with the per-repo
--    CHANGELOG.md, this is the "what shipped when, by whom, with
--    what risk profile" register.
--
-- 2. risk_register
--    ISO 14971 risk-management entries. Each line is one identified
--    risk + its mitigation + status. Cross-referenced by version
--    via app_releases.risk_assessment free-text (we keep the link
--    loose so a risk can span multiple releases).
--
-- Both tables are admin-managed (write) and staff-readable. Service
-- role can insert from EAS post-build hook via the
-- /api/admin/releases endpoint.
-- =============================================================

-- ─── app_releases ─────────────────────────────────────────────
create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  repo text not null check (repo in ('app','website')),
  version text not null,                  -- semver, e.g. 0.1.0
  build_number text,                       -- iOS CFBundleVersion / Android versionCode / website deploy id
  platform text,                           -- 'ios'|'android'|'all'|'web'
  channel text not null check (channel in ('development','preview','production')),
  git_sha text not null,                   -- full 40-char sha
  git_tag text,                            -- optional semver tag, e.g. v0.1.0
  git_branch text,
  release_notes text,                      -- markdown copy of the CHANGELOG block
  risk_assessment text,                    -- summary of risk-relevant changes + register ids touched
  sbom_storage_path text,                  -- path in app-releases-sbom bucket
  sbom_sha256 text,
  build_artifact_url text,                 -- EAS build URL / Vercel deployment URL
  released_at timestamptz not null default now(),
  released_by uuid references auth.users(id) on delete set null,
  released_by_email text,                  -- captured at release time for audit
  unique (repo, version, build_number, platform, channel)
);

create index if not exists idx_app_releases_released_at
  on public.app_releases (released_at desc);
create index if not exists idx_app_releases_version
  on public.app_releases (repo, version);

alter table public.app_releases enable row level security;

-- Active staff can list/read. Admin staff can write.
drop policy if exists "staff read app releases" on public.app_releases;
create policy "staff read app releases" on public.app_releases
  for select using (is_active_staff());

drop policy if exists "admin manage app releases" on public.app_releases;
create policy "admin manage app releases" on public.app_releases
  for all using (is_admin_staff()) with check (is_admin_staff());

-- Private storage bucket for the per-release SBOMs (CycloneDX JSON
-- or npm-list output). Same pattern as the legal acceptance bucket.
insert into storage.buckets (id, name, public)
values ('app-releases-sbom', 'app-releases-sbom', false)
on conflict (id) do nothing;

drop policy if exists "admin manage release sboms" on storage.objects;
create policy "admin manage release sboms" on storage.objects
  for all using (bucket_id = 'app-releases-sbom' and is_admin_staff())
  with check (bucket_id = 'app-releases-sbom' and is_admin_staff());

drop policy if exists "staff read release sboms" on storage.objects;
create policy "staff read release sboms" on storage.objects
  for select using (bucket_id = 'app-releases-sbom' and is_active_staff());

-- ─── risk_register ────────────────────────────────────────────
create table if not exists public.risk_register (
  id uuid primary key default gen_random_uuid(),
  short_id text unique,                    -- human handle, e.g. R-2026-001
  category text not null check (category in (
    'clinical','data-integrity','privacy','security','regulatory',
    'availability','integration','usability','other'
  )),
  title text not null,
  description text not null,               -- the risk in plain language
  failure_mode text,                       -- what specifically goes wrong
  affected_users text,                     -- who's at risk + how many
  severity text not null check (severity in ('low','medium','high','critical')),
  likelihood text check (likelihood in ('rare','unlikely','possible','likely','almost_certain')),
  initial_risk_score smallint check (initial_risk_score between 1 and 25),
  mitigation text,                         -- what we do to reduce it
  residual_severity text check (residual_severity in ('low','medium','high','critical')),
  residual_likelihood text check (residual_likelihood in ('rare','unlikely','possible','likely','almost_certain')),
  residual_risk_score smallint check (residual_risk_score between 1 and 25),
  detection text,                          -- how we know if it happens
  status text not null default 'open' check (status in ('open','mitigated','closed','accepted')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  notes text                               -- running log
);

-- Auto-assign short_id like R-2026-001 on insert. Year-scoped so
-- numbers stay short. Idempotent: trigger is a no-op if short_id is
-- already set (lets the admin import historical entries with their
-- own ids).
create or replace function public.tg_risk_register_short_id()
returns trigger
language plpgsql
as $$
declare
  yr int := extract(year from coalesce(new.opened_at, now()))::int;
  next_n int;
begin
  if new.short_id is not null then return new; end if;
  select coalesce(max(substring(short_id from '\d+$')::int), 0) + 1
    into next_n
    from public.risk_register
    where short_id like 'R-' || yr || '-%';
  new.short_id := 'R-' || yr || '-' || lpad(next_n::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists trg_risk_register_short_id on public.risk_register;
create trigger trg_risk_register_short_id
  before insert on public.risk_register
  for each row execute function public.tg_risk_register_short_id();

create index if not exists idx_risk_register_status
  on public.risk_register (status, opened_at desc);
create index if not exists idx_risk_register_severity
  on public.risk_register (severity, status);

alter table public.risk_register enable row level security;

drop policy if exists "staff read risk register" on public.risk_register;
create policy "staff read risk register" on public.risk_register
  for select using (is_active_staff());

drop policy if exists "admin manage risk register" on public.risk_register;
create policy "admin manage risk register" on public.risk_register
  for all using (is_admin_staff()) with check (is_admin_staff());

notify pgrst, 'reload schema';
