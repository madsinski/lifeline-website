-- Staff table for Lifeline team management
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('coach', 'doctor', 'nurse', 'psychologist', 'admin')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (admin dashboard)
CREATE POLICY "Allow all staff operations" ON staff USING (true) WITH CHECK (true);
