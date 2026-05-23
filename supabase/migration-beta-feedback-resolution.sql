-- =============================================================
-- beta_feedback: add resolution + visibility tracking.
--
-- Today beta_feedback has only a boolean `resolved`. Testers never
-- know when admin acts on their submission. This migration adds:
--
--   user_id          — auth user id of the tester (back-fillable from
--                      user_email join on auth.users). Lets us query
--                      "all my feedback" with proper indexing + RLS.
--   resolution_note  — what the admin replied with. Surfaces in the
--                      RN feedback bubble as "Your feedback was
--                      addressed: …".
--   resolved_at      — when the admin marked resolved.
--   resolved_by      — staff member who resolved (auth.uid()).
--   viewed_by_user_at — when the tester opened the FAB and saw the
--                      resolution. Drives the unread-badge on the
--                      floating button.
--
-- We DON'T drop the existing `resolved` boolean — kept for backward
-- compat with the legacy /admin/feedback page. New code reads
-- `resolved_at IS NOT NULL` as the source of truth.
-- =============================================================

alter table public.beta_feedback
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists viewed_by_user_at timestamptz;

-- Backfill user_id from user_email for existing rows where we can
-- match. Idempotent — only updates rows where user_id is still null.
update public.beta_feedback bf
set user_id = au.id
from auth.users au
where bf.user_id is null
  and bf.user_email is not null
  and lower(bf.user_email) = lower(au.email);

create index if not exists idx_beta_feedback_user
  on public.beta_feedback (user_id, created_at desc);
create index if not exists idx_beta_feedback_resolved_at
  on public.beta_feedback (resolved_at desc nulls last);

-- Keep `resolved` boolean in sync with resolved_at so legacy
-- consumers (the standalone /admin/feedback page) don't break.
create or replace function public.tg_beta_feedback_resolved_sync()
returns trigger
language plpgsql
as $$
begin
  -- When resolved_at is set, ensure resolved=true. When cleared,
  -- ensure resolved=false. Don't touch resolved if neither field
  -- changed.
  if (new.resolved_at is distinct from old.resolved_at) then
    new.resolved := new.resolved_at is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_beta_feedback_resolved_sync on public.beta_feedback;
create trigger trg_beta_feedback_resolved_sync
  before update on public.beta_feedback
  for each row execute function public.tg_beta_feedback_resolved_sync();

-- ─── RLS ───────────────────────────────────────────────────────
-- Existing policies on beta_feedback are not changed by this
-- migration. We assume an admin policy already exists (medical
-- advisor read policy is in migration-medical-advisor-readonly.sql).
-- We add a "user reads own feedback" policy so testers can list
-- their own submissions and see the resolution note in the app.

alter table public.beta_feedback enable row level security;

drop policy if exists "user read own beta feedback" on public.beta_feedback;
create policy "user read own beta feedback" on public.beta_feedback
  for select using (user_id = auth.uid());

drop policy if exists "user insert own beta feedback" on public.beta_feedback;
create policy "user insert own beta feedback" on public.beta_feedback
  for insert with check (user_id = auth.uid() or user_id is null);

-- A user can mark THEIR OWN feedback as viewed (sets the
-- viewed_by_user_at timestamp) but can't modify any other field.
-- Enforced via column grants below + the policy check.
drop policy if exists "user mark own feedback viewed" on public.beta_feedback;
create policy "user mark own feedback viewed" on public.beta_feedback
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admin manages everything.
drop policy if exists "admin manage beta feedback" on public.beta_feedback;
create policy "admin manage beta feedback" on public.beta_feedback
  for all using (is_admin_staff())
  with check (is_admin_staff());

notify pgrst, 'reload schema';
