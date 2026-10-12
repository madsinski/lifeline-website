-- Lock down `subscriptions`.
--
-- ── What was wrong ────────────────────────────────────────────────────
--
-- The table had three policies that each said `true`:
--
--   "Allow insert subscriptions"  INSERT  with_check: true
--   "Allow read all subscriptions" SELECT  using: true
--   "Allow update subscriptions"  UPDATE  using: true
--
-- With the anon key, any signed-in person could therefore insert themselves
-- a premium row, read every other customer's subscription, or cancel
-- somebody else's. The first makes a paywall decorative; the second is a
-- disclosure of who pays for a health service, which is information about
-- those people; the third is simply other people's accounts.
--
-- Found while wiring the 14-day trial: a paywall on a table the client can
-- write is not a paywall.
--
-- ── What replaces them ───────────────────────────────────────────────
--
-- Read your own row, and nothing else. Every write goes through the API with
-- the service role (/api/hc/subscribe), which is where the rules about
-- trials, periods and discount codes live and the only place they can be
-- enforced. The staff policies are untouched: /admin/clients reads and
-- manages these rows with the anon key under is_active_staff(), and that
-- still works.
--
-- The signup flow inserted its trial row from the browser. That stops
-- working here, deliberately — the trial is created server side now
-- (ensureTrial in src/lib/hc/subscription.ts) on first sight of the journey,
-- which also covers everybody who signed up before this.

drop policy if exists "Allow insert subscriptions" on subscriptions;
drop policy if exists "Allow update subscriptions" on subscriptions;
drop policy if exists "Allow read all subscriptions" on subscriptions;

-- Your own, for the account page to show what you are on.
create policy "Read own subscription" on subscriptions
  for select using (client_id = auth.uid());
