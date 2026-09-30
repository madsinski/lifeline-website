-- Column-level encryption for measured values (hc_results) and action plans
-- (hc_action_plans), the same pgcrypto + Vault key as messages, clients PII
-- and hc_reports (migration-encryption-foundation.sql,
-- migration-hc-reports-encrypt.sql). Idempotent; backfills existing rows and
-- blanks the plaintext.
--
-- hc_results: value + note encrypted. marker stays plain (it is part of the
--   upsert key journey_id,marker). Writers keep writing the base table (they
--   upsert, which a view cannot take); a BEFORE trigger encrypts. Every writer
--   sends value AND note together, so the trigger treats NEW.note as the
--   truth (null clears it). Read through hc_results_decrypted.
-- hc_action_plans: headline, summary, goals, modules, exercise, nutrition,
--   nurse_note encrypted. status, dates, version, lecture_slugs stay plain for
--   filtering. Read AND write through hc_action_plans_decrypted (INSTEAD OF
--   triggers get the whole row, so clearing a field works).
-- Both views: security_invoker, service role only.
--
-- Two steps, so the live site never reads a blanked row: this file adds the
-- encrypted columns and the views (which fall back to any plaintext left);
-- once the code reading the views is deployed,
-- migration-hc-encrypt-results-plans-2.sql backfills, blanks the plaintext
-- and switches the encryption triggers on.

-- jsonb helpers -------------------------------------------------------------
create or replace function public.encrypt_jsonb(p jsonb) returns bytea
language sql security definer set search_path = public, extensions as $$
  select case when p is null then null else public.encrypt_text(p::text) end
$$;
create or replace function public.decrypt_jsonb(p bytea) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select case when p is null then null else public.decrypt_text(p)::jsonb end
$$;
revoke all on function public.encrypt_jsonb(jsonb) from public, anon, authenticated;
revoke all on function public.decrypt_jsonb(bytea) from public, anon, authenticated;
grant execute on function public.encrypt_jsonb(jsonb) to service_role;
grant execute on function public.decrypt_jsonb(bytea) to service_role;

-- hc_results ----------------------------------------------------------------
alter table public.hc_results add column if not exists value_enc bytea;
alter table public.hc_results add column if not exists note_enc bytea;
alter table public.hc_results alter column value drop not null;

create or replace view public.hc_results_decrypted with (security_invoker = true) as
  select id, journey_id, client_id, marker,
    coalesce(public.decrypt_text(value_enc)::numeric, value) as value,
    unit, measured_at, source,
    coalesce(public.decrypt_text(note_enc), note) as note,
    entered_by, created_at, updated_at
  from public.hc_results;
revoke all on public.hc_results_decrypted from public, anon, authenticated;
grant select on public.hc_results_decrypted to service_role;

-- hc_action_plans -----------------------------------------------------------
alter table public.hc_action_plans add column if not exists headline_enc bytea;
alter table public.hc_action_plans add column if not exists summary_enc bytea;
alter table public.hc_action_plans add column if not exists goals_enc bytea;
alter table public.hc_action_plans add column if not exists modules_enc bytea;
alter table public.hc_action_plans add column if not exists exercise_enc bytea;
alter table public.hc_action_plans add column if not exists nutrition_enc bytea;
alter table public.hc_action_plans add column if not exists nurse_note_enc bytea;
do $$
declare c text;
begin
  foreach c in array array['headline','summary','goals','modules','exercise','nutrition','nurse_note'] loop
    execute format('alter table public.hc_action_plans alter column %I drop not null', c);
    execute format('alter table public.hc_action_plans alter column %I drop default', c);
  end loop;
end $$;

create or replace view public.hc_action_plans_decrypted with (security_invoker = true) as
  select id, journey_id, client_id, template_key,
    coalesce(public.decrypt_text(headline_enc), headline) as headline,
    coalesce(public.decrypt_text(summary_enc), summary) as summary,
    coalesce(public.decrypt_jsonb(goals_enc), goals, '[]'::jsonb) as goals,
    coalesce(public.decrypt_jsonb(modules_enc), modules, '[]'::jsonb) as modules,
    coalesce(public.decrypt_jsonb(exercise_enc), exercise) as exercise,
    coalesce(public.decrypt_jsonb(nutrition_enc), nutrition) as nutrition,
    coalesce(public.decrypt_text(nurse_note_enc), nurse_note) as nurse_note,
    start_date, review_date, status, published_at, version, created_by, updated_by,
    created_at, updated_at, lecture_slugs, edited_by_client_at
  from public.hc_action_plans;
