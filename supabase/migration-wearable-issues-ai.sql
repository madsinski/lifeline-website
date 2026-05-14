-- =============================================================
-- wearable_setup_issues: AI suggestions + staff replies + email
--
-- Adds:
--   staff_reply              text     — the message that goes back to the user (email body)
--   ai_suggested_template_id text     — slug from wearable-issue-templates.ts (nullable)
--   ai_suggested_reply       text     — model-generated reply (template body, possibly tweaked by model)
--   ai_suggestion_confidence numeric  — 0..1, model's self-reported confidence
--   ai_suggested_at          timestamptz
--   auto_replied             bool     — true if the system answered without human review
--   replied_at               timestamptz — when the email was sent
--
-- Plus a generic system_settings table seeded with the wearable
-- auto-reply toggle, gated to staff-only read/write.
-- =============================================================

ALTER TABLE public.wearable_setup_issues
  ADD COLUMN IF NOT EXISTS staff_reply              text,
  ADD COLUMN IF NOT EXISTS ai_suggested_template_id text,
  ADD COLUMN IF NOT EXISTS ai_suggested_reply       text,
  ADD COLUMN IF NOT EXISTS ai_suggestion_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_suggested_at          timestamptz,
  ADD COLUMN IF NOT EXISTS auto_replied             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replied_at               timestamptz;

-- =============================================================
-- system_settings: small key/value store for org-wide toggles
-- like the wearable auto-reply switch. Staff can read/write.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read system settings" ON public.system_settings;
CREATE POLICY "staff read system settings" ON public.system_settings
  FOR SELECT TO authenticated
  USING (is_active_staff());

DROP POLICY IF EXISTS "staff write system settings" ON public.system_settings;
CREATE POLICY "staff write system settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (is_active_staff())
  WITH CHECK (is_active_staff());

-- Seed the wearable auto-reply toggle in the OFF position. Admins
-- flip it on from /admin/wearable-issues once they trust the templates.
INSERT INTO public.system_settings (key, value)
VALUES ('wearable_auto_reply_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Confidence floor: replies below this stay queued for human review
-- even when auto-reply is on. Stored separately so admins can tune.
INSERT INTO public.system_settings (key, value)
VALUES ('wearable_auto_reply_min_confidence', '0.85'::jsonb)
ON CONFLICT (key) DO NOTHING;
