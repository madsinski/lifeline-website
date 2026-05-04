-- =============================================================
-- Allow 'shareholder' as an employment_type on staff.
--
-- Stage 1 of the lawyer-role rollout added 'shareholder' to the
-- TypeScript types + UI dropdowns but missed the DB CHECK constraint.
-- Result: inserts/updates with employment_type='shareholder' fail
-- with "violates check constraint staff_employment_type_check".
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_employment_type_check;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_employment_type_check
  CHECK (
    employment_type IS NULL
    OR employment_type IN ('salaried','piece_rate','contractor','shareholder')
  );
