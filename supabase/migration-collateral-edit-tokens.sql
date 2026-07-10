-- External edit links for the Fjarlækningar × HSU print collateral.
--
-- Adds:
--   1. public.presentation_collateral        — the single content row (id = 1),
--      in case migration-presentation-collateral.sql was never applied.
--   2. public.presentation_collateral_tokens — unguessable, revocable edit
--      tokens (stored hashed) that let an external editor save the collateral
--      via /api/present/collateral without a login.
--
-- API-mediated: all access goes through server routes using supabaseAdmin
-- (service role), so both tables block direct client access via RLS.
-- Apply manually in the Supabase SQL editor (idempotent).

-- ── 1. Content singleton ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.presentation_collateral (
  id          integer PRIMARY KEY DEFAULT 1,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  CONSTRAINT presentation_collateral_singleton CHECK (id = 1)
);

ALTER TABLE public.presentation_collateral ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block client access" ON public.presentation_collateral;
CREATE POLICY "Block client access" ON public.presentation_collateral
  FOR ALL USING (false) WITH CHECK (false);

INSERT INTO public.presentation_collateral (id, data)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Edit tokens (hashed) ───────────────────────────────────────────────
-- token_hash = sha256(hex) of the plaintext token; the plaintext is shown to
-- the admin exactly once at mint time and never stored.
CREATE TABLE IF NOT EXISTS public.presentation_collateral_tokens (
  token_hash  text PRIMARY KEY,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  expires_at  timestamptz,
  revoked     boolean NOT NULL DEFAULT false,
  last_used_at timestamptz
);

ALTER TABLE public.presentation_collateral_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block client access" ON public.presentation_collateral_tokens;
CREATE POLICY "Block client access" ON public.presentation_collateral_tokens
  FOR ALL USING (false) WITH CHECK (false);
