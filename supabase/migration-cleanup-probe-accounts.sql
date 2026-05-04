-- =============================================================
-- One-shot cleanup for the +probe / +invite-probe Ragnar test
-- accounts left over from the staff/create debugging session.
--
-- These were created when Claude was probing why supabase-js's
-- inviteUserByEmail() was returning "Database error saving new
-- user" (it was an SDK quirk — direct REST works). Each probe
-- created an auth.users row, which fired the handle_new_user()
-- trigger and produced an orphan clients row. They never had
-- subscriptions, programs, or any other downstream data, so this
-- script just removes the auth + clients rows.
--
-- Run in the Supabase SQL editor. Idempotent (re-running is a
-- no-op once the rows are gone).
-- =============================================================

-- 1. Confirm what we're about to delete. Inspect this output before
--    running the deletes below.
SELECT
  u.id        AS auth_user_id,
  u.email,
  u.created_at AS auth_created_at,
  c.id        AS clients_id,
  c.created_at AS clients_created_at,
  s.id        AS staff_id
FROM auth.users u
LEFT JOIN public.clients c ON c.id = u.id
LEFT JOIN public.staff   s ON s.id = u.id
WHERE u.email IN (
  'ragnar+invite-probe@fosslogmenn.is',
  'ragnar+probe@fosslogmenn.is'
);

-- 2. Drop any clients rows for those probes (children before parent).
DELETE FROM public.clients
 WHERE email IN (
   'ragnar+invite-probe@fosslogmenn.is',
   'ragnar+probe@fosslogmenn.is'
 );

-- 3. Drop staff rows in case any leaked through (defensive — we
--    don't expect any).
DELETE FROM public.staff
 WHERE email IN (
   'ragnar+invite-probe@fosslogmenn.is',
   'ragnar+probe@fosslogmenn.is'
 );

-- 4. Drop the auth users themselves. This cascades to identities,
--    sessions, refresh tokens etc. via Supabase's built-in auth
--    schema FKs.
DELETE FROM auth.users
 WHERE email IN (
   'ragnar+invite-probe@fosslogmenn.is',
   'ragnar+probe@fosslogmenn.is'
 );

-- 5. Re-run the SELECT from step 1 to confirm zero rows remain.
SELECT
  u.id, u.email
FROM auth.users u
WHERE u.email IN (
  'ragnar+invite-probe@fosslogmenn.is',
  'ragnar+probe@fosslogmenn.is'
);
