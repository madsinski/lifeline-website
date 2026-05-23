-- =============================================================
-- Admin "Add note" affordance — new text columns on two tables so
-- the inline AdminAppendNote widget has somewhere to write.
--
-- risk_register.notes already exists from migration-app-releases.sql
-- so we don't touch it here.
-- =============================================================

alter table public.app_releases
  -- release_notes captures what shipped (markdown copy of the
  -- CHANGELOG block). release_addendum captures post-launch
  -- observations — regressions discovered, hotfix references,
  -- field reports from testers — appended over the release's
  -- lifetime. Kept separate from release_notes so the original
  -- "what we said we shipped" stays immutable for audit.
  add column if not exists release_addendum text;

alter table public.beta_nda_acceptances
  -- Free-form admin annotations per tester. Common uses: tester
  -- requested data deletion on date X; tester escalated to
  -- production user on date Y; out-of-band conversation summary.
  add column if not exists admin_notes text;

notify pgrst, 'reload schema';
