-- =============================================================
-- Client feedback surveys — admin-initiated, medical-advisor-
-- approved, client-completed. Replaces the per-stage satisfaction
-- modals (which only collected three NPS-like fields).
--
-- Surface owners:
--   admin           — creates/edits surveys, sends to clients,
--                     sees full results.
--   medical_advisor — NEW external role. Reviews + approves the
--                     question structure, reads results, exports
--                     to CSV. Isolated from clinical data exactly
--                     the same way as lawyer (no clients, no
--                     messages, no sjúkraskrá).
--   coach/doctor/nurse/psych — read-only on aggregates of clients
--                              they actually serve (later — not
--                              wired in this migration).
--   client          — submits responses via a single-use signed
--                     link; no auth needed (token is the auth).
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

-- ─── 1. Extend staff role enum to include 'medical_advisor' ──────
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_role_check
  CHECK (role IN ('coach','doctor','nurse','psychologist','admin','lawyer','medical_advisor'));

-- ─── 2. is_active_medical_advisor() helper ────────────────────────
CREATE OR REPLACE FUNCTION public.is_active_medical_advisor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = auth.uid() AND active = true AND role = 'medical_advisor'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_medical_advisor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_medical_advisor() TO authenticated;

-- ─── 3. Isolate medical_advisor from clinical data ────────────────
-- Same pattern as lawyer isolation in migration-lawyer-role.sql.
-- Add `AND NOT is_active_medical_advisor()` to every policy that
-- already filters out lawyer.

-- clients
DROP POLICY IF EXISTS "Staff can view all clients" ON public.clients;
CREATE POLICY "Staff can view all clients" ON public.clients
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());

DROP POLICY IF EXISTS "Staff can update clients" ON public.clients;
CREATE POLICY "Staff can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor())
  WITH CHECK (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());

-- client_programs
DROP POLICY IF EXISTS "Staff can view client programs" ON public.client_programs;
CREATE POLICY "Staff can view client programs" ON public.client_programs
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());

DROP POLICY IF EXISTS "Staff can manage client programs" ON public.client_programs;
CREATE POLICY "Staff can manage client programs" ON public.client_programs
  FOR ALL TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor())
  WITH CHECK (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());

-- subscriptions
DROP POLICY IF EXISTS "Staff can view subscriptions" ON public.subscriptions;
CREATE POLICY "Staff can view subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());

DROP POLICY IF EXISTS "Staff can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Staff can manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor())
  WITH CHECK (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());

-- action_completions
DROP POLICY IF EXISTS "Staff can view action completions" ON public.action_completions;
CREATE POLICY "Staff can view action completions" ON public.action_completions
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());

-- health_records
DROP POLICY IF EXISTS "Staff can view health records" ON public.health_records;
CREATE POLICY "Staff can view health records" ON public.health_records
  FOR SELECT TO authenticated
  USING (is_active_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());

-- health_audit_log (admin-only — but tighten anyway)
DROP POLICY IF EXISTS "Admins can read health audit log" ON public.health_audit_log;
CREATE POLICY "Admins can read health audit log" ON public.health_audit_log
  FOR SELECT TO authenticated
  USING (is_admin_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());

-- dsr_requests
DROP POLICY IF EXISTS "Admins can manage dsr requests" ON public.dsr_requests;
CREATE POLICY "Admins can manage dsr requests" ON public.dsr_requests
  FOR ALL TO authenticated
  USING (is_admin_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor())
  WITH CHECK (is_admin_staff() AND NOT is_active_lawyer() AND NOT is_active_medical_advisor());


-- ─── 4. feedback_surveys table — survey definitions ─────────────
-- One row per (key, version). New version on substantive changes
-- so already-collected responses stay correctly attributed.
CREATE TABLE IF NOT EXISTS public.feedback_surveys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL,                              -- 'post-assessment'
  version         INTEGER NOT NULL DEFAULT 1,
  title_is        TEXT NOT NULL,
  title_en        TEXT,
  intro_is        TEXT,
  intro_en        TEXT,
  outro_is        TEXT,
  outro_en        TEXT,
  estimated_minutes INTEGER NOT NULL DEFAULT 5,
  status          TEXT NOT NULL CHECK (status IN ('draft','pending_approval','approved','archived')),
  approved_by     UUID,
  approved_by_name TEXT,
  approved_at     TIMESTAMPTZ,
  approval_note   TEXT,
  created_by      UUID NOT NULL,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(key, version)
);

