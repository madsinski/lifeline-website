-- =============================================================
-- Feedback survey privacy polish (service-feedback baseline).
--
-- Adds the lightweight transparency + retention items needed before
-- sending the post-assessment survey to clients. This is service-
-- feedback (NPS + likert + open free text); legitimate interest
-- (GDPR Art. 6(1)(f)) is the lawful basis, so no consent gate is
-- required — but we still owe:
--   1. A plain-language transparency line in the survey intro.
--   2. A nudge over free-text fields so respondents don't paste
--      sensitive info there.
--   3. A documented retention period on each assignment so we don't
--      hold responses forever.
--
-- DSR runbook coverage is updated separately in
-- supabase/runbooks/dsr-runbook.md.
--
-- Idempotent. Run in the Supabase SQL editor.
-- =============================================================

-- ─── 1. Append transparency line to the post-assessment intro ────
UPDATE public.feedback_surveys
SET intro_is = 'Kæri þátttakandi,

Takk kærlega fyrir að taka þátt í heildrænu heilsuþjónustunni okkar hjá Lifeline Health.

Markmið okkar er að hjálpa fólki að bæta heilsu sína með persónulegri og gagnadrifinni nálgun, byggðri á fjórum grunnstoðum: hreyfingu, næringu, svefni og andlegri heilsu.

Til að þróa þjónustuna áfram og gera hana enn betri fyrir þig og aðra, biðjum við þig að taka nokkrar mínútur í að svara þessari könnun. Hún tekur um 5 mínútur.

Við þökkum kærlega fyrir þátttökuna!

Svörin þín eru geymd dulkóðuð og notuð til að bæta þjónustuna okkar. Þú getur óskað eftir afriti eða eyðingu hvenær sem er á contact@lifelinehealth.is. Persónuverndarstefna: https://lifelinehealth.is/privacy',
    updated_at = now()
WHERE key = 'post-assessment' AND version = 1;

-- ─── 2. Free-text nudge on the two open questions ───────────────
-- Q18 ("Hvað fannst þér best...") and Q19 ("Ef þú mættir breyta...")
-- are open-ended; gently steer respondents away from sensitive info.
UPDATE public.feedback_questions q
SET helper_is = 'Vinsamlegast deildu ekki viðkvæmum heilsuupplýsingum hér.',
    updated_at = now()
FROM public.feedback_surveys s
WHERE q.survey_id = s.id
  AND s.key = 'post-assessment'
  AND s.version = 1
  AND q.question_type = 'open'
  AND q.helper_is IS NULL;  -- don't overwrite if a human already set one

-- ─── 3. Retention period on assignments ──────────────────────────
-- Default 3 years from send date, aligned with the legitimate-interest
-- balancing test (long enough to track cohort improvements, short
-- enough to stay proportionate). Override per-row if needed.
ALTER TABLE public.feedback_assignments
  ADD COLUMN IF NOT EXISTS retention_until DATE;

-- Backfill: existing assignments get 3y from sent_at.
UPDATE public.feedback_assignments
SET retention_until = (sent_at::date + INTERVAL '3 years')::date
WHERE retention_until IS NULL;

-- Default for new rows.
ALTER TABLE public.feedback_assignments
  ALTER COLUMN retention_until SET DEFAULT (current_date + INTERVAL '3 years')::date;

CREATE INDEX IF NOT EXISTS feedback_assignments_retention_idx
  ON public.feedback_assignments (retention_until);

-- ─── 4. Cleanup helper (manual run / cron) ──────────────────────
-- Cascades to feedback_responses via the existing ON DELETE CASCADE
-- on feedback_responses.assignment_id. Run quarterly:
--
--   SELECT public.purge_expired_feedback_assignments();
--
-- Returns the number of assignments deleted.
CREATE OR REPLACE FUNCTION public.purge_expired_feedback_assignments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Admin-only — staff with the admin role can invoke directly; a
  -- pg_cron job would run as superuser and pass through.
  IF auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.staff
       WHERE id = auth.uid() AND active = true AND role = 'admin'
     )
  THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH deleted AS (
    DELETE FROM public.feedback_assignments
    WHERE retention_until IS NOT NULL
      AND retention_until < current_date
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_feedback_assignments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_feedback_assignments() TO authenticated;
