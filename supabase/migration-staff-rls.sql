-- =============================================================
-- Staff RLS policies for coach admin
-- Allows active staff to manage client data
-- Run this in the Supabase SQL Editor
-- =============================================================

-- Staff can view all client programs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view client programs') THEN
    CREATE POLICY "Staff can view client programs" ON client_programs
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

-- Staff can update client programs (change week, etc.)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can manage client programs') THEN
    CREATE POLICY "Staff can manage client programs" ON client_programs
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

-- Staff can view all clients
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view all clients') THEN
    CREATE POLICY "Staff can view all clients" ON clients
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

-- Staff can update clients (assign coach, etc.)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can update clients') THEN
    CREATE POLICY "Staff can update clients" ON clients
      FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

-- Staff can view all subscriptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view subscriptions') THEN
    CREATE POLICY "Staff can view subscriptions" ON subscriptions
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

-- Staff can manage subscriptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can manage subscriptions') THEN
    CREATE POLICY "Staff can manage subscriptions" ON subscriptions
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

-- Staff can view all action completions (for progress tracking)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view action completions') THEN
    CREATE POLICY "Staff can view action completions" ON action_completions
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

-- Staff can view all health records
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view health records') THEN
    CREATE POLICY "Staff can view health records" ON health_records
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

-- Staff can manage conversations and messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view all conversations') THEN
    CREATE POLICY "Staff can view all conversations" ON conversations
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can manage conversations') THEN
    CREATE POLICY "Staff can manage conversations" ON conversations
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view all messages') THEN
    CREATE POLICY "Staff can view all messages" ON messages
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can send messages') THEN
    CREATE POLICY "Staff can send messages" ON messages
      FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.active = true));
  END IF;
END $$;
