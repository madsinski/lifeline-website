-- Lifeline staff in /admin/vinnustod act through a linked hc_workers row, so
-- they can be the interviewer (interviewer_id → hc_workers), connect Google
-- Calendar and get Meet links, and see "Mín viðtöl" — like partner nurses.
-- The row is created on first use (src/lib/hc/ws-auth.ts: workerForStaff);
-- it has no password and cannot sign in to /vinnustod by itself.
-- Idempotent.

alter table public.hc_workers add column if not exists staff_id uuid unique;
