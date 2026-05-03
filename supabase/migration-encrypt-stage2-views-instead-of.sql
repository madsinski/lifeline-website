-- =============================================================
-- Stage 2: make the *_decrypted views fully updatable.
--
-- Adds INSTEAD OF INSERT/UPDATE triggers so application code can do
-- the same .from("clients_decrypted").insert/update/select calls it
-- does today on the base table. Encryption happens transparently in
-- the trigger.
--
-- DELETE doesn't need an INSTEAD OF — Postgres handles deletes on
-- single-table views automatically via the security_invoker route.
--
-- Run after the encryption foundation + per-column migrations.
-- =============================================================

-- ─── clients_decrypted: rebuild with ALL columns ─────────────
DROP VIEW IF EXISTS public.clients_decrypted CASCADE;

CREATE VIEW public.clients_decrypted
WITH (security_invoker = true) AS
SELECT
  -- Identity / non-sensitive metadata
  id, email, full_name,
  sex, height_cm, weight_kg, body_fat_pct, muscle_mass_pct,
  activity_level, macro_goal, avatar_url,
  company_id, biody_patient_id, biody_uuid, biody_placeholder_data,
  biody_activation_started_at,
  last_body_comp_at, welcome_seen_at,
  terms_accepted_at, terms_version,
  created_at, updated_at,
  custom_programs, exercise_profile, journey_checks,
  consistency_score, intensity_score, scores_updated_at,
  video_consultation_portal_confirmed_at,
  checkin_doctor_addon_paid_at,
  marketing_opt_out, research_opt_out,
  onboarding_complete, onboarding_data,
  track_macros, share_points,
  accountability_partner_id, accountability_partner_name, accountability_partner_score,
  deload_dismissed_at, deload_recommended_at,
  suburb,
  kennitala_encrypted,  -- separate, pre-existing encryption mechanism for full kennitala (companies flow)

  -- Encrypted columns, decrypted for read
  public.decrypt_text(phone_enc) AS phone,
  public.decrypt_text(address_enc) AS address,
  public.decrypt_text(date_of_birth_enc)::DATE AS date_of_birth,
  public.decrypt_text(emergency_contact_name_enc) AS emergency_contact_name,
  public.decrypt_text(emergency_contact_phone_enc) AS emergency_contact_phone,
  public.decrypt_text(kennitala_last4_enc) AS kennitala_last4
FROM public.clients;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients_decrypted TO authenticated, service_role;