CREATE INDEX IF NOT EXISTS feedback_surveys_status_idx
  ON public.feedback_surveys (status, key, version DESC);

-- ─── 5. feedback_questions table — questions in a survey ────────
-- order_index controls render order; ties broken by created_at.
CREATE TABLE IF NOT EXISTS public.feedback_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES public.feedback_surveys(id) ON DELETE CASCADE,
  order_index     INTEGER NOT NULL,
  question_type   TEXT NOT NULL CHECK (question_type IN (
    'likert5',           -- 5-point: Mjög gott / Gott / Í lagi / Slakt / Mjög slakt
    'singleselect',      -- single-choice (e.g. time-since)
    'multiselect',       -- multi-choice (areas of change, barriers)
    'nps10',             -- 0-10 numeric scale
    'open',              -- free-text
    'consent_optional'   -- checkbox + optional open-text (marketing story)
  )),
  label_is        TEXT NOT NULL,
  label_en        TEXT,
  helper_is       TEXT,                    -- subtitle / guidance under label
  helper_en       TEXT,
  options_jsonb   JSONB,                   -- [{ value, label_is, label_en }, ...]
  required        BOOLEAN NOT NULL DEFAULT TRUE,
  allow_skip      BOOLEAN NOT NULL DEFAULT FALSE,  -- adds "Á ekki við" option
  skip_label_is   TEXT DEFAULT 'Á ekki við',
  skip_label_en   TEXT DEFAULT 'Not applicable',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_questions_survey_idx
  ON public.feedback_questions (survey_id, order_index);

-- ─── 6. feedback_assignments — survey sent to a specific client ─
CREATE TABLE IF NOT EXISTS public.feedback_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id         UUID NOT NULL REFERENCES public.feedback_surveys(id),
  client_id         UUID NOT NULL,
  client_email      TEXT NOT NULL,                 -- snapshot at send time
  client_name       TEXT,                          -- snapshot at send time
  completion_token  TEXT NOT NULL UNIQUE,          -- random; the public link
  sent_by           UUID NOT NULL,
  sent_by_name      TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS feedback_assignments_survey_idx
  ON public.feedback_assignments (survey_id, completed_at);
CREATE INDEX IF NOT EXISTS feedback_assignments_client_idx
  ON public.feedback_assignments (client_id, sent_at DESC);

-- ─── 7. feedback_responses — actual answers ─────────────────────
-- One row per (assignment, question). Append-only — once submitted
-- the response is locked.
CREATE TABLE IF NOT EXISTS public.feedback_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES public.feedback_assignments(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES public.feedback_questions(id),
  value           TEXT,                    -- single value (likert / nps / select)
  values_array    TEXT[],                  -- multi-select values
  text_value      TEXT,                    -- open text or supplemental text
  skipped         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, question_id)
);

CREATE INDEX IF NOT EXISTS feedback_responses_question_idx
  ON public.feedback_responses (question_id);


-- ─── 8. RLS — feedback_surveys + feedback_questions ─────────────
-- Admin: full read/write.
-- Medical advisor: read all, can mark approved (handled via API
--   so the SECURITY DEFINER path enforces medical_advisor + status
--   transition rules); direct update through the table is disabled.
-- Anyone authenticated: read APPROVED surveys + their questions
--   (so the public survey page can render — it auths via token,
--   not session, so this is permissive on purpose).

ALTER TABLE public.feedback_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manages feedback surveys') THEN
    CREATE POLICY "Admin manages feedback surveys" ON public.feedback_surveys
      FOR ALL TO authenticated
      USING (is_admin_staff())
      WITH CHECK (is_admin_staff());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads feedback surveys') THEN
    CREATE POLICY "Medical advisor reads feedback surveys" ON public.feedback_surveys
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Approved surveys readable to all auth') THEN
    CREATE POLICY "Approved surveys readable to all auth" ON public.feedback_surveys
      FOR SELECT TO authenticated
      USING (status = 'approved');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manages feedback questions') THEN
    CREATE POLICY "Admin manages feedback questions" ON public.feedback_questions
      FOR ALL TO authenticated
      USING (is_admin_staff())
      WITH CHECK (is_admin_staff());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads feedback questions') THEN
    CREATE POLICY "Medical advisor reads feedback questions" ON public.feedback_questions
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Approved survey questions readable') THEN
    CREATE POLICY "Approved survey questions readable" ON public.feedback_questions
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.feedback_surveys s
          WHERE s.id = feedback_questions.survey_id
            AND s.status = 'approved'
        )
      );
  END IF;
