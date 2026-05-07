# Biody Manager API integration — executive summary

**Audience:** Medalia engineering leads.
**Goal:** Pull body-composition measurements from Biody into the Medalia app so all of a patient's health data lives in one place.
**Companion document:** `INTEGRATION_GUIDE.md` (full technical specification — meant to be handed to a developer or AI coding agent).

---

## What is Biody?

Biody Manager (https://www.biodymanager.com) is the cloud platform behind the **Biody Xpert / BX3** body-composition analysers — the impedance-based scales used by clinicians and gyms to capture weight, fat mass, muscle mass, total body water, phase angle, BMR, etc.

When a patient steps on the scale, the device uploads the measurement to Biody Manager. The Manager exposes a REST API (Symfony-based, JWT-authenticated) that lets a partner application:

1. **Create patients** — link a Medalia user to a Biody patient record.
2. **Group patients** — for B2B / multi-tenant deployments, each customer can be its own folder.
3. **Pull measurements** — receive each new analysed measurement and store it in your own database alongside the patient record.

There is no public Biody portal for end-users — the partner app *is* the patient-facing experience.

## Why integrate

Lifeline Health already integrated Biody using this exact pattern in 2025/2026 and shipped it to production. The integration replaces the standalone Biody clinician portal that patients otherwise have to log into separately. After the integration:

- Patients see body-composition history inside the Medalia app — no second login.
- Trends are correlated against everything else Medalia tracks (mood, sleep, exercise, blood markers).
- Clinicians get one chart instead of jumping between systems.
- The Biody scale operator (nurse / coach) needs no changes — they keep using the BX3 hardware exactly as today.

## Effort estimate

Lifeline's integration took roughly **three engineer-weeks** end-to-end including the gotchas. With the handoff guide a fresh team should land in **5–10 working days**:

- 1–2 days: auth flow, token caching, first patient created against a Biody sandbox account.
- 1–2 days: notification poll + measurement ingestion into your DB schema.
- 2–3 days: patient-group / company affiliation if you have B2B tenancy.
- 1–2 days: webhook *or* cron-driven reconciliation, error retries, monitoring.
- 1 day: secret rotation, HMAC signing between your backend and worker, documentation.

## What you need from Biody

A short email to your Biody account manager. Ask for:

1. **A partner service account** — email + password used by your backend to authenticate (`/api/login_check`). Single shared credential per partner — not one-per-user. Get a non-personal email (e.g. `api@yourcompany.com`).
2. **The `BM-Application` header value** — Lifeline uses `PartnerApp`. Confirm yours.
3. **The measurement template id** for the device(s) you'll receive data from. Lifeline uses `94586` (BX3 Dashboard). Different device families use different ids.
4. **Confirmation of the physical-activity enum ids** — Biody has 5 levels (`very low / low / average / strong / very high`). The integer ids 1–5 are inferred but should be verified per environment.
5. **A test patient + test measurement** in the sandbox so you can ingest one round-trip before going live.

Biody's docs are sparse and the API has a few quirks the integration guide enumerates — most of the time we spent debugging was tracing those, not on architecture.

## Recommended architecture (one paragraph)

A small backend worker (Lifeline's runs as a Supabase Edge Function; any serverless function or persistent service works) holds the partner credential, caches the JWT token in a key/value table, and exposes three internal endpoints to the rest of your app: `create-patient`, `poll` (cron-driven, every 3 minutes), and `reconcile` (cron-driven, daily, belt-and-braces). The Medalia app never talks to Biody directly — it asks the worker, which talks to Biody on its behalf. This keeps the credential out of the app bundle and lets you swap providers later without touching client code.

## What's in the integration guide

`INTEGRATION_GUIDE.md` covers, with concrete code samples:

- Auth flow + token caching + 401 retry
- Required headers (the undocumented `BM-Application` one)
- Patient lifecycle (create + reuse + uuid backfill)
- Patient groups (multi-tenant; varchar quirk on group name)
- Activity-level mapping
- Notification-driven poll loop
- Daily reconciliation sweep
- Measurement field mapping (Biody → your schema)
- The 8 specific gotchas Lifeline hit and how to handle them
- Suggested error handling + observability
- HMAC signing pattern between your app server and the worker

If you want the actual Lifeline implementation as a starting reference, the worker source is ~880 lines of TypeScript and can be shared on request — it's documented in line and covers every code path described in the guide.
