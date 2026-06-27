-- =============================================================
-- Research Data Module — schema
-- Cohorts, longitudinal Medalia data exports (timepoints), per-patient
-- observations (scores/labs/measurements), raw questionnaire answers,
-- computed trends, cached AI analyses, and an access audit log.
--
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- Design note: Medalia exports identify patients by a pseudonymous
-- `patientId` UUID that does NOT map to public.clients / auth.users.
-- Research data is therefore STANDALONE — `medalia_patient_id` is a plain
-- uuid, not a foreign key. A link table to public.clients can be added
-- later if identity resolution is ever required.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. cohorts
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_cohorts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  pathway       text,                         -- e.g. "Vestmanneyjar verkferli"
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 2. exports  (one row per uploaded JSON = one timepoint)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_exports (
  id              uuid primary key default gen_random_uuid(),
  cohort_id       uuid not null references public.research_cohorts(id) on delete cascade,
  timepoint_label text not null,              -- 'baseline' | '3mo' | '6mo' | '9mo' | '12mo'
  timepoint_order int not null default 0,     -- sort key (0,3,6,9,12 months)
  export_type     text not null default 'full', -- 'full' | 'no_bloods'
  exported_at     timestamptz,                -- exportedAt from the JSON
  source_filename text,
  patient_count   int not null default 0,
  observation_count int not null default 0,
  answer_count    int not null default 0,
  raw_storage_path text,                      -- path in research-exports bucket
  uploaded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (cohort_id, timepoint_label)
);

CREATE INDEX IF NOT EXISTS research_exports_cohort_idx
  ON public.research_exports (cohort_id, timepoint_order);

-- ---------------------------------------------------------------
-- 3. patients  (stable identity within a cohort, across timepoints)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_patients (
  id                uuid primary key default gen_random_uuid(),
  cohort_id         uuid not null references public.research_cohorts(id) on delete cascade,
  medalia_patient_id uuid not null,
  gender            text,
  latest_age        int,
  group_name        text,                     -- workplace group (Leikskólinn / Höfnin)
  first_seen_at     timestamptz not null default now(),
  unique (cohort_id, medalia_patient_id)
);

CREATE INDEX IF NOT EXISTS research_patients_cohort_idx
  ON public.research_patients (cohort_id);

-- ---------------------------------------------------------------
-- 4. observations  (flattened long table — analytics substrate)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_observations (
  id                uuid primary key default gen_random_uuid(),
  export_id         uuid not null references public.research_exports(id) on delete cascade,
  cohort_id         uuid not null references public.research_cohorts(id) on delete cascade,
  medalia_patient_id uuid not null,
  timepoint_label   text not null,
  timepoint_order   int not null default 0,
  obs_type          text not null,            -- 'score' | 'lab' | 'measurement'
  code              text not null,            -- raw code (LOINC or internal)
  feature           text not null,            -- friendly name (hba1c, phq9, ...)
  display           text,
  observed_at       timestamptz,
  value_num         numeric,
  value_text        text,
  value_bool        boolean,
  unit              text
);

CREATE INDEX IF NOT EXISTS research_obs_export_idx ON public.research_observations (export_id);
CREATE INDEX IF NOT EXISTS research_obs_cohort_feature_idx
  ON public.research_observations (cohort_id, feature, timepoint_order);
CREATE INDEX IF NOT EXISTS research_obs_patient_idx
  ON public.research_observations (cohort_id, medalia_patient_id);

-- ---------------------------------------------------------------
-- 5. answers  (raw questionnaire item responses)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_answers (
  id                uuid primary key default gen_random_uuid(),
  export_id         uuid not null references public.research_exports(id) on delete cascade,
  cohort_id         uuid not null references public.research_cohorts(id) on delete cascade,
  medalia_patient_id uuid not null,
  questionnaire_id  text,
  questionnaire_title text,
  authored_at       timestamptz,
  link_id           text,
  question_text     text,
  value_text        text
);

CREATE INDEX IF NOT EXISTS research_answers_export_idx ON public.research_answers (export_id);
CREATE INDEX IF NOT EXISTS research_answers_patient_idx
  ON public.research_answers (cohort_id, medalia_patient_id);

-- ---------------------------------------------------------------
-- 6. trends  (cached per cohort x feature x timepoint aggregates)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_trends (
  id                uuid primary key default gen_random_uuid(),
  cohort_id         uuid not null references public.research_cohorts(id) on delete cascade,
  feature           text not null,
  obs_type          text not null,
  display           text,
  unit              text,
  timepoint_label   text not null,
  timepoint_order   int not null default 0,
  n                 int not null default 0,
  n_missing         int not null default 0,
  mean              numeric,
  median            numeric,
  sd                numeric,
  min               numeric,
  max               numeric,
  computed_at       timestamptz not null default now(),
  unique (cohort_id, feature, timepoint_label)
);

CREATE INDEX IF NOT EXISTS research_trends_cohort_idx
  ON public.research_trends (cohort_id, feature, timepoint_order);

-- ---------------------------------------------------------------
-- 7. ai_analyses  (cached AI trend narratives — aggregate input only)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_ai_analyses (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references public.research_cohorts(id) on delete cascade,
  scope         text not null default 'cohort',  -- 'cohort' | 'feature' | 'group'
  model         text,
  summary_md    text,
  payload       jsonb,                            -- the aggregate stats fed to the model
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS research_ai_analyses_cohort_idx
  ON public.research_ai_analyses (cohort_id, created_at desc);

-- ---------------------------------------------------------------
-- 8. access_log  (explicit audit — API logs the real staff actor)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_access_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  actor_email   text,
  action        text not null,                -- 'ingest' | 'export' | 'view' | 'ai_analyze' | 'delete'
  cohort_id     uuid,
  export_id     uuid,
  detail        jsonb,
  created_at    timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS research_access_log_cohort_idx
  ON public.research_access_log (cohort_id, created_at desc);

-- ---------------------------------------------------------------
-- 9. Row Level Security
--    All access is API-mediated via the service-role client, so the
--    primary guard is "Block client access". Admin/clinician policies
--    are belt-and-suspenders for any direct authenticated access.
-- ---------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'research_cohorts','research_exports','research_patients',
    'research_observations','research_answers','research_trends',
    'research_ai_analyses','research_access_log'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS "Block client access" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "Block client access" ON public.%I FOR ALL USING (false) WITH CHECK (false);', t);

    EXECUTE format('DROP POLICY IF EXISTS "Admin manages research data" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "Admin manages research data" ON public.%I FOR ALL TO authenticated USING (is_admin_staff()) WITH CHECK (is_admin_staff());', t);

    EXECUTE format('DROP POLICY IF EXISTS "Clinicians read research data" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "Clinicians read research data" ON public.%I FOR SELECT TO authenticated USING (is_active_clinician() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------
-- 10. Storage bucket for raw JSON exports
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-exports', 'research-exports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin manage research exports" ON storage.objects;
CREATE POLICY "admin manage research exports" ON storage.objects
  FOR ALL USING (bucket_id = 'research-exports' AND is_admin_staff())
  WITH CHECK (bucket_id = 'research-exports' AND is_admin_staff());

NOTIFY pgrst, 'reload schema';
