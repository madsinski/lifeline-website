-- =============================================================
-- Sprint 1.2: Self-only RLS for Biody-derived columns
--
-- During the wellness-mode interim (until Medalia API ships), body
-- composition values + journey-state timestamps that originated from
-- Biody / clinical capture must be readable only by the client
-- themselves. Staff who need the clinical context view it in Medalia.
--
-- Concretely: weight_log + body_comp_events SELECT is restricted to
-- the row's own client_id = auth.uid(). The existing staff-side
-- "Staff can view all" policies on these tables (if any) are dropped.
--
-- The clients table itself is NOT pulled into self-only here — too many
-- coach workflows depend on basic client identity (name, scheduling).
-- The denormalised body comp columns on clients (weight_kg, body_fat_pct
-- etc.) should be encrypted at-rest separately (see encryption runbook).
--
-- Run in the Supabase SQL editor. Idempotent.
-- =============================================================

-- weight_log
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'weight_log') THEN
    EXECUTE 'ALTER TABLE public.weight_log ENABLE ROW LEVEL SECURITY';
    -- Drop any prior staff-visible policies
    EXECUTE 'DROP POLICY IF EXISTS "Staff can view weight log" ON public.weight_log';
    EXECUTE 'DROP POLICY IF EXISTS "Staff can manage weight log" ON public.weight_log';
    -- Self-only read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own weight log') THEN
      EXECUTE $p$
        CREATE POLICY "Clients can view own weight log" ON public.weight_log
          FOR SELECT TO authenticated
          USING (client_id = auth.uid())
      $p$;
    END IF;
    -- Service-role / triggers can still write (RLS bypassed by service_role).
    -- No client INSERT policy by design — body comp is captured server-side.
  END IF;
END $$;

-- body_comp_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'body_comp_events') THEN
    EXECUTE 'ALTER TABLE public.body_comp_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Staff can view body comp events" ON public.body_comp_events';
    EXECUTE 'DROP POLICY IF EXISTS "Staff can manage body comp events" ON public.body_comp_events';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own body comp events') THEN
      EXECUTE $p$
        CREATE POLICY "Clients can view own body comp events" ON public.body_comp_events
          FOR SELECT TO authenticated
          USING (client_id = auth.uid())
      $p$;
    END IF;
  END IF;
END $$;

-- macro_targets — derived from body comp + activity. Same self-only
-- treatment. If macro_targets has client_id column, scope to it.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'macro_targets')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'macro_targets' AND column_name = 'client_id') THEN
    EXECUTE 'ALTER TABLE public.macro_targets ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Staff can view macro targets" ON public.macro_targets';
    EXECUTE 'DROP POLICY IF EXISTS "Staff can manage macro targets" ON public.macro_targets';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own macro targets') THEN
      EXECUTE $p$
        CREATE POLICY "Clients can view own macro targets" ON public.macro_targets
          FOR SELECT TO authenticated
          USING (client_id = auth.uid())
      $p$;
    END IF;
  END IF;
END $$;
