-- The Lifeline ↔ Medalia split (Mads, 2026-10-16).
--
-- Medalia is the sjúkraskrá and runs the clinical side: the report, the
-- doctor's interview, and releasing the report to the patient. Lifeline is
-- the coaching service: measurements, the Áætlunarsamtal (plan session), the
-- plan and the follow-up. This migration carries the data side of that:
--
--   1. hc_journeys.staff_import_consent_at / _version — a nurse may put the
--      client's Medalia report in on their behalf ONLY after the client has
--      allowed it in the app (POST /api/hc/journey {action:"allow_staff_import"}).
--   2. hc_journeys.doctor_interview_done_at — the doctor's interview happened
--      in Medalia (journey event "doctor_interview_done"). The interview_*
--      columns now mean Lifeline's own Áætlunarsamtal.
--   3. hc_results.source may be 'self' (the participant), 'report' (read off a
--      report) and 'station' (Lifeline's measurement station), besides the
--      historic 'manual' / 'medalia' / 'biody' / 'lab'.
--   4. Free-text notes are encrypted at column level with the same pgcrypto +
--      Vault key as hc_results (public.encrypt_text / decrypt_text):
--        hc_journeys.interview_notes, followup_notes, doctor_review_note,
--        referral_note  →  *_enc bytea
--        hc_referrals.note, reason  →  note_enc, reason_enc
--      The plaintext columns are kept (NULL) for now and a BEFORE trigger
--      moves anything written to them into the *_enc column, so no code path
--      — old, new or a stray direct update — can put plaintext back.
--      Reads go through hc_journey_notes() and hc_referrals_decrypted,
--      service_role only.
--
-- Idempotent. Applied with:
--   supabase db query --linked -f supabase/migration-hc-medalia-split.sql

-- ── 1 + 2. New journey columns ──────────────────────────────────────────────
alter table public.hc_journeys add column if not exists staff_import_consent_at timestamptz;
alter table public.hc_journeys add column if not exists staff_import_consent_version text;
alter table public.hc_journeys add column if not exists doctor_interview_done_at timestamptz;

-- ── 3. hc_results.source ────────────────────────────────────────────────────
alter table public.hc_results drop constraint if exists hc_results_source_check;
alter table public.hc_results add constraint hc_results_source_check
  check (source in ('manual', 'medalia', 'biody', 'lab', 'self', 'report', 'station'));

-- ── 4a. Encrypted note columns ──────────────────────────────────────────────
alter table public.hc_journeys add column if not exists interview_notes_enc bytea;
alter table public.hc_journeys add column if not exists followup_notes_enc bytea;
alter table public.hc_journeys add column if not exists doctor_review_note_enc bytea;
alter table public.hc_journeys add column if not exists referral_note_enc bytea;
alter table public.hc_referrals add column if not exists note_enc bytea;
alter table public.hc_referrals add column if not exists reason_enc bytea;

-- The plaintext columns must be able to hold NULL.
alter table public.hc_journeys alter column interview_notes drop not null;
alter table public.hc_journeys alter column interview_notes drop default;
alter table public.hc_referrals alter column reason drop not null;

-- ── 4b. Write-side guard: plaintext in, ciphertext stored ──────────────────
-- An empty jsonb object is "no notes", not something worth a ciphertext.
create or replace function public.hc_journeys_encrypt_notes() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.interview_notes is not null then
    new.interview_notes_enc := case when new.interview_notes = '{}'::jsonb then null
                                    else public.encrypt_text(new.interview_notes::text) end;
    new.interview_notes := null;
  end if;
  if new.followup_notes is not null then
    new.followup_notes_enc := case when new.followup_notes = '{}'::jsonb then null
                                   else public.encrypt_text(new.followup_notes::text) end;
    new.followup_notes := null;
  end if;
  if new.doctor_review_note is not null then
    new.doctor_review_note_enc := public.encrypt_text(new.doctor_review_note);
    new.doctor_review_note := null;
  end if;
  if new.referral_note is not null then
    new.referral_note_enc := public.encrypt_text(new.referral_note);
    new.referral_note := null;
  end if;
  return new;
end $$;

drop trigger if exists hc_journeys_encrypt_notes_trg on public.hc_journeys;
create trigger hc_journeys_encrypt_notes_trg
  before insert or update of interview_notes, followup_notes, doctor_review_note, referral_note
  on public.hc_journeys
  for each row execute function public.hc_journeys_encrypt_notes();

create or replace function public.hc_referrals_encrypt_notes() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.note is not null then
    new.note_enc := public.encrypt_text(new.note);
    new.note := null;
  end if;
  if new.reason is not null then
    new.reason_enc := public.encrypt_text(new.reason);
    new.reason := null;
  end if;
  return new;
end $$;

drop trigger if exists hc_referrals_encrypt_notes_trg on public.hc_referrals;
create trigger hc_referrals_encrypt_notes_trg
  before insert or update of note, reason
  on public.hc_referrals
  for each row execute function public.hc_referrals_encrypt_notes();

-- ── 4c. Backfill: firing the trigger on existing plaintext encrypts it ─────
update public.hc_journeys
   set interview_notes = interview_notes, followup_notes = followup_notes,
       doctor_review_note = doctor_review_note, referral_note = referral_note
 where interview_notes is not null or followup_notes is not null
    or doctor_review_note is not null or referral_note is not null;

update public.hc_referrals
   set note = note, reason = reason
 where note is not null or reason is not null;

-- ── 4d. Read side (service_role only) ───────────────────────────────────────
create or replace function public.hc_journey_notes(p_ids uuid[])
returns table (id uuid, interview_notes jsonb, followup_notes jsonb, doctor_review_note text, referral_note text)
language sql stable security definer set search_path = public, extensions as $$
  select j.id,
         coalesce(public.decrypt_text(j.interview_notes_enc)::jsonb, '{}'::jsonb),
         public.decrypt_text(j.followup_notes_enc)::jsonb,
         public.decrypt_text(j.doctor_review_note_enc),
         public.decrypt_text(j.referral_note_enc)
    from public.hc_journeys j
   where j.id = any(p_ids)
$$;
revoke all on function public.hc_journey_notes(uuid[]) from public, anon, authenticated;
grant execute on function public.hc_journey_notes(uuid[]) to service_role;

-- Clearing a note (a NULL write leaves the ciphertext alone, on purpose).
create or replace function public.hc_journey_clear_note(p_id uuid, p_field text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_field = 'interview_notes' then update public.hc_journeys set interview_notes_enc = null where id = p_id;
  elsif p_field = 'followup_notes' then update public.hc_journeys set followup_notes_enc = null where id = p_id;
  elsif p_field = 'doctor_review_note' then update public.hc_journeys set doctor_review_note_enc = null where id = p_id;
  elsif p_field = 'referral_note' then update public.hc_journeys set referral_note_enc = null where id = p_id;
  else raise exception 'unknown note field %', p_field;
  end if;
end $$;
revoke all on function public.hc_journey_clear_note(uuid, text) from public, anon, authenticated;
grant execute on function public.hc_journey_clear_note(uuid, text) to service_role;

create or replace view public.hc_referrals_decrypted
with (security_invoker = true) as
select id, journey_id, client_id, target,
       public.decrypt_text(reason_enc) as reason,
       public.decrypt_text(note_enc)   as note,
       status, suggested_by, requested_by, doctor_notified_at, decided_by, decided_at,
       created_at, partner_id, consent_at, consent_by, sent_at, sent_by, contacted_at
from public.hc_referrals;

revoke all on public.hc_referrals_decrypted from public, anon, authenticated;
grant select on public.hc_referrals_decrypted to service_role;

notify pgrst, 'reload schema';