revoke all on public.hc_action_plans_decrypted from public, anon, authenticated;
grant select, insert, update, delete on public.hc_action_plans_decrypted to service_role;

create or replace function public.tg_hc_action_plans_decrypted_insert() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  new.id := coalesce(new.id, gen_random_uuid());
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := coalesce(new.updated_at, now());
  new.status := coalesce(new.status, 'draft');
  new.version := coalesce(new.version, 1);
  new.lecture_slugs := coalesce(new.lecture_slugs, '{}');
  new.goals := coalesce(new.goals, '[]'::jsonb);
  new.modules := coalesce(new.modules, '[]'::jsonb);
  insert into public.hc_action_plans (id, journey_id, client_id, template_key,
    headline_enc, summary_enc, goals_enc, modules_enc, exercise_enc, nutrition_enc, nurse_note_enc,
    start_date, review_date, status, published_at, version, created_by, updated_by,
    created_at, updated_at, lecture_slugs, edited_by_client_at)
  values (new.id, new.journey_id, new.client_id, new.template_key,
    public.encrypt_text(new.headline), public.encrypt_text(new.summary), public.encrypt_jsonb(new.goals),
    public.encrypt_jsonb(new.modules), public.encrypt_jsonb(new.exercise), public.encrypt_jsonb(new.nutrition),
    public.encrypt_text(new.nurse_note),
    new.start_date, new.review_date, new.status, new.published_at, new.version, new.created_by, new.updated_by,
    new.created_at, new.updated_at, new.lecture_slugs, new.edited_by_client_at);
  return new;
end $$;

create or replace function public.tg_hc_action_plans_decrypted_update() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  -- A view trigger gets the whole row (untouched columns carry their current
  -- values), so every encrypted column is rewritten from NEW and any plaintext
  -- left from before the backfill is blanked with it.
  update public.hc_action_plans set
    journey_id = new.journey_id, client_id = new.client_id, template_key = new.template_key,
    headline_enc = public.encrypt_text(new.headline), summary_enc = public.encrypt_text(new.summary),
    goals_enc = public.encrypt_jsonb(coalesce(new.goals, '[]'::jsonb)), modules_enc = public.encrypt_jsonb(coalesce(new.modules, '[]'::jsonb)),
    exercise_enc = public.encrypt_jsonb(new.exercise), nutrition_enc = public.encrypt_jsonb(new.nutrition),
    nurse_note_enc = public.encrypt_text(new.nurse_note),
    headline = null, summary = null, goals = null, modules = null, exercise = null, nutrition = null, nurse_note = null,
    start_date = new.start_date, review_date = new.review_date, status = new.status, published_at = new.published_at,
    version = new.version, created_by = new.created_by, updated_by = new.updated_by,
    updated_at = new.updated_at, lecture_slugs = new.lecture_slugs, edited_by_client_at = new.edited_by_client_at
  where id = old.id;
  return new;
end $$;

create or replace function public.tg_hc_action_plans_decrypted_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.hc_action_plans where id = old.id;
  return old;
end $$;

revoke all on function public.tg_hc_action_plans_decrypted_insert() from public;
revoke all on function public.tg_hc_action_plans_decrypted_update() from public;
revoke all on function public.tg_hc_action_plans_decrypted_delete() from public;

drop trigger if exists hc_action_plans_decrypted_insert on public.hc_action_plans_decrypted;
drop trigger if exists hc_action_plans_decrypted_update on public.hc_action_plans_decrypted;
drop trigger if exists hc_action_plans_decrypted_delete on public.hc_action_plans_decrypted;
create trigger hc_action_plans_decrypted_insert instead of insert on public.hc_action_plans_decrypted
  for each row execute function public.tg_hc_action_plans_decrypted_insert();
create trigger hc_action_plans_decrypted_update instead of update on public.hc_action_plans_decrypted
  for each row execute function public.tg_hc_action_plans_decrypted_update();
create trigger hc_action_plans_decrypted_delete instead of delete on public.hc_action_plans_decrypted
  for each row execute function public.tg_hc_action_plans_decrypted_delete();

