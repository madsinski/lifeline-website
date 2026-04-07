-- Add shared flag to client custom programs
ALTER TABLE client_custom_programs ADD COLUMN IF NOT EXISTS shared BOOLEAN DEFAULT false;
