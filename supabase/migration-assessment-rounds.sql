-- =============================================================
-- Assessment Rounds: multi-cycle support for B2B health assessments
-- Run in Supabase SQL Editor
-- =============================================================

-- 1. Assessment rounds table
CREATE TABLE IF NOT EXISTS public.assessment_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  package TEXT NOT NULL DEFAULT 'foundational' CHECK (package IN ('foundational', 'checkin', 'self-checkin')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduling', 'active', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  roster_confirmed_at TIMESTAMPTZ,
  events_scheduled BOOLEAN DEFAULT false,
  blood_days_scheduled BOOLEAN DEFAULT false,
  agreement_signed_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  employee_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, round_number)
);

CREATE INDEX IF NOT EXISTS assessment_rounds_company_idx
  ON assessment_rounds (company_id, round_number DESC);

ALTER TABLE assessment_rounds ENABLE ROW LEVEL SECURITY;

-- Staff + company contact can read rounds for their company
CREATE POLICY "Staff can view all rounds" ON assessment_rounds
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND staff.active = true));

CREATE POLICY "Company contact can view own rounds" ON assessment_rounds
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = assessment_rounds.company_id AND companies.contact_person_id = auth.uid()));

-- Staff can manage rounds
CREATE POLICY "Staff can manage rounds" ON assessment_rounds
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND staff.active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND staff.active = true));

-- Company contact can update own rounds (for scheduling steps)
CREATE POLICY "Contact can update own rounds" ON assessment_rounds
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = assessment_rounds.company_id AND companies.contact_person_id = auth.uid()));

-- 2. Add round reference to events and blood days
ALTER TABLE body_comp_events ADD COLUMN IF NOT EXISTS assessment_round_id UUID REFERENCES assessment_rounds(id);
ALTER TABLE blood_test_days ADD COLUMN IF NOT EXISTS assessment_round_id UUID REFERENCES assessment_rounds(id);
ALTER TABLE company_invoices ADD COLUMN IF NOT EXISTS assessment_round_id UUID REFERENCES assessment_rounds(id);

-- 3. Add renewal fields to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_round_completed_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS next_renewal_eligible_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS current_round_id UUID REFERENCES assessment_rounds(id);

-- 4. Create initial round for existing companies that have finalized
INSERT INTO assessment_rounds (company_id, round_number, package, status, started_at, finalized_at, completed_at)
SELECT
  c.id,
  1,
  'foundational',
  CASE WHEN c.registration_finalized_at IS NOT NULL THEN 'completed' ELSE 'active' END,
  c.created_at,
  c.registration_finalized_at,
  c.registration_finalized_at
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM assessment_rounds ar WHERE ar.company_id = c.id
)
ON CONFLICT (company_id, round_number) DO NOTHING;

-- Link existing companies to their round
UPDATE companies c
SET current_round_id = ar.id,
    last_round_completed_at = ar.completed_at
FROM assessment_rounds ar
WHERE ar.company_id = c.id AND ar.round_number = 1 AND c.current_round_id IS NULL;
