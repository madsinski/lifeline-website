-- =============================================================
-- One-shot cleanup for the +probe / +invite-probe Ragnar test
-- accounts left over from the staff/create debugging session.
--
-- These were created when Claude was probing why supabase-js's
-- inviteUserByEmail() was returning "Database error saving new
-- user" (it was an SDK quirk — direct REST works). Each probe
-- created an auth.users row, which fired the handle_new_user()
-- trigger and produced a clients row + lifescore points + an
-- activity-feed entry. Triggers downstream of clients (e.g.
-- conversation auto-create) added more dependent rows, so a
-- naive DELETE FROM clients hits FK violations.
--
-- Solution: walk pg_constraint and dynamically delete from every
-- table whose FK points at clients(id) or auth.users(id) before
-- removing the parent rows. Idempotent — re-running once the
-- probes are gone is a no-op.
--
-- Run in the Supabase SQL editor.
-- =============================================================

DO $$
DECLARE
  probe_ids UUID[];
  fk_record RECORD;
  sql_text TEXT;
  n_deleted INT;
BEGIN
  -- 1. Resolve the probe auth user ids.
  SELECT ARRAY(
    SELECT id FROM auth.users
    WHERE email IN (
      'ragnar+invite-probe@fosslogmenn.is',
      'ragnar+probe@fosslogmenn.is'
    )
  ) INTO probe_ids;

  IF array_length(probe_ids, 1) IS NULL THEN
    RAISE NOTICE 'No probe accounts found — nothing to do.';
    RETURN;
  END IF;

  RAISE NOTICE 'Cleaning up probe ids: %', probe_ids;

  -- 2. Cascade-delete from every table whose FK points at clients(id).
  --    Run in a loop so we don't have to enumerate them by name.
  FOR fk_record IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class c     ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    WHERE con.confrelid = 'public.clients'::regclass
      AND con.contype   = 'f'
  LOOP
    sql_text := format('DELETE FROM %I.%I WHERE %I = ANY($1)',
                       fk_record.schema_name, fk_record.table_name, fk_record.column_name);
    EXECUTE sql_text USING probe_ids;
    GET DIAGNOSTICS n_deleted = ROW_COUNT;
    IF n_deleted > 0 THEN
      RAISE NOTICE '  % rows deleted from %.%', n_deleted, fk_record.schema_name, fk_record.table_name;
    END IF;
  END LOOP;

  -- 3. Same sweep for FKs that reference auth.users(id) directly
  --    (e.g. legal_review_signoffs.reviewer_id, staff_agreement_acceptances).
  FOR fk_record IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class c     ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    WHERE con.confrelid = 'auth.users'::regclass
      AND con.contype   = 'f'
      AND n.nspname     = 'public'   -- skip auth-internal tables
  LOOP
    sql_text := format('DELETE FROM %I.%I WHERE %I = ANY($1)',
                       fk_record.schema_name, fk_record.table_name, fk_record.column_name);
    EXECUTE sql_text USING probe_ids;
    GET DIAGNOSTICS n_deleted = ROW_COUNT;
    IF n_deleted > 0 THEN
      RAISE NOTICE '  % rows deleted from %.%', n_deleted, fk_record.schema_name, fk_record.table_name;
    END IF;
  END LOOP;

  -- 4. Now the parents.
  DELETE FROM public.clients WHERE id = ANY(probe_ids);
  DELETE FROM public.staff   WHERE id = ANY(probe_ids);
  DELETE FROM auth.users     WHERE id = ANY(probe_ids);

  RAISE NOTICE 'Cleanup complete.';
END $$;

-- 5. Confirm zero rows remain.
SELECT u.id, u.email
FROM auth.users u
WHERE u.email IN (
  'ragnar+invite-probe@fosslogmenn.is',
  'ragnar+probe@fosslogmenn.is'
);
