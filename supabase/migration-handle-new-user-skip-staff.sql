-- =============================================================
-- Stop handle_new_user() from auto-creating a clients row when
-- the new auth user is being onboarded as STAFF.
--
-- Why this is needed:
--   The Supabase project has a handle_new_user() trigger that
--   inserts a row into public.clients every time a row appears
--   in auth.users. That's the right behaviour for B2C / B2B
--   client signups, but wrong for staff invites — a coach,
--   doctor or external lawyer should not show up as a "client"
--   in /admin/clients, and the orphan row creates ugly cleanup
--   work in the staff/create API.
--
--   The fix relies on the fact that staff/create passes
--   { name, role } in the GoTrue invite's `data` payload, which
--   becomes raw_user_meta_data on auth.users. So if we see a
--   staff role in metadata at trigger time, we skip the clients
--   insert.
--
-- Safe to run more than once. Preserves whatever the existing
-- trigger body did for non-staff users — see notes below.
--
-- ─── HOW TO USE ────────────────────────────────────────────
-- Step 1. Look at what the existing trigger does today, so you
-- can confirm the replacement keeps the same B2C behaviour:
--
--   SELECT pg_get_functiondef('public.handle_new_user'::regproc);
--
-- Step 2. If the existing body is just a simple INSERT INTO
-- public.clients with (id, email, full_name) — which is what
-- the standard Supabase template ships — the version below is a
-- drop-in replacement. If it does more (e.g. assigns avatars,
-- sets onboarding flags), copy those extra statements into the
-- ELSE branch below before running.
--
-- Step 3. Run the CREATE OR REPLACE below.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
  DECLARE
    meta_role TEXT;
  BEGIN
    -- Staff path: when /api/admin/staff/create invites a user it
    -- passes { name, role } in the GoTrue invite payload, which
    -- ends up here as raw_user_meta_data->>'role'. Any of the six
    -- staff roles → skip the entire B2C welcome flow.
    --   - no clients row (they're not a client)
    --   - no welcome points (lifescore is a client-engagement metric)
    --   - no activity-feed entry (the feed is the social wall)
    meta_role := NEW.raw_user_meta_data->>'role';
    IF meta_role IN ('admin','coach','doctor','nurse','psychologist','lawyer') THEN
      RETURN NEW;
    END IF;

    -- Non-staff path: identical to the original trigger.
    INSERT INTO public.clients (id, email, full_name, created_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.lifescore_points (client_id, points, reason, category)
    VALUES (NEW.id, 20, 'joined Lifeline Health', 'welcome');

    INSERT INTO public.activity_feed (client_id, action, points)
    VALUES (NEW.id, 'joined Lifeline Health', 20);

    RETURN NEW;
  END;
  $function$;

-- The trigger itself (on_auth_user_created) doesn't need to be
-- recreated — it already calls handle_new_user(); we just
-- replaced the function body.

-- Sanity check: confirm the function compiled and the trigger
-- still references it.
SELECT
  t.tgname           AS trigger_name,
  c.relname          AS table_name,
  pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_class   c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND t.tgname = 'on_auth_user_created';
