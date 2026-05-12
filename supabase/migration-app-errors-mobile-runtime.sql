-- =============================================================
-- Extend app_errors.runtime to allow 'mobile' so the RN app can
-- mirror its errors into the same triage table the website uses.
--
-- The original constraint only allowed 'browser'/'server'/'edge'
-- because Sentry's RN SDK wasn't wired in. RN now reports via a
-- direct write through /api/errors with runtime='mobile'.
--
-- Idempotent.
-- =============================================================

ALTER TABLE public.app_errors
  DROP CONSTRAINT IF EXISTS app_errors_runtime_check;

ALTER TABLE public.app_errors
  ADD CONSTRAINT app_errors_runtime_check
  CHECK (runtime IS NULL OR runtime IN ('browser','server','edge','mobile'));
