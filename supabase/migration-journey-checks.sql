-- =============================================================
-- clients.journey_checks — per-client manual ticks on journey steps
--
-- Some steps on the /account journey timeline aren't directly
-- observable from the booking tables (e.g. "I answered the health
-- questionnaire in Medalia", "I did my blood draw at Sameind",
-- "I've read my final report"). Instead of building Medalia
-- webhooks for each, we let the client manually tick them on the
-- dashboard and store a per-step ISO timestamp here.
--
-- Shape:
--   { questionnaire: "2026-04-22T10:00:00Z",
--     blood_test:    "2026-04-23T08:15:00Z",
--     results_viewed: "2026-04-24T21:00:00Z" }
--
-- Empty object means no ticks yet. Keys not present mean "not
-- ticked". Users can untick too — the client just unsets the key.
-- =============================================================

alter table public.clients
  add column if not exists journey_checks jsonb not null default '{}'::jsonb;
