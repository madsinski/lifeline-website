-- Two new exercise programs identified during concept review:
--
--   mobility-base       — 15-20 min mobility work, 2-3x/week. No
--                         dedicated mobility program existed.
--                         functional-fitness covered fitness, not
--                         stretching/flexibility.
--
--   beginner-foundation — 4-week ramp for sedentary users. essential-
--                         strength assumed baseline capacity; this
--                         fills the couch-to-fit gap.
--
-- Action_exercises curation (week × day × action × exercise picks)
-- happens in the admin UI separately — these rows just register the
-- programs themselves.

INSERT INTO programs (category_id, key, name, description, active_by_default, sort_order)
VALUES
  ((SELECT id FROM program_categories WHERE key='exercise'),
   'mobility-base', 'Mobility & Flexibility',
   '15-20 min sessions 2-3x/week. Joint mobility, dynamic flexibility, and recovery work — slots between strength days or stands alone.',
   false, 10),
  ((SELECT id FROM program_categories WHERE key='exercise'),
   'beginner-foundation', 'Beginner Foundation',
   '4-week ramp for sedentary starters. 3x/week, 20 min each, gym or home — builds base capacity before moving to essential-strength.',
   false, 11)
ON CONFLICT (key) DO NOTHING;