-- INSTEAD OF INSERT
CREATE OR REPLACE FUNCTION public.tg_clients_decrypted_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Materialise defaults onto NEW so PostgREST's RETURNING gets the
  -- generated id (see messages_decrypted insert for the same pattern).
  IF NEW.id IS NULL THEN NEW.id := gen_random_uuid(); END IF;
  IF NEW.created_at IS NULL THEN NEW.created_at := now(); END IF;
  IF NEW.updated_at IS NULL THEN NEW.updated_at := now(); END IF;

  INSERT INTO public.clients (
    id, email, full_name,
    sex, height_cm, weight_kg, body_fat_pct, muscle_mass_pct,
    activity_level, macro_goal, avatar_url,
    company_id, biody_patient_id, biody_uuid, biody_placeholder_data, biody_activation_started_at,
    last_body_comp_at, welcome_seen_at,
    terms_accepted_at, terms_version,
    created_at, updated_at,
    custom_programs, exercise_profile, journey_checks,
    consistency_score, intensity_score, scores_updated_at,
    video_consultation_portal_confirmed_at, checkin_doctor_addon_paid_at,
    marketing_opt_out, research_opt_out,
    onboarding_complete, onboarding_data,
    track_macros, share_points,
    accountability_partner_id, accountability_partner_name, accountability_partner_score,
    deload_dismissed_at, deload_recommended_at, suburb,
    kennitala_encrypted,
    phone_enc, address_enc, date_of_birth_enc,
    emergency_contact_name_enc, emergency_contact_phone_enc, kennitala_last4_enc
  ) VALUES (
    NEW.id,
    NEW.email, NEW.full_name,
    NEW.sex, NEW.height_cm, NEW.weight_kg, NEW.body_fat_pct, NEW.muscle_mass_pct,
    NEW.activity_level, NEW.macro_goal, NEW.avatar_url,
    NEW.company_id, NEW.biody_patient_id, NEW.biody_uuid, NEW.biody_placeholder_data, NEW.biody_activation_started_at,
    NEW.last_body_comp_at, NEW.welcome_seen_at,
    NEW.terms_accepted_at, NEW.terms_version,
    NEW.created_at, NEW.updated_at,
    NEW.custom_programs, NEW.exercise_profile, NEW.journey_checks,
    NEW.consistency_score, NEW.intensity_score, NEW.scores_updated_at,
    NEW.video_consultation_portal_confirmed_at, NEW.checkin_doctor_addon_paid_at,
    NEW.marketing_opt_out, NEW.research_opt_out,
    NEW.onboarding_complete, NEW.onboarding_data,
    NEW.track_macros, NEW.share_points,
    NEW.accountability_partner_id, NEW.accountability_partner_name, NEW.accountability_partner_score,
    NEW.deload_dismissed_at, NEW.deload_recommended_at, NEW.suburb,
    NEW.kennitala_encrypted,
    public.encrypt_text(NEW.phone),
    public.encrypt_text(NEW.address),
    public.encrypt_text(NEW.date_of_birth::TEXT),
    public.encrypt_text(NEW.emergency_contact_name),
    public.encrypt_text(NEW.emergency_contact_phone),
    public.encrypt_text(NEW.kennitala_last4)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS clients_decrypted_insert ON public.clients_decrypted;
CREATE TRIGGER clients_decrypted_insert
INSTEAD OF INSERT ON public.clients_decrypted
FOR EACH ROW EXECUTE FUNCTION public.tg_clients_decrypted_insert();

-- INSTEAD OF UPDATE
-- Updates every column from NEW; encrypts the encrypted ones only when
-- the plaintext actually changed (avoid re-encrypting unchanged values
-- and producing different ciphertexts each time).
CREATE OR REPLACE FUNCTION public.tg_clients_decrypted_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.clients SET
    email = NEW.email,
    full_name = NEW.full_name,
    sex = NEW.sex,
    height_cm = NEW.height_cm,
    weight_kg = NEW.weight_kg,
    body_fat_pct = NEW.body_fat_pct,
    muscle_mass_pct = NEW.muscle_mass_pct,
    activity_level = NEW.activity_level,
    macro_goal = NEW.macro_goal,
    avatar_url = NEW.avatar_url,
    company_id = NEW.company_id,
    biody_patient_id = NEW.biody_patient_id,
    biody_uuid = NEW.biody_uuid,
    biody_placeholder_data = NEW.biody_placeholder_data,
    biody_activation_started_at = NEW.biody_activation_started_at,
    last_body_comp_at = NEW.last_body_comp_at,
    welcome_seen_at = NEW.welcome_seen_at,
    terms_accepted_at = NEW.terms_accepted_at,
    terms_version = NEW.terms_version,
    updated_at = COALESCE(NEW.updated_at, now()),
    custom_programs = NEW.custom_programs,
    exercise_profile = NEW.exercise_profile,
    journey_checks = NEW.journey_checks,
    consistency_score = NEW.consistency_score,
    intensity_score = NEW.intensity_score,
    scores_updated_at = NEW.scores_updated_at,
    video_consultation_portal_confirmed_at = NEW.video_consultation_portal_confirmed_at,
    checkin_doctor_addon_paid_at = NEW.checkin_doctor_addon_paid_at,
    marketing_opt_out = NEW.marketing_opt_out,
    research_opt_out = NEW.research_opt_out,
    onboarding_complete = NEW.onboarding_complete,
    onboarding_data = NEW.onboarding_data,
    track_macros = NEW.track_macros,
    share_points = NEW.share_points,
    accountability_partner_id = NEW.accountability_partner_id,
    accountability_partner_name = NEW.accountability_partner_name,
    accountability_partner_score = NEW.accountability_partner_score,
    deload_dismissed_at = NEW.deload_dismissed_at,
    deload_recommended_at = NEW.deload_recommended_at,
    suburb = NEW.suburb,
    kennitala_encrypted = NEW.kennitala_encrypted,
    phone_enc = CASE WHEN NEW.phone IS DISTINCT FROM OLD.phone
                     THEN public.encrypt_text(NEW.phone) ELSE phone_enc END,
    address_enc = CASE WHEN NEW.address IS DISTINCT FROM OLD.address
                       THEN public.encrypt_text(NEW.address) ELSE address_enc END,
    date_of_birth_enc = CASE WHEN NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
                             THEN public.encrypt_text(NEW.date_of_birth::TEXT) ELSE date_of_birth_enc END,
    emergency_contact_name_enc = CASE WHEN NEW.emergency_contact_name IS DISTINCT FROM OLD.emergency_contact_name
                                      THEN public.encrypt_text(NEW.emergency_contact_name) ELSE emergency_contact_name_enc END,
    emergency_contact_phone_enc = CASE WHEN NEW.emergency_contact_phone IS DISTINCT FROM OLD.emergency_contact_phone
                                       THEN public.encrypt_text(NEW.emergency_contact_phone) ELSE emergency_contact_phone_enc END,
    kennitala_last4_enc = CASE WHEN NEW.kennitala_last4 IS DISTINCT FROM OLD.kennitala_last4
                               THEN public.encrypt_text(NEW.kennitala_last4) ELSE kennitala_last4_enc END
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS clients_decrypted_update ON public.clients_decrypted;
CREATE TRIGGER clients_decrypted_update
INSTEAD OF UPDATE ON public.clients_decrypted
FOR EACH ROW EXECUTE FUNCTION public.tg_clients_decrypted_update();

-- ─── messages_decrypted: rebuild + INSTEAD OF triggers ────────
DROP VIEW IF EXISTS public.messages_decrypted CASCADE;

CREATE VIEW public.messages_decrypted
WITH (security_invoker = true) AS
SELECT
  id,
  conversation_id,
  sender_id,
  sender_name,
  sender_role,
  public.decrypt_text(content_enc) AS content,
  read,
  created_at
FROM public.messages;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages_decrypted TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_messages_decrypted_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Materialise defaults onto NEW *before* INSERT, so PostgREST's
  -- INSERT ... RETURNING returns a complete row (otherwise NEW.id is
  -- still NULL when supabase-js calls .select().single() and the
  -- client treats it as "no row inserted").
  IF NEW.id IS NULL THEN NEW.id := gen_random_uuid(); END IF;
  IF NEW.created_at IS NULL THEN NEW.created_at := now(); END IF;
  IF NEW.read IS NULL THEN NEW.read := false; END IF;

  INSERT INTO public.messages (
    id, conversation_id, sender_id, sender_name, sender_role,
    content_enc, read, created_at
  ) VALUES (
    NEW.id, NEW.conversation_id, NEW.sender_id, NEW.sender_name, NEW.sender_role,
    public.encrypt_text(NEW.content),
    NEW.read,
    NEW.created_at
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messages_decrypted_insert ON public.messages_decrypted;
CREATE TRIGGER messages_decrypted_insert
INSTEAD OF INSERT ON public.messages_decrypted
FOR EACH ROW EXECUTE FUNCTION public.tg_messages_decrypted_insert();

CREATE OR REPLACE FUNCTION public.tg_messages_decrypted_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.messages SET
    conversation_id = NEW.conversation_id,
    sender_id = NEW.sender_id,
    sender_name = NEW.sender_name,
    sender_role = NEW.sender_role,
    content_enc = CASE WHEN NEW.content IS DISTINCT FROM OLD.content
                       THEN public.encrypt_text(NEW.content) ELSE content_enc END,
    read = NEW.read
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messages_decrypted_update ON public.messages_decrypted;
CREATE TRIGGER messages_decrypted_update
INSTEAD OF UPDATE ON public.messages_decrypted
FOR EACH ROW EXECUTE FUNCTION public.tg_messages_decrypted_update();