END $$;


-- ─── 9. RLS — feedback_assignments + feedback_responses ─────────
-- Admin: full read/write.
-- Medical advisor: read-only on both (for results / analytics /
--   export). Cannot create assignments or write responses.
-- Public (anon): no direct table access — submission goes through
--   an API route that uses the service-role key after validating
--   the completion_token.

ALTER TABLE public.feedback_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manages feedback assignments') THEN
    CREATE POLICY "Admin manages feedback assignments" ON public.feedback_assignments
      FOR ALL TO authenticated
      USING (is_admin_staff())
      WITH CHECK (is_admin_staff());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads feedback assignments') THEN
    CREATE POLICY "Medical advisor reads feedback assignments" ON public.feedback_assignments
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manages feedback responses') THEN
    CREATE POLICY "Admin manages feedback responses" ON public.feedback_responses
      FOR ALL TO authenticated
      USING (is_admin_staff())
      WITH CHECK (is_admin_staff());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Medical advisor reads feedback responses') THEN
    CREATE POLICY "Medical advisor reads feedback responses" ON public.feedback_responses
      FOR SELECT TO authenticated
      USING (is_active_medical_advisor());
  END IF;
END $$;


-- ─── 10. SEED — Þjónustukönnun v1 (post-assessment) ─────────────
-- Initial Icelandic question list. Status starts as 'draft' so the
-- medical advisor must approve before any assignment can be sent.
DO $$
DECLARE
  v_survey_id UUID;
  v_existing  UUID;
