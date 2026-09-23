-- clients_decrypted INSERT: keep the base table's defaults.
--
-- The trigger passes every column through explicitly, so an insert that omits
-- a NOT NULL column with a default (research_opt_out, marketing_opt_out,
-- journey_checks, biody_placeholder_data) wrote NULL and was rejected. Any
-- caller that did not list those four hit it — the admin bulk invite and the
-- workstation's "create client from a report" both did. COALESCE restores the
-- default instead.

CREATE OR REPLACE FUNCTION public.tg_clients_decrypted_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  BEGIN
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
      NEW.id, NEW.email, NEW.full_name,
      NEW.sex, NEW.height_cm, NEW.weight_kg, NEW.body_fat_pct, NEW.muscle_mass_pct,
      NEW.activity_level, NEW.macro_goal, NEW.avatar_url,
      NEW.company_id, NEW.biody_patient_id, NEW.biody_uuid, COALESCE(NEW.biody_placeholder_data, false), NEW.biody_activation_started_at,
      NEW.last_body_comp_at, NEW.welcome_seen_at,
      NEW.terms_accepted_at, NEW.terms_version,
      NEW.created_at, NEW.updated_at,
      NEW.custom_programs, NEW.exercise_profile, COALESCE(NEW.journey_checks, '{}'::jsonb),
      NEW.consistency_score, NEW.intensity_score, NEW.scores_updated_at,
      NEW.video_consultation_portal_confirmed_at, NEW.checkin_doctor_addon_paid_at,
      COALESCE(NEW.marketing_opt_out, false), COALESCE(NEW.research_opt_out, false),
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
  $function$
;
