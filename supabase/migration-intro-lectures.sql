-- Introduction lecture booking for B2B onboarding.
-- A company proposes a 30-minute introduction lecture (on-site or video) before
-- the measurement day. Mirrors doctor_interview_proposals: the proposal starts
-- as 'requested' and must be approved by Lifeline staff in /admin/business →
-- Approvals. Blood-test days deliberately do NOT require approval.
--
-- Apply manually in the Supabase SQL editor (idempotent). API:
--   src/app/api/business/intro-lectures/route.ts                (create)
--   src/app/api/admin/business/intro-lectures/[id]/approve/route.ts (approve/reject)

CREATE TABLE IF NOT EXISTS public.intro_lectures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lecture_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('onsite','video')),
  location TEXT,
  room_notes TEXT,
  approval_status TEXT NOT NULL DEFAULT 'requested'
    CHECK (approval_status IN ('requested','approved','rejected')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  admin_note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intro_lectures_company ON public.intro_lectures (company_id);
CREATE INDEX IF NOT EXISTS idx_intro_lectures_pending ON public.intro_lectures (approval_status)
  WHERE approval_status = 'requested';

ALTER TABLE public.intro_lectures ENABLE ROW LEVEL SECURITY;

-- Active staff: full access (reads in the admin Approvals UI; writes via API).
DROP POLICY IF EXISTS "intro_lectures_staff_all" ON public.intro_lectures;
CREATE POLICY "intro_lectures_staff_all" ON public.intro_lectures
  FOR ALL USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

-- Company contact / co-admin: read their own company's lectures (the portal
-- reads directly via the anon client). Writes go through the API (supabaseAdmin).
DROP POLICY IF EXISTS "intro_lectures_company_read" ON public.intro_lectures;
CREATE POLICY "intro_lectures_company_read" ON public.intro_lectures
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.contact_person_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_admins ca WHERE ca.company_id = intro_lectures.company_id AND ca.user_id = auth.uid())
  );
