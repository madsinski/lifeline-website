-- =============================================================
-- Feedback surveys: 9-chapter structure
--
-- 1. Add `section_index` + `section_title_is` (+ `_en`) columns to
--    feedback_questions so the public form / preview can paginate
--    questions by theme.
-- 2. Replace the questions on the seeded `post-assessment` v1 survey
--    with the new 9-chapter Þjónustukönnun layout. Intro and outro
--    on the survey row are preserved.
-- 3. Reset the survey status to 'draft' since the question list has
--    materially changed and the medical advisor must re-approve.
--
-- Idempotent: safe to re-run. Only touches post-assessment v1.
-- Run in the Supabase SQL editor.
-- =============================================================

-- 1. Schema change ---------------------------------------------
ALTER TABLE public.feedback_questions
  ADD COLUMN IF NOT EXISTS section_index    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS section_title_is TEXT,
  ADD COLUMN IF NOT EXISTS section_title_en TEXT;

-- (Re)create the index in (survey_id, section_index, order_index) order
-- so the renderer can stream a survey grouped + ordered in one scan.
DROP INDEX IF EXISTS public.feedback_questions_survey_idx;
CREATE INDEX IF NOT EXISTS feedback_questions_survey_idx
  ON public.feedback_questions (survey_id, section_index, order_index);


-- 2. Replace post-assessment v1 question set -------------------
DO $$
DECLARE
  v_survey_id UUID;
