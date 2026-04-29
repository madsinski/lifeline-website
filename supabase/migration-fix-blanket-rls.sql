-- =============================================================
-- Sprint 0 — Fix blanket-allow RLS on health-adjacent tables.
--
-- Previously, conversations, messages, and the staff table all had
-- `USING (true) WITH CHECK (true)` policies — which effectively
-- disabled RLS. Anyone with a valid JWT could read every coaching
-- conversation (containing health-sensitive content) and every staff
-- record.
--
-- This migration drops those blanket policies and replaces them with
-- scoped policies. The existing staff-side policies in
-- migration-staff-rls.sql (Staff can view all conversations / messages,
-- Staff can manage conversations, Staff can send messages) are kept —
-- they're properly scoped to active staff via EXISTS(SELECT 1 FROM staff
-- WHERE id = auth.uid() AND active = true).
--
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
-- =============================================================

-- ─── Conversations: drop blanket allow, scope to participating client ─
DROP POLICY IF EXISTS "Allow all conversation operations" ON conversations;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own conversations') THEN
    CREATE POLICY "Clients can view own conversations" ON conversations
      FOR SELECT TO authenticated
      USING (client_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can insert own conversations') THEN
    CREATE POLICY "Clients can insert own conversations" ON conversations
      FOR INSERT TO authenticated
      WITH CHECK (client_id = auth.uid());
  END IF;
END $$;

-- ─── Messages: drop blanket allow, scope to participating client ──────
DROP POLICY IF EXISTS "Allow all message operations" ON messages;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view messages in own conversations') THEN
    CREATE POLICY "Clients can view messages in own conversations" ON messages
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.id = conversation_id AND c.client_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can send messages in own conversations') THEN
    CREATE POLICY "Clients can send messages in own conversations" ON messages
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.id = conversation_id AND c.client_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can mark own messages read') THEN
    CREATE POLICY "Clients can mark own messages read" ON messages
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.id = conversation_id AND c.client_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.id = conversation_id AND c.client_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── Staff: drop blanket allow, scope to self-read + admin-write ──────
-- Active staff also need to see other active staff for coach assignment,
-- conversation routing, and team UIs — but only when they themselves
-- are active staff. Outside-staff cannot enumerate the team.
DROP POLICY IF EXISTS "Allow all staff operations" ON staff;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view own row') THEN
    CREATE POLICY "Staff can view own row" ON staff
      FOR SELECT TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Active staff can view team') THEN
    CREATE POLICY "Active staff can view team" ON staff
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM staff s
          WHERE s.id = auth.uid() AND s.active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage staff') THEN
    CREATE POLICY "Admin can manage staff" ON staff
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM staff s
          WHERE s.id = auth.uid() AND s.active = true AND s.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM staff s
          WHERE s.id = auth.uid() AND s.active = true AND s.role = 'admin'
        )
      );
  END IF;
END $$;
