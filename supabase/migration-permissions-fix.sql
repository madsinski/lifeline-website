-- =============================================================
-- Security fixes: Staff RLS + tier rename
-- Run in Supabase SQL Editor
-- =============================================================

-- 1. Fix staff table RLS — restrict to admin-only management
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow all staff operations" ON staff;

-- Staff can read their own record
CREATE POLICY "Staff can read own record" ON staff
  FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Admins can read all staff
CREATE POLICY "Admins can read all staff" ON staff
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff s
    WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND s.role = 'admin' AND s.active = true
  ));

-- Admins can insert/update/delete staff
CREATE POLICY "Admins can manage staff" ON staff
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff s
    WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND s.role = 'admin' AND s.active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM staff s
    WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND s.role = 'admin' AND s.active = true
  ));

-- 2. Add permissions column if not exists
ALTER TABLE staff ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';

-- 3. Rename subscription tier: full-access → premium
-- Update clients table
UPDATE clients SET tier = 'premium' WHERE tier = 'full-access';

-- Update subscriptions table
UPDATE subscriptions SET tier = 'premium' WHERE tier = 'full-access';

-- Update any check constraints if they exist
-- (run ALTER only if constraint exists — safe to skip if not)
DO $$ BEGIN
  ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_tier_check;
  ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