BEGIN
  SELECT id INTO v_existing
  FROM public.feedback_surveys
  WHERE key = 'post-assessment' AND version = 1;

  IF v_existing IS NOT NULL THEN
    RAISE NOTICE 'Survey post-assessment v1 already exists (%); seed skipped.', v_existing;
    RETURN;
  END IF;

  INSERT INTO public.feedback_surveys (
    key, version, title_is, intro_is, outro_is, status, created_by, created_by_name
  ) VALUES (
    'post-assessment', 1,
    'Þjónustukönnun – Lifeline Health',
    'Kæri þátttakandi,

Takk kærlega fyrir að taka þátt í heildrænu heilsuþjónustunni okkar hjá Lifeline Health.

Markmið okkar er að hjálpa fólki að bæta heilsu sína með persónulegri og gagnadrifinni nálgun, byggðri á fjórum grunnstoðum: hreyfingu, næringu, svefni og andlegri heilsu.

Til að þróa þjónustuna áfram og gera hana enn betri fyrir þig og aðra, biðjum við þig að taka nokkrar mínútur í að svara þessari könnun. Hún tekur um 5 mínútur.

Við þökkum kærlega fyrir þátttökuna!',
    'Takk kærlega fyrir að gefa þér tíma. Þín endurgjöf skiptir okkur miklu máli og hjálpar okkur að þróa þjónustuna áfram.',
    'draft',
    '00000000-0000-0000-0000-000000000000', -- system seed; will be reassigned on first edit
    'System seed'
  )
  RETURNING id INTO v_survey_id;

  -- Q1: Time since assessment (single-select)
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 1, 'singleselect',
    'Hve langt er síðan þú lauk heilsumatinu?',
    '[
      {"value":"<1m","label_is":"Minna en 1 mánuður"},
      {"value":"1-3m","label_is":"1-3 mánuðir"},
      {"value":"3-6m","label_is":"3-6 mánuðir"},
      {"value":"6m+","label_is":"6 mánuðir eða lengur"}
    ]'::jsonb,
    TRUE
  );

  -- Q2: Overall experience
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 2, 'likert5',
    'Hvernig fannst þér heildarferlið hjá Lifeline Health?',
    '[
      {"value":"5","label_is":"Mjög gott"},
      {"value":"4","label_is":"Gott"},
      {"value":"3","label_is":"Í lagi"},
      {"value":"2","label_is":"Slakt"},
      {"value":"1","label_is":"Mjög slakt"}
    ]'::jsonb,
    TRUE
  );

  -- Q3: Lecture quality
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required, allow_skip, skip_label_is
  ) VALUES (
    v_survey_id, 3, 'likert5',
    'Hvernig fannst þér fyrirlesturinn?',
    '[
      {"value":"5","label_is":"Mjög gagnlegur"},
      {"value":"4","label_is":"Gagnlegur"},
      {"value":"3","label_is":"Í lagi"},
      {"value":"2","label_is":"Lítið gagnlegur"},
      {"value":"1","label_is":"Ekki gagnlegur"}
    ]'::jsonb,
    TRUE, TRUE, 'Á ekki við / mætti ekki'
  );

  -- Q4: Lecture comprehension
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required, allow_skip
  ) VALUES (
    v_survey_id, 4, 'likert5',
    'Hve vel skildirðu efnið í fyrirlestrinum?',
    '[
      {"value":"5","label_is":"Mjög vel"},
      {"value":"4","label_is":"Vel"},
      {"value":"3","label_is":"Í meðallagi"},
      {"value":"2","label_is":"Lítið"},
      {"value":"1","label_is":"Alls ekki"}
    ]'::jsonb,
    TRUE, TRUE
  );

  -- Q5: Measurements quality
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 5, 'likert5',
    'Hvernig fannst þér mælingarnar (blóðprufur, líkamlegar mælingar o.fl.)?',
    '[
      {"value":"5","label_is":"Mjög góðar"},
      {"value":"4","label_is":"Góðar"},
      {"value":"3","label_is":"Í lagi"},
      {"value":"2","label_is":"Slakar"},
      {"value":"1","label_is":"Mjög slakar"}
    ]'::jsonb,
    TRUE
  );

  -- Q6: Measurements professionalism
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 6, 'likert5',
    'Hve faglegt fannst þér ferlið við mælingarnar?',
    '[
      {"value":"5","label_is":"Mjög faglegt"},
      {"value":"4","label_is":"Faglegt"},
      {"value":"3","label_is":"Í meðallagi"},
      {"value":"2","label_is":"Frekar ófaglegt"},
      {"value":"1","label_is":"Mjög ófaglegt"}
    ]'::jsonb,
    TRUE
  );

  -- Q7: Health report quality
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 7, 'likert5',
    'Hvernig fannst þér heilsuskýrslan sem þú fékkst?',
    '[
      {"value":"5","label_is":"Mjög góð og gagnleg"},
      {"value":"4","label_is":"Góð"},
      {"value":"3","label_is":"Í lagi"},
      {"value":"2","label_is":"Lítið gagnleg"},
      {"value":"1","label_is":"Ekki gagnleg"}
    ]'::jsonb,
    TRUE
  );

  -- Q8: Health report comprehension
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 8, 'likert5',
    'Hve vel skildirðu innihald skýrslunnar?',
    '[
      {"value":"5","label_is":"Mjög vel"},
      {"value":"4","label_is":"Vel"},
      {"value":"3","label_is":"Í meðallagi"},
      {"value":"2","label_is":"Lítið"},
      {"value":"1","label_is":"Alls ekki"}
    ]'::jsonb,
    TRUE
  );

  -- Q9: Doctor consultation quality
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required, allow_skip
  ) VALUES (
    v_survey_id, 9, 'likert5',
    'Hvernig fannst þér viðtalið við lækni?',
    '[
      {"value":"5","label_is":"Mjög gott"},
      {"value":"4","label_is":"Gott"},
      {"value":"3","label_is":"Í lagi"},
      {"value":"2","label_is":"Slakt"},
      {"value":"1","label_is":"Mjög slakt"}
    ]'::jsonb,
    TRUE, TRUE
  );

  -- Q10: Doctor enough time / attention
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required, allow_skip
  ) VALUES (
    v_survey_id, 10, 'likert5',
    'Fannst þér þú fá nægan tíma og athygli í læknisviðtalinu?',
    '[
      {"value":"5","label_is":"Já, mikið"},
      {"value":"4","label_is":"Já"},
      {"value":"3","label_is":"Í meðallagi"},
      {"value":"2","label_is":"Lítið"},
      {"value":"1","label_is":"Alls ekki"}
    ]'::jsonb,
    TRUE, TRUE
  );

  -- Q11: Health plan quality
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 11, 'likert5',
    'Hvernig fannst þér heilsuplanið sem þú fékkst?',
    '[
      {"value":"5","label_is":"Mjög gott og raunhæft"},
      {"value":"4","label_is":"Gott"},
      {"value":"3","label_is":"Í lagi"},
      {"value":"2","label_is":"Óskýrt"},
      {"value":"1","label_is":"Ekki gagnlegt"}
    ]'::jsonb,
    TRUE
  );

  -- Q12: Health plan personalization
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 12, 'likert5',
    'Hve persónulegt og aðlagað þér fannst planið?',
    '[
      {"value":"5","label_is":"Mjög persónulegt"},
      {"value":"4","label_is":"Persónulegt"},
      {"value":"3","label_is":"Í meðallagi"},
      {"value":"2","label_is":"Frekar almennt"},
      {"value":"1","label_is":"Ekki persónulegt"}
    ]'::jsonb,
    TRUE
  );

  -- Q13: Outcomes
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 13, 'likert5',
    'Hvernig gengur þér núna miðað við áður en þú hófst þátttöku?',
    '[
      {"value":"5","label_is":"Mun betur"},
      {"value":"4","label_is":"Betur"},
      {"value":"3","label_is":"Svipað"},
      {"value":"2","label_is":"Verr"},
      {"value":"1","label_is":"Mun verr"}
    ]'::jsonb,
    TRUE
  );

  -- Q14: Areas of change (multi-select)
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, helper_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 14, 'multiselect',
    'Á hvaða sviðum hefur þú tekið eftir breytingum?',
    'Þú mátt velja fleira en eitt.',
    '[
      {"value":"movement","label_is":"Hreyfing"},
      {"value":"nutrition","label_is":"Næring"},
      {"value":"sleep","label_is":"Svefn"},
      {"value":"mental","label_is":"Andleg líðan"},
      {"value":"energy","label_is":"Orka yfir daginn"},
      {"value":"weight","label_is":"Þyngd"},
      {"value":"other","label_is":"Annað"}
    ]'::jsonb,
    FALSE
  );

  -- Q15: NPS (recommend)
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, helper_is, required
  ) VALUES (
    v_survey_id, 15, 'nps10',
    'Á skalanum 0–10, hversu líklegt er að þú mælir með Lifeline Health við vin eða vinnufélaga?',
    '0 = mjög ólíklegt, 10 = mjög líklegt.',
    TRUE
  );

  -- Q16: Barriers (multi-select)
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, helper_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 16, 'multiselect',
    'Hvað hindraði þig helst í að ná markmiðum þínum?',
    'Þú mátt velja fleira en eitt — slepptu ef ekkert átti við.',
    '[
      {"value":"time","label_is":"Tími"},
      {"value":"motivation","label_is":"Hvatning"},
      {"value":"plan_clarity","label_is":"Skýrleiki plansins"},
      {"value":"personal","label_is":"Persónulegar aðstæður"},
      {"value":"health","label_is":"Heilsa"},
      {"value":"none","label_is":"Ekkert hindraði mig"},
      {"value":"other","label_is":"Annað"}
    ]'::jsonb,
    FALSE
  );

  -- Q17: Data trust
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, options_jsonb, required
  ) VALUES (
    v_survey_id, 17, 'likert5',
    'Hafðir þú traust á því að persónuupplýsingum þínum væri vel sinnt?',
    '[
      {"value":"5","label_is":"Já, mikið traust"},
      {"value":"4","label_is":"Já"},
      {"value":"3","label_is":"Í lagi"},
      {"value":"2","label_is":"Lítið"},
      {"value":"1","label_is":"Hafði áhyggjur"}
    ]'::jsonb,
    TRUE
  );

  -- Q18: Best thing (open)
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, required
  ) VALUES (
    v_survey_id, 18, 'open',
    'Hvað fannst þér best við þjónustuna í heild?',
    FALSE
  );

  -- Q19: One thing to change (open)
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, required
  ) VALUES (
    v_survey_id, 19, 'open',
    'Ef þú mættir breyta einu atriði, hvað væri það?',
    FALSE
  );

  -- Q20: Marketing story consent (optional)
  INSERT INTO public.feedback_questions (
    survey_id, order_index, question_type, label_is, helper_is, required
  ) VALUES (
    v_survey_id, 20, 'consent_optional',
    'Værir þú til í að deila Lifeline-sögunni þinni nafnlaust?',
    'Markmiðið er að safna hugleiðingum sem hægt er að deila nafnlaust í markaðstilgangi, svo fleiri geti nýtt sér þjónustuna. Algjörlega valfrjálst.',
    FALSE
  );

  RAISE NOTICE 'Seeded post-assessment v1 with 20 questions (status=draft).';
END $$;
