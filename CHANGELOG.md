# Lifeline Website + Backend — Changelog

All notable changes to the Lifeline Next.js website, admin app, and
Supabase database are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

> **MDR note** — Together with the mobile-app CHANGELOG and the
> `app_releases` + `risk_register` Supabase tables, this file forms
> the design-history-file evidence required by EU MDR 2017/745 and
> the IS implementation. Every deploy that changes user-facing
> behavior or data handling gets an entry below. The `Risk-relevant`
> section captures changes affecting safety, clinical accuracy,
> regulatory posture, or audit trail; those entries cross-reference
> a `risk_register` row via its short id.
>
> Versioning policy:
> - **MAJOR** — schema-incompatible changes, removed admin
>   capability, change of business model
> - **MINOR** — new admin/user-facing capability or material UX
>   change
> - **PATCH** — bug fixes + non-clinical polish

## Sections in each release

- **Added** — new features
- **Changed** — modifications to existing behavior
- **Fixed** — bug fixes
- **Security** — security or privacy improvements
- **Schema** — Supabase migrations applied (file name + summary)
- **Risk-relevant** — changes affecting safety, clinical accuracy,
  regulatory posture, data integrity, or audit trail
- **Internal** — refactors / infra / dependency bumps (optional)

---

## [Unreleased]

### Added
- Beta Tester Agreement v1.0 (`src/lib/beta-nda-content.ts`) + signing
  flow (`/api/beta/accept-nda`) + admin viewer (`/admin/beta`).
- Per-build version registry (`app_releases`) + risk register
  (`risk_register`) tables and `/admin/releases` admin page.
- `get_my_staff_profile()` SECURITY DEFINER RPC so the admin UI
  guards work for invited admins whose `staff.id != auth.users.id`.
- Beta feedback resolution workflow with admin reply note that
  surfaces to the tester in-app on next FAB open.

### Changed
- `useStaffGuard` now RPCs `get_my_staff_profile()` instead of
  selecting from `public.staff` directly (RLS-safe for invited
  admins).
- `/admin/beta` becomes a tabbed page (Feedback + Signed agreements).

### Schema
- `migration-beta-nda-acceptances.sql` — new table + storage bucket
  for beta NDA acceptances.
- `migration-get-my-staff-profile.sql` — new SECURITY DEFINER RPC
  exposing the current user's staff role and permissions.
- `migration-beta-feedback-resolution.sql` — adds `user_id`,
  `resolution_note`, `resolved_at`, `resolved_by`,
  `viewed_by_user_at` to `beta_feedback`; backfills `user_id` from
  `user_email`; trigger keeps the legacy `resolved` boolean in sync
  with `resolved_at`.
- `migration-app-releases.sql` — `app_releases` + `risk_register`
  tables, indexes, RLS, `app-releases-sbom` storage bucket.

### Risk-relevant
- Beta NDA signatures are stored with `text_hash`, IP, UA,
  app_platform, app_version, plus a generated PDF audit cert in a
  private storage bucket. Audit trail is replay-safe.

---

## [0.1.0] — 2026-05-23

Initial release of the admin app + public website. Includes:

- Public marketing site at lifelinehealth.is.
- Admin app at /admin with staff role gating (admin, coach,
  doctor, nurse, psychologist, lawyer, medical_advisor).
- Supabase backend with RLS, encrypted PII columns
  (clients + messages), staff agreement acceptances, platform
  agreement acceptances, beta feedback, app error mirror.
- AI ingest endpoints for the mobile app
  (`/api/health-coach/*`, `/api/ai/*`, `/api/onboarding/*`).
- Söluskilmálar (B2C sales terms v1.0) at `/soluskilmalar` (IS)
  and `/sales-terms` (EN).

### Risk-relevant
- Platform agreement acceptances + sales terms v1.0 form the
  baseline for user consent at first launch.
- Encrypted column scheme for `messages.content` and `clients` PII
  via pgcrypto + Vault, with `_decrypted` views + INSTEAD OF
  triggers. No plaintext columns exist.
