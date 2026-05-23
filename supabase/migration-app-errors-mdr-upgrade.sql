-- =============================================================
-- MDR upgrade for app_errors + linkage to beta_feedback.
--
-- 1. app_errors gets columns for resolution metadata (note,
--    version, commit, risk register cross-refs, triage status).
-- 2. app_errors_status_history captures every triage change as
--    an immutable audit row written by a trigger. Without this,
--    the existing in-place UPDATE of resolved_at loses the
--    "resolved → reopened → re-resolved" timeline.
-- 3. beta_feedback gets linked_error_ids + app_version +
--    recent_error_signatures so a feedback submission can pull
--    in the user's recent errors as context (set by the RN
--    BetaFeedback component on submit).
-- =============================================================

-- ─── app_errors columns ────────────────────────────────────────
alter table public.app_errors
  add column if not exists resolution_note text,
  add column if not exists resolved_in_version text,
  add column if not exists resolved_in_commit_sha text,
  add column if not exists resolved_in_release_id uuid references public.app_releases(id) on delete set null,
  add column if not exists risk_register_ids text[],     -- e.g. ARRAY['R-2026-001','R-2026-007']
  add column if not exists triage_status text check (triage_status in (
    -- null = active triage. Others let the admin clear out noise
    -- without losing the audit trail (vs the destructive delete).
    'dev_noise',     -- HMR / dev-only artifacts
    'wontfix',       -- known + accepted
    'duplicate'      -- merged into another group
  )),
  add column if not exists triage_severity text check (triage_severity in (
    -- Differs from `level` (set at report site). triage_severity is
    -- the human triage call after investigating user impact.
    'cosmetic', 'low', 'medium', 'high', 'critical'
  )),
  add column if not exists triage_category text check (triage_category in (
    'data-integrity','clinical','privacy','security','availability',
    'usability','regression','infra','other'
  ));

create index if not exists idx_app_errors_resolution_release
  on public.app_errors (resolved_in_release_id);
create index if not exists idx_app_errors_triage_status
  on public.app_errors (triage_status);

-- ─── app_errors_status_history ─────────────────────────────────
-- Immutable history of triage changes. Each row is one event on
-- one app_errors row. The trigger writes only when a tracked
-- field actually changed (no spam on every UPDATE).
create table if not exists public.app_errors_status_history (
  id uuid primary key default gen_random_uuid(),
  app_error_id uuid not null references public.app_errors(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_email text,
  changed_by_name text,
  -- Snapshot of the relevant fields BEFORE and AFTER the change.
  -- We capture both so an auditor can replay the full timeline
  -- without needing to JOIN against the current state.
  prev_resolved_at timestamptz,
  prev_resolution_note text,
  prev_resolved_in_version text,
  prev_resolved_in_commit_sha text,
  prev_triage_status text,
  prev_triage_severity text,
  prev_triage_category text,
  new_resolved_at timestamptz,
  new_resolution_note text,
  new_resolved_in_version text,
  new_resolved_in_commit_sha text,
  new_triage_status text,
  new_triage_severity text,
  new_triage_category text
);

create index if not exists idx_app_errors_history_error
  on public.app_errors_status_history (app_error_id, changed_at desc);

alter table public.app_errors_status_history enable row level security;

drop policy if exists "staff read errors history" on public.app_errors_status_history;
create policy "staff read errors history" on public.app_errors_status_history
  for select using (is_active_staff());

-- History is append-only. No UPDATE / DELETE policies → admins cannot
-- mutate the audit trail. (Service role still can, by design.)

-- Trigger function: write a history row whenever any tracked
-- triage field changed. Captures the actor via auth.uid() + a
-- best-effort name lookup from staff.
create or replace function public.tg_app_errors_history()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_name text;
  v_changed boolean := false;
begin
  -- Did any tracked field actually change? (NULL-safe via IS DISTINCT FROM)
  if  (new.resolved_at is distinct from old.resolved_at)
   or (new.resolution_note is distinct from old.resolution_note)
   or (new.resolved_in_version is distinct from old.resolved_in_version)
   or (new.resolved_in_commit_sha is distinct from old.resolved_in_commit_sha)
   or (new.triage_status is distinct from old.triage_status)
   or (new.triage_severity is distinct from old.triage_severity)
   or (new.triage_category is distinct from old.triage_category)
  then
    v_changed := true;
  end if;
  if not v_changed then
    return new;
  end if;

  if v_actor is not null then
    select email into v_email from auth.users where id = v_actor limit 1;
    if v_email is not null then
      select name into v_name from public.staff where email = v_email limit 1;
    end if;
  end if;

  insert into public.app_errors_status_history (
    app_error_id, changed_by, changed_by_email, changed_by_name,
    prev_resolved_at, prev_resolution_note, prev_resolved_in_version,
    prev_resolved_in_commit_sha, prev_triage_status,
    prev_triage_severity, prev_triage_category,
    new_resolved_at, new_resolution_note, new_resolved_in_version,
    new_resolved_in_commit_sha, new_triage_status,
    new_triage_severity, new_triage_category
  ) values (
    new.id, v_actor, v_email, v_name,
    old.resolved_at, old.resolution_note, old.resolved_in_version,
    old.resolved_in_commit_sha, old.triage_status,
    old.triage_severity, old.triage_category,
    new.resolved_at, new.resolution_note, new.resolved_in_version,
    new.resolved_in_commit_sha, new.triage_status,
    new.triage_severity, new.triage_category
  );

  return new;
end;
$$;

drop trigger if exists trg_app_errors_history on public.app_errors;
create trigger trg_app_errors_history
  after update on public.app_errors
  for each row execute function public.tg_app_errors_history();

-- ─── beta_feedback ↔ errors linkage ────────────────────────────
alter table public.beta_feedback
  add column if not exists linked_error_ids uuid[],
  add column if not exists app_version text,                   -- normalized; user_agent stays free-text
  -- Snapshot of recent app_errors for this user at submit time.
  -- Stored as JSONB so we have the data even if rows are later
  -- deleted from app_errors. Each element:
  --   { id, fingerprint, message, occurred_at, runtime, level }
  add column if not exists recent_error_signatures jsonb;

create index if not exists idx_beta_feedback_app_version
  on public.beta_feedback (app_version);

notify pgrst, 'reload schema';
