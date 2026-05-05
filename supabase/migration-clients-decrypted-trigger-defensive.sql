-- =============================================================
-- Make the clients_decrypted INSTEAD OF UPDATE trigger defensive
-- against partial updates.
--
-- Problem
--   The trigger writes every column from NEW back to clients on
--   every update, on the assumption that Postgres has populated
--   NEW with OLD values for unchanged columns. In practice this
--   has been blanking biody_patient_id (and other plain non-
--   encrypted columns) on partial updates issued from the JS
--   client through the view — e.g. the markSeen() stamp on
--   welcome_seen_at, the macros / programs / journey_checks
--   updates that the dashboard makes throughout the session.
--
-- Fix
--   Rewrite each column assignment to "only write when NEW is
--   distinct from OLD". When NEW.col equals OLD.col we leave the
--   underlying clients column at its current value via the
--   self-reference pattern (`col = clients.col`). This makes the
--   trigger safe to call with any subset of the view's columns
--   without ever wiping unrelated state.
--
--   Encrypted columns already used this pattern (CASE WHEN NEW.x
--   IS DISTINCT FROM OLD.x THEN encrypt(NEW.x) ELSE x_enc END);
--   we extend the same pattern to every other writable column.
--
-- Run in the Supabase SQL editor. Idempotent — replaces the
-- function in place; the existing trigger reference is unchanged.
-- =============================================================

