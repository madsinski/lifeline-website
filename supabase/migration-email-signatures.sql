-- =============================================================
-- Internal email-signature directory.
--
-- Powers /admin/signatures — the founding-team Gmail signature
-- builder. One row per signature "card", keyed by a short slug
-- (mads, victor, vignir, elvar, ...). Editing is admin-only;
-- reads are open to any active staff so anyone on the team can
-- pull their own up-to-date signature without admin involvement.
--
-- Not tied to the `staff` table by FK on purpose — we want to
-- be able to pre-seed slots for hires who don't have a staff
-- row yet, and the signature line of a "title" can differ from
-- the operational role we store on staff.
--
-- Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.email_signatures (
  key         text PRIMARY KEY,
  name        text NOT NULL,
  title       text NOT NULL DEFAULT '',
  phone       text NOT NULL DEFAULT '',
  email       text NOT NULL DEFAULT '',
  sort_order  smallint NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies so re-runs pick up changes.
DROP POLICY IF EXISTS "Active staff can read signatures" ON public.email_signatures;
CREATE POLICY "Active staff can read signatures"
ON public.email_signatures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = auth.uid() AND s.active = true
  )
);

-- Writes are mediated by the API route which checks admin via
-- service-role context — so no client-side write policy needed.
-- Explicitly deny anon/authenticated writes.
DROP POLICY IF EXISTS "Block client writes" ON public.email_signatures;
CREATE POLICY "Block client writes"
ON public.email_signatures
FOR ALL
USING (false)
WITH CHECK (false);

-- Seed defaults. ON CONFLICT preserves any edits already made.
INSERT INTO public.email_signatures (key, name, title, phone, email, sort_order)
VALUES
  ('mads',   'Mads Christian Aanesen', 'Medical doctor · Co-founder, Lifeline Health ehf.',                                       '+354 767 4393', 'mads@lifelinehealth.is',   1),
  ('victor', 'Victor Guðmundsson',     'Medical doctor · Founder & CEO, Lifeline Health ehf.',                                    '+354 ',         'victor@lifelinehealth.is', 2),
  ('vignir', 'Vignir Sigurðsson',      'Chief Medical Advisor · Pediatrician · Ass. Prof. HA, Lifeline Health ehf.',              '+354 ',         'vignir@lifelinehealth.is', 3),
  ('elvar',  'Elvar',                  'Lifeline Health ehf.',                                                                    '+354 ',         'elvar@lifelinehealth.is',  4)
ON CONFLICT (key) DO NOTHING;
