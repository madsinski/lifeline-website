-- Remap action_exercises to videoed free-exercise-db twins.
--
-- Background: 869 free-exercise-db exercises were imported with hard-
-- alternation MP4 loops. Many existing curated rows already had
-- illustration_url pointing at the same upstream slug but a slightly
-- different name ("Conventional Deadlift" vs "Barbell Deadlift",
-- "Front Plank" vs "Plank"), so the name-merge upsert kept them as
-- separate stubs without video_url. The 1539 action_exercises rows
-- still pointing to those stubs render as still images instead of
-- looping demos.
--
-- This migration matches stub→videoed pairs by upstream slug
-- (extracted from illustration_url) and remaps action_exercises
-- accordingly. Orphan stub rows are left in place — they may be
-- referenced from per-client customizations or elsewhere.

WITH slug_pairs AS (
  SELECT DISTINCT ON (stub.id)
    stub.id  AS stub_id,
    fed.id   AS videoed_id
  FROM exercises stub
  JOIN exercises fed
    ON substring(stub.illustration_url FROM '/exercises/([^/]+)/[01]\.jpg')
     = substring(fed.illustration_url  FROM '/exercises/([^/]+)/[01]\.jpg')
  WHERE coalesce(stub.video_url, '') = ''
    AND coalesce(fed.video_url,  '') <> ''
    AND fed.source = 'free-exercise-db'
    AND stub.id <> fed.id
  ORDER BY stub.id, fed.id
)
UPDATE action_exercises ae
SET exercise_id = sp.videoed_id
FROM slug_pairs sp
WHERE ae.exercise_id = sp.stub_id;
