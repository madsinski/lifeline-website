-- Step 2 of migration-hc-encrypt-results-plans.sql: run after the code that
-- reads hc_results_decrypted / hc_action_plans_decrypted is deployed.
-- Encrypts every remaining plaintext value, blanks it, and from here on
-- encrypts on write (hc_results) or refuses plaintext (hc_action_plans).
-- Idempotent.

create or replace function public.hc_results_encrypt() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.value is not null then
    new.value_enc := public.encrypt_text(new.value::text);
    new.value := null;
    -- value and note always arrive together (see header).
    new.note_enc := public.encrypt_text(new.note);
    new.note := null;
  elsif new.note is not null then
    new.note_enc := public.encrypt_text(new.note);
    new.note := null;
  end if;
  return new;
end $$;
revoke all on function public.hc_results_encrypt() from public;

drop trigger if exists hc_results_encrypt on public.hc_results;
create trigger hc_results_encrypt before insert or update on public.hc_results
  for each row execute function public.hc_results_encrypt();

-- Backfill: rows with plaintext still in them.
update public.hc_results set value = value where value is not null or note is not null;


-- Backfill (only rows not yet encrypted).
update public.hc_action_plans set
  headline_enc = coalesce(headline_enc, public.encrypt_text(headline)), summary_enc = coalesce(summary_enc, public.encrypt_text(summary)),
  goals_enc = coalesce(goals_enc, public.encrypt_jsonb(goals)), modules_enc = coalesce(modules_enc, public.encrypt_jsonb(modules)),
  exercise_enc = coalesce(exercise_enc, public.encrypt_jsonb(exercise)), nutrition_enc = coalesce(nutrition_enc, public.encrypt_jsonb(nutrition)),
  nurse_note_enc = coalesce(nurse_note_enc, public.encrypt_text(nurse_note)),
  headline = null, summary = null, goals = null, modules = null, exercise = null, nutrition = null, nurse_note = null
where modules is not null or goals is not null or headline is not null or summary is not null or nurse_note is not null or exercise is not null or nutrition is not null;


-- Nothing may put plaintext back into the base table by mistake.
create or replace function public.hc_action_plans_no_plaintext() returns trigger
language plpgsql as $$
begin
  if new.headline is not null or new.summary is not null or new.goals is not null or new.modules is not null
     or new.exercise is not null or new.nutrition is not null or new.nurse_note is not null then
    raise exception 'hc_action_plans: write through hc_action_plans_decrypted (encrypted columns)';
  end if;
  return new;
end $$;
drop trigger if exists hc_action_plans_no_plaintext on public.hc_action_plans;
create trigger hc_action_plans_no_plaintext before insert or update on public.hc_action_plans
  for each row execute function public.hc_action_plans_no_plaintext();
