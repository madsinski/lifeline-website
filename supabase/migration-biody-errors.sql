-- Add activation error tracking to company_members
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS biody_activation_error TEXT;
