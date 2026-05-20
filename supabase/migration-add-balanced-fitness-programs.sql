-- New exercise programs to back the personalized-plan engine in the
-- RN app (src/lib/personalizedPlan.ts).
--
-- The previous catalog only had `essential-strength` as the default
-- exercise activation. The pulse engine now recommends ONE OR MORE
-- programs depending on which modalities the user is deficient in:
--
--   balanced-fitness  — strength + Zone 2 + HIIT + mobility in one
--                       weekly schedule. Lifeline's policy default
--                       for users with multiple modality gaps.
--
--   zone2-base        — Easy cardio block. 2-3 sessions/week of
--                       conversational-pace cardio. Drives
--                       mitochondrial density and aerobic capacity.
--                       For users with low light-cardio scores.
--
--   hiit-add-on       — 1 vigorous-cardio session per week. Drives
--                       VO₂max — the single strongest cardio
--                       all-cause-mortality predictor (Mandsager
--                       2018 JAMA Netw Open). For users with low
--                       vigorous-cardio scores.
--
-- Action_exercises curation (week × day × action × exercise picks)
-- happens in the admin UI separately — these rows just register the
-- programs themselves.

INSERT INTO programs (category_id, key, name, description, active_by_default, sort_order)
VALUES
  ((SELECT id FROM program_categories WHERE key='exercise'),
   'balanced-fitness', 'Balanced Fitness',
   '6 active days/week mixing strength, Zone 2 cardio, HIIT and mobility — the Lifeline-policy template for users who need to build multiple modalities at once. Combined aerobic + strength is linked to ~40% lower all-cause mortality (Momma 2022, BJSM).',
   false, 12),
  ((SELECT id FROM program_categories WHERE key='exercise'),
   'zone2-base', 'Zone 2 Cardio Base',
   '2-3 conversational-pace sessions/week (30-60 min each). Easy cardio you can hold a conversation through. Builds mitochondrial density and aerobic capacity — the foundation under everything else.',
   false, 13),
  ((SELECT id FROM program_categories WHERE key='exercise'),
   'hiit-add-on', 'HIIT Add-on',
   '1 vigorous-cardio session per week, 20-30 min. Slots alongside any other exercise program. Drives VO₂max gains, which independently predict all-cause mortality more strongly than smoking, diabetes, or high blood pressure (Mandsager 2018).',
   false, 14)
ON CONFLICT (key) DO NOTHING;