CREATE OR REPLACE FUNCTION public.tg_clients_decrypted_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.clients SET
    -- Plain (non-encrypted) columns — only overwrite when the
    -- caller actually changed them. CASE … IS DISTINCT FROM …
    -- handles NULL on either side cleanly.
    email = CASE WHEN NEW.email IS DISTINCT FROM OLD.email
                 THEN NEW.email ELSE clients.email END,
    full_name = CASE WHEN NEW.full_name IS DISTINCT FROM OLD.full_name
                     THEN NEW.full_name ELSE clients.full_name END,
    sex = CASE WHEN NEW.sex IS DISTINCT FROM OLD.sex
               THEN NEW.sex ELSE clients.sex END,
    height_cm = CASE WHEN NEW.height_cm IS DISTINCT FROM OLD.height_cm
                     THEN NEW.height_cm ELSE clients.height_cm END,
    weight_kg = CASE WHEN NEW.weight_kg IS DISTINCT FROM OLD.weight_kg
                     THEN NEW.weight_kg ELSE clients.weight_kg END,
    body_fat_pct = CASE WHEN NEW.body_fat_pct IS DISTINCT FROM OLD.body_fat_pct
                        THEN NEW.body_fat_pct ELSE clients.body_fat_pct END,
    muscle_mass_pct = CASE WHEN NEW.muscle_mass_pct IS DISTINCT FROM OLD.muscle_mass_pct
                           THEN NEW.muscle_mass_pct ELSE clients.muscle_mass_pct END,
    activity_level = CASE WHEN NEW.activity_level IS DISTINCT FROM OLD.activity_level
                          THEN NEW.activity_level ELSE clients.activity_level END,
    macro_goal = CASE WHEN NEW.macro_goal IS DISTINCT FROM OLD.macro_goal
                      THEN NEW.macro_goal ELSE clients.macro_goal END,
    avatar_url = CASE WHEN NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
                      THEN NEW.avatar_url ELSE clients.avatar_url END,
    company_id = CASE WHEN NEW.company_id IS DISTINCT FROM OLD.company_id
                      THEN NEW.company_id ELSE clients.company_id END,
    biody_patient_id = CASE WHEN NEW.biody_patient_id IS DISTINCT FROM OLD.biody_patient_id
                            THEN NEW.biody_patient_id ELSE clients.biody_patient_id END,
    biody_uuid = CASE WHEN NEW.biody_uuid IS DISTINCT FROM OLD.biody_uuid
                      THEN NEW.biody_uuid ELSE clients.biody_uuid END,
    biody_placeholder_data = CASE WHEN NEW.biody_placeholder_data IS DISTINCT FROM OLD.biody_placeholder_data
                                  THEN NEW.biody_placeholder_data ELSE clients.biody_placeholder_data END,
    biody_activation_started_at = CASE WHEN NEW.biody_activation_started_at IS DISTINCT FROM OLD.biody_activation_started_at
                                       THEN NEW.biody_activation_started_at ELSE clients.biody_activation_started_at END,
    last_body_comp_at = CASE WHEN NEW.last_body_comp_at IS DISTINCT FROM OLD.last_body_comp_at
                             THEN NEW.last_body_comp_at ELSE clients.last_body_comp_at END,
    welcome_seen_at = CASE WHEN NEW.welcome_seen_at IS DISTINCT FROM OLD.welcome_seen_at
                           THEN NEW.welcome_seen_at ELSE clients.welcome_seen_at END,
    terms_accepted_at = CASE WHEN NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at
                             THEN NEW.terms_accepted_at ELSE clients.terms_accepted_at END,
    terms_version = CASE WHEN NEW.terms_version IS DISTINCT FROM OLD.terms_version
                         THEN NEW.terms_version ELSE clients.terms_version END,
    updated_at = COALESCE(NEW.updated_at, now()),
    custom_programs = CASE WHEN NEW.custom_programs IS DISTINCT FROM OLD.custom_programs
                           THEN NEW.custom_programs ELSE clients.custom_programs END,
    exercise_profile = CASE WHEN NEW.exercise_profile IS DISTINCT FROM OLD.exercise_profile
                            THEN NEW.exercise_profile ELSE clients.exercise_profile END,
    journey_checks = CASE WHEN NEW.journey_checks IS DISTINCT FROM OLD.journey_checks
                          THEN NEW.journey_checks ELSE clients.journey_checks END,
    consistency_score = CASE WHEN NEW.consistency_score IS DISTINCT FROM OLD.consistency_score
                             THEN NEW.consistency_score ELSE clients.consistency_score END,
    intensity_score = CASE WHEN NEW.intensity_score IS DISTINCT FROM OLD.intensity_score
                           THEN NEW.intensity_score ELSE clients.intensity_score END,
    scores_updated_at = CASE WHEN NEW.scores_updated_at IS DISTINCT FROM OLD.scores_updated_at
                             THEN NEW.scores_updated_at ELSE clients.scores_updated_at END,
    video_consultation_portal_confirmed_at = CASE WHEN NEW.video_consultation_portal_confirmed_at IS DISTINCT FROM OLD.video_consultation_portal_confirmed_at
                                                  THEN NEW.video_consultation_portal_confirmed_at ELSE clients.video_consultation_portal_confirmed_at END,
    checkin_doctor_addon_paid_at = CASE WHEN NEW.checkin_doctor_addon_paid_at IS DISTINCT FROM OLD.checkin_doctor_addon_paid_at
                                        THEN NEW.checkin_doctor_addon_paid_at ELSE clients.checkin_doctor_addon_paid_at END,
    marketing_opt_out = CASE WHEN NEW.marketing_opt_out IS DISTINCT FROM OLD.marketing_opt_out
                             THEN NEW.marketing_opt_out ELSE clients.marketing_opt_out END,
    research_opt_out = CASE WHEN NEW.research_opt_out IS DISTINCT FROM OLD.research_opt_out
                            THEN NEW.research_opt_out ELSE clients.research_opt_out END,
    onboarding_complete = CASE WHEN NEW.onboarding_complete IS DISTINCT FROM OLD.onboarding_complete
                               THEN NEW.onboarding_complete ELSE clients.onboarding_complete END,
    onboarding_data = CASE WHEN NEW.onboarding_data IS DISTINCT FROM OLD.onboarding_data
                           THEN NEW.onboarding_data ELSE clients.onboarding_data END,
    track_macros = CASE WHEN NEW.track_macros IS DISTINCT FROM OLD.track_macros
                        THEN NEW.track_macros ELSE clients.track_macros END,
    share_points = CASE WHEN NEW.share_points IS DISTINCT FROM OLD.share_points
                        THEN NEW.share_points ELSE clients.share_points END,
    accountability_partner_id = CASE WHEN NEW.accountability_partner_id IS DISTINCT FROM OLD.accountability_partner_id
                                     THEN NEW.accountability_partner_id ELSE clients.accountability_partner_id END,
    accountability_partner_name = CASE WHEN NEW.accountability_partner_name IS DISTINCT FROM OLD.accountability_partner_name
                                       THEN NEW.accountability_partner_name ELSE clients.accountability_partner_name END,
    accountability_partner_score = CASE WHEN NEW.accountability_partner_score IS DISTINCT FROM OLD.accountability_partner_score
                                        THEN NEW.accountability_partner_score ELSE clients.accountability_partner_score END,
    deload_dismissed_at = CASE WHEN NEW.deload_dismissed_at IS DISTINCT FROM OLD.deload_dismissed_at
                               THEN NEW.deload_dismissed_at ELSE clients.deload_dismissed_at END,
    deload_recommended_at = CASE WHEN NEW.deload_recommended_at IS DISTINCT FROM OLD.deload_recommended_at
                                 THEN NEW.deload_recommended_at ELSE clients.deload_recommended_at END,
    suburb = CASE WHEN NEW.suburb IS DISTINCT FROM OLD.suburb
                  THEN NEW.suburb ELSE clients.suburb END,
    kennitala_encrypted = CASE WHEN NEW.kennitala_encrypted IS DISTINCT FROM OLD.kennitala_encrypted
                               THEN NEW.kennitala_encrypted ELSE clients.kennitala_encrypted END,

    -- Encrypted columns — already used the IS DISTINCT FROM
    -- pattern; pattern unchanged but tightened to reference
    -- clients.col rather than the bare column name, mirroring
    -- the new style above.
    phone_enc = CASE WHEN NEW.phone IS DISTINCT FROM OLD.phone
                     THEN public.encrypt_text(NEW.phone) ELSE clients.phone_enc END,
    address_enc = CASE WHEN NEW.address IS DISTINCT FROM OLD.address
                       THEN public.encrypt_text(NEW.address) ELSE clients.address_enc END,
    date_of_birth_enc = CASE WHEN NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
                             THEN public.encrypt_text(NEW.date_of_birth::TEXT) ELSE clients.date_of_birth_enc END,
    emergency_contact_name_enc = CASE WHEN NEW.emergency_contact_name IS DISTINCT FROM OLD.emergency_contact_name
                                      THEN public.encrypt_text(NEW.emergency_contact_name) ELSE clients.emergency_contact_name_enc END,
    emergency_contact_phone_enc = CASE WHEN NEW.emergency_contact_phone IS DISTINCT FROM OLD.emergency_contact_phone
                                       THEN public.encrypt_text(NEW.emergency_contact_phone) ELSE clients.emergency_contact_phone_enc END,
    kennitala_last4_enc = CASE WHEN NEW.kennitala_last4 IS DISTINCT FROM OLD.kennitala_last4
                               THEN public.encrypt_text(NEW.kennitala_last4) ELSE clients.kennitala_last4_enc END
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

-- Trigger registration is unchanged (still INSTEAD OF UPDATE on
-- public.clients_decrypted, calling tg_clients_decrypted_update);
-- replacing the function body is enough.
