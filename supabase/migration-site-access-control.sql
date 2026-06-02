-- =============================================================
-- Site-access control — replaces the hardcoded BYPASS_KEY in
-- middleware with admin-controllable grants + invite tokens.
-- Safe to re-run (idempotent guards).
-- =============================================================
--
-- Three layers of access:
--   1. access_grants — per-user / per-company / per-group static grants
--   2. user_access_groups — many-to-many user ↔ group_tag
--   3. access_invite_tokens — shareable claim links for external reviewers
--
-- Grants apply to LOGGED-IN users (matched by user_id, company_id, or
-- group_tag membership). Tokens apply to UNAUTHENTICATED visitors via a
-- claimed cookie. RPCs are SECURITY DEFINER so the proxy can call them
-- without granting blanket read on the underlying tables.

begin;

-- ── Grants ─────────────────────────────────────────────────────
create table if not exists public.access_grants (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('user','company','group')),
  -- Exactly one of the three below is set, matching `kind`:
  user_id     uuid references auth.users(id) on delete cascade,
  company_id  uuid references public.companies(id) on delete cascade,
  group_tag   text,
  label       text,                                 -- human readable
  active      boolean not null default true,
  expires_at  timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  constraint access_grants_target_matches_kind check (
    (kind = 'user'    and user_id    is not null and company_id is null and group_tag is null) or
    (kind = 'company' and company_id is not null and user_id    is null and group_tag is null) or
    (kind = 'group'   and group_tag  is not null and user_id    is null and company_id is null)
  )
);

create index if not exists idx_access_grants_user_active
  on public.access_grants (user_id) where active and kind='user';
create index if not exists idx_access_grants_company_active
  on public.access_grants (company_id) where active and kind='company';
create index if not exists idx_access_grants_group_active
  on public.access_grants (group_tag) where active and kind='group';

-- ── User → group memberships ───────────────────────────────────
create table if not exists public.user_access_groups (
  user_id    uuid not null references auth.users(id) on delete cascade,
  group_tag  text not null,
  added_by   uuid references auth.users(id),
  added_at   timestamptz not null default now(),
  primary key (user_id, group_tag)
);

create index if not exists idx_user_access_groups_tag
  on public.user_access_groups (group_tag);

-- ── Invite tokens ──────────────────────────────────────────────
-- Raw token is shown ONCE at mint time; only its SHA-256 is stored,
-- following the same one-way pattern as the kennitala-encryption
-- security posture (never store the secret itself).
create table if not exists public.access_invite_tokens (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,                 -- sha256 hex
  label        text,                                 -- "Investor: Y Combinator"
  active       boolean not null default true,
  expires_at   timestamptz,
  max_uses     integer,                              -- null = unlimited
  used_count   integer not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_access_invite_tokens_hash_active
  on public.access_invite_tokens (token_hash) where active;

-- ── RLS — only staff can manage; RPCs cover the read side ──────
alter table public.access_grants         enable row level security;
alter table public.user_access_groups    enable row level security;
alter table public.access_invite_tokens  enable row level security;

drop policy if exists access_grants_staff_all on public.access_grants;
create policy access_grants_staff_all on public.access_grants
  for all using (public.is_active_staff()) with check (public.is_active_staff());

drop policy if exists uag_staff_all on public.user_access_groups;
create policy uag_staff_all on public.user_access_groups
  for all using (public.is_active_staff()) with check (public.is_active_staff());

drop policy if exists access_tokens_staff_all on public.access_invite_tokens;
create policy access_tokens_staff_all on public.access_invite_tokens
  for all using (public.is_active_staff()) with check (public.is_active_staff());

-- ── has_site_access(uid) — the one the proxy calls per request ─
-- Returns true if the user has any active, non-expired grant:
--   • direct user grant
--   • company grant where they are contact_person_id, a company_admin,
--     or an onboarded employee (clients.company_id set)
--   • group grant for any of their user_access_groups tags
create or replace function public.has_site_access(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  with active_grants as (
    select kind, user_id, company_id, group_tag from public.access_grants
    where active and (expires_at is null or expires_at > now())
  )
  select
    -- 1. direct user grant
    exists (select 1 from active_grants where kind='user' and user_id = p_uid)
    -- 2. company grant — contact person
    or exists (select 1
               from active_grants g
               join public.companies c on c.id = g.company_id
               where g.kind='company' and c.contact_person_id = p_uid)
    -- 3. company grant — co-admin
    or exists (select 1
               from active_grants g
               join public.company_admins ca on ca.company_id = g.company_id
               where g.kind='company' and ca.user_id = p_uid)
    -- 4. company grant — onboarded employee (client with company_id set)
    or exists (select 1
               from active_grants g
               join public.clients cl on cl.company_id = g.company_id
               where g.kind='company' and cl.id = p_uid)
    -- 5. group grant
    or exists (select 1
               from active_grants g
               join public.user_access_groups uag
                 on uag.group_tag = g.group_tag and uag.user_id = p_uid
               where g.kind='group')
  ;
$$;

grant execute on function public.has_site_access(uuid) to authenticated, anon;

-- ── claim_access_token(hash) — atomically validate + bump usage ─
-- Caller passes the SHA-256 of the raw token from the URL. Returns ok
-- + a label if it can be claimed. Increments used_count and stamps
-- last_used_at as a side-effect (the cookie itself is then issued by
-- the claim API route).
create or replace function public.claim_access_token(p_token_hash text)
returns table(ok boolean, label text, error text)
language plpgsql security definer set search_path = public as $$
declare r public.access_invite_tokens%rowtype;
begin
  select * into r from public.access_invite_tokens
    where token_hash = p_token_hash for update;
  if not found or not r.active then
    return query select false, null::text, 'not_found_or_inactive'::text; return;
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    return query select false, r.label, 'expired'::text; return;
  end if;
  if r.max_uses is not null and r.used_count >= r.max_uses then
    return query select false, r.label, 'exhausted'::text; return;
  end if;
  update public.access_invite_tokens
    set used_count = used_count + 1, last_used_at = now()
    where id = r.id;
  return query select true, r.label, null::text;
end;
$$;

-- ── validate_access_token(hash) — read-only check for the proxy ─
-- The proxy calls this on every gated request that carries the
-- site_access_token cookie. Does NOT increment usage. Returns true
-- only if the token still exists, is active, and isn't expired.
create or replace function public.validate_access_token(p_token_hash text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.access_invite_tokens
    where token_hash = p_token_hash
      and active
      and (expires_at is null or expires_at > now())
  );
$$;

grant execute on function public.claim_access_token(text)    to anon, authenticated;
grant execute on function public.validate_access_token(text) to anon, authenticated;

commit;