BEGIN
  SELECT id INTO v_survey_id
  FROM public.feedback_surveys
  WHERE key = 'post-assessment' AND version = 1;

  IF v_survey_id IS NULL THEN
    RAISE NOTICE 'post-assessment v1 survey not found; nothing to update.';
    RETURN;
  END IF;

  -- Wipe the existing question list. Any feedback_responses pointing
  -- at these questions are removed by the ON DELETE CASCADE on
  -- feedback_responses.question_id (set in the original migration).
  DELETE FROM public.feedback_questions WHERE survey_id = v_survey_id;

  -- Reset to draft + bump estimated time. Intro/outro untouched.
  UPDATE public.feedback_surveys
  SET status              = 'draft',
      estimated_minutes   = 7,
      approved_by         = NULL,
      approved_by_name    = NULL,
      approved_at         = NULL,
      approval_note       = NULL,
      updated_at          = now()
  WHERE id = v_survey_id;

  -- ─── Chapter 1: Upplifun af ferlinu í heild ────────────────
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, options_jsonb, required)
  VALUES
    (v_survey_id, 1, 'Upplifun af ferlinu í heild', 1, 'likert5',
     'Hvernig fannst þér heildarferlið hjá Lifeline Health?',
     '[{"value":"5","label_is":"Mjög gott"},{"value":"4","label_is":"Gott"},{"value":"3","label_is":"Í lagi"},{"value":"2","label_is":"Slakt"},{"value":"1","label_is":"Mjög slakt"}]'::jsonb, TRUE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, required)
  VALUES
    (v_survey_id, 1, 'Upplifun af ferlinu í heild', 2, 'open',
     'Hvað fannst þér vel gert?', FALSE),
    (v_survey_id, 1, 'Upplifun af ferlinu í heild', 3, 'open',
     'Ef þú mættir breyta einhverju, hvað væri það?', FALSE);

  -- ─── Chapter 2: Fræðslufundur / fyrirlestur ────────────────
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, options_jsonb, required)
  VALUES
    (v_survey_id, 2, 'Fræðslufundur / fyrirlestur', 4, 'likert5',
     'Hvernig fannst þér fyrirlesturinn?',
     '[{"value":"5","label_is":"Mjög gagnlegur"},{"value":"4","label_is":"Gagnlegur"},{"value":"3","label_is":"Í lagi"},{"value":"2","label_is":"Lítið gagnlegur"},{"value":"1","label_is":"Ekki gagnlegur"}]'::jsonb, TRUE),
    (v_survey_id, 2, 'Fræðslufundur / fyrirlestur', 5, 'singleselect',
     'Skildirðu efnið vel?',
     '[{"value":"4","label_is":"Já, mjög vel"},{"value":"3","label_is":"Að mestu leyti"},{"value":"2","label_is":"Að hluta"},{"value":"1","label_is":"Nei"}]'::jsonb, TRUE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, required)
  VALUES
    (v_survey_id, 2, 'Fræðslufundur / fyrirlestur', 6, 'open',
     'Hvað fannst þér vel gert?', FALSE),
    (v_survey_id, 2, 'Fræðslufundur / fyrirlestur', 7, 'open',
     'Ef þú mættir breyta einhverju, hvað væri það?', FALSE);

  -- ─── Chapter 3: Mælingar og gagnasöfnun ────────────────────
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, options_jsonb, required)
  VALUES
    (v_survey_id, 3, 'Mælingar og gagnasöfnun', 8, 'likert5',
     'Hvernig fannst þér mælingarnar (blóðprufur, líkamlegar mælingar o.fl.)?',
     '[{"value":"5","label_is":"Mjög góðar"},{"value":"4","label_is":"Góðar"},{"value":"3","label_is":"Í lagi"},{"value":"2","label_is":"Slakar"},{"value":"1","label_is":"Mjög slakar"}]'::jsonb, TRUE),
    (v_survey_id, 3, 'Mælingar og gagnasöfnun', 9, 'singleselect',
     'Fannst þér ferlið skýrt og faglegt?',
     '[{"value":"3","label_is":"Já"},{"value":"2","label_is":"Að mestu"},{"value":"1","label_is":"Nei"}]'::jsonb, TRUE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, required)
  VALUES
    (v_survey_id, 3, 'Mælingar og gagnasöfnun', 10, 'open',
     'Hvað fannst þér vel gert?', FALSE),
    (v_survey_id, 3, 'Mælingar og gagnasöfnun', 11, 'open',
     'Ef þú mættir breyta einhverju, hvað væri það?', FALSE);

  -- ─── Chapter 4: Heilsuskýrsla ──────────────────────────────
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, options_jsonb, required)
  VALUES
    (v_survey_id, 4, 'Heilsuskýrsla', 12, 'likert5',
     'Hvernig fannst þér heilsuskýrslan sem þú fékkst?',
     '[{"value":"5","label_is":"Mjög góð og gagnleg"},{"value":"4","label_is":"Góð"},{"value":"3","label_is":"Í lagi"},{"value":"2","label_is":"Lítið gagnleg"},{"value":"1","label_is":"Ekki gagnleg"}]'::jsonb, TRUE),
    (v_survey_id, 4, 'Heilsuskýrsla', 13, 'singleselect',
     'Skildirðu innihaldið?',
     '[{"value":"4","label_is":"Já, mjög vel"},{"value":"3","label_is":"Að mestu"},{"value":"2","label_is":"Að hluta"},{"value":"1","label_is":"Nei"}]'::jsonb, TRUE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, required)
  VALUES
    (v_survey_id, 4, 'Heilsuskýrsla', 14, 'open',
     'Hvað fannst þér vel gert?', FALSE),
    (v_survey_id, 4, 'Heilsuskýrsla', 15, 'open',
     'Ef þú mættir breyta einhverju, hvað væri það?', FALSE);

  -- ─── Chapter 5: Læknisviðtal ───────────────────────────────
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, options_jsonb, required)
  VALUES
    (v_survey_id, 5, 'Læknisviðtal', 16, 'likert5',
     'Hvernig fannst þér viðtalið við lækni?',
     '[{"value":"5","label_is":"Mjög gott"},{"value":"4","label_is":"Gott"},{"value":"3","label_is":"Í lagi"},{"value":"2","label_is":"Slakt"},{"value":"1","label_is":"Mjög slakt"}]'::jsonb, TRUE),
    (v_survey_id, 5, 'Læknisviðtal', 17, 'singleselect',
     'Fannst þér þú fá nægan tíma og athygli?',
     '[{"value":"3","label_is":"Já"},{"value":"2","label_is":"Að mestu"},{"value":"1","label_is":"Nei"}]'::jsonb, TRUE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, required)
  VALUES
    (v_survey_id, 5, 'Læknisviðtal', 18, 'open',
     'Hvað fannst þér vel gert?', FALSE),
    (v_survey_id, 5, 'Læknisviðtal', 19, 'open',
     'Ef þú mættir breyta einhverju, hvað væri það?', FALSE);

  -- ─── Chapter 6: Heilsuplanið ───────────────────────────────
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, options_jsonb, required)
  VALUES
    (v_survey_id, 6, 'Heilsuplanið', 20, 'likert5',
     'Hvernig fannst þér heilsuplanið sem þú fékkst?',
     '[{"value":"5","label_is":"Mjög gott og raunhæft"},{"value":"4","label_is":"Gott"},{"value":"3","label_is":"Í lagi"},{"value":"2","label_is":"Óskýrt"},{"value":"1","label_is":"Ekki gagnlegt"}]'::jsonb, TRUE),
    (v_survey_id, 6, 'Heilsuplanið', 21, 'singleselect',
     'Fannst þér planið persónulegt og aðlagað þér?',
     '[{"value":"3","label_is":"Já"},{"value":"2","label_is":"Að mestu"},{"value":"1","label_is":"Nei"}]'::jsonb, TRUE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, required)
  VALUES
    (v_survey_id, 6, 'Heilsuplanið', 22, 'open',
     'Hvað fannst þér vel gert?', FALSE),
    (v_survey_id, 6, 'Heilsuplanið', 23, 'open',
     'Ef þú mættir breyta einhverju, hvað væri það?', FALSE);

  -- ─── Chapter 7: Árangur og breytingar ──────────────────────
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, options_jsonb, required)
  VALUES
    (v_survey_id, 7, 'Árangur og breytingar', 24, 'singleselect',
     'Hvernig gengur þér núna miðað við áður en þú hófst þátttöku?',
     '[{"value":"4","label_is":"Mun betur"},{"value":"3","label_is":"Betur"},{"value":"2","label_is":"Svipað"},{"value":"1","label_is":"Verr"}]'::jsonb, TRUE),
    (v_survey_id, 7, 'Árangur og breytingar', 25, 'multiselect',
     'Á hvaða sviðum hefur þú tekið eftir breytingum?',
     '[{"value":"hreyfing","label_is":"Hreyfing"},{"value":"naering","label_is":"Næring"},{"value":"svefn","label_is":"Svefn"},{"value":"andleg","label_is":"Andleg líðan"},{"value":"orka","label_is":"Orka yfir daginn"},{"value":"annad","label_is":"Annað"}]'::jsonb, FALSE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, helper_is, required)
  VALUES
    (v_survey_id, 7, 'Árangur og breytingar', 26, 'open',
     'Lýstu því hvernig heilsufarsskoðun Lifeline Health hafði áhrif á þínar heilsufarsbreytingar:',
     'Frjálst svar — eins langt eða stutt og þú vilt.', FALSE);

  -- ─── Chapter 8: Heildarskilningur ──────────────────────────
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, options_jsonb, required)
  VALUES
    (v_survey_id, 8, 'Heildarskilningur', 27, 'singleselect',
     'Skildirðu ferlið og tilgang þjónustunnar?',
     '[{"value":"4","label_is":"Já, mjög vel"},{"value":"3","label_is":"Að mestu"},{"value":"2","label_is":"Að hluta"},{"value":"1","label_is":"Nei"}]'::jsonb, TRUE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, required)
  VALUES
    (v_survey_id, 8, 'Heildarskilningur', 28, 'open',
     'Ef þú mættir breyta einhverju, hvað væri það?', FALSE);

  -- ─── Chapter 9: Endurgjöf og umbætur ───────────────────────
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, required)
  VALUES
    (v_survey_id, 9, 'Endurgjöf og umbætur', 29, 'open',
     'Er eitthvað sem þú vilt hrósa sérstaklega?', FALSE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, options_jsonb, required)
  VALUES
    (v_survey_id, 9, 'Endurgjöf og umbætur', 30, 'singleselect',
     'Myndir þú mæla með Lifeline Health við aðra?',
     '[{"value":"3","label_is":"Já"},{"value":"2","label_is":"Kannski"},{"value":"1","label_is":"Nei"}]'::jsonb, TRUE);
  INSERT INTO public.feedback_questions
    (survey_id, section_index, section_title_is, order_index, question_type, label_is, required)
  VALUES
    (v_survey_id, 9, 'Endurgjöf og umbætur', 31, 'open',
     'Er eitthvað annað sem þú vilt að komi fram?', FALSE);

  RAISE NOTICE '9-chapter post-assessment v1 survey is now in draft. Re-approve in /admin/surveys.';
END $$;
