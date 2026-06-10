// Lifeline Health — Technical Security Brief
//
// Companion to security-posture.ts, written for a TECHNICAL security
// reviewer (consultant, pentester, B2B security engineer) rather than
// a DPA auditor. It answers the questions the posture statement does
// not: key management, backups/DR, vulnerability management, rate
// limiting, session handling, environments/CI-CD, and monitoring —
// including an explicit list of known gaps. Every claim here must be
// verifiable in the codebase or infrastructure; never add aspirational
// claims as if they were current fact.
//
// MAINTENANCE RULE (same as security-posture.ts)
// ──────────────────────────────────────────────
// On any substantive change: bump TECHNICAL_BRIEF_VERSION, update
// TECHNICAL_BRIEF_LAST_UPDATED, add a CHANGELOG entry at the bottom.

export const TECHNICAL_BRIEF_VERSION = "v1.1";
export const TECHNICAL_BRIEF_LAST_UPDATED = "2026-06-10";

export function renderSecurityTechnicalBrief(): string {
  return `LIFELINE HEALTH — TECHNICAL SECURITY BRIEF
Version ${TECHNICAL_BRIEF_VERSION}  ·  Last updated ${TECHNICAL_BRIEF_LAST_UPDATED}

Audience: technical security reviewers. This document complements the
Security & Privacy Posture Statement (compliance-oriented, GDPR / Act
90/2018) with engineering-level detail and an explicit gap register.
We would rather name a gap ourselves than have it discovered.

═══════════════════════════════════════════════════════════════════
1. SYSTEM ARCHITECTURE & TRUST BOUNDARIES
═══════════════════════════════════════════════════════════════════

Components:
  - Next.js application (Vercel, Fluid Compute / Node) — serves the
    marketing site, the client account area, the staff admin app, and
    all API routes from one codebase.
  - Supabase (Postgres + Auth + Storage, hosted in Germany/EEA) — the
    single system of record for the operational (non-EHR) data.
  - React Native client app (separate repo) — talks to the same
    Supabase project and the website's API routes.
  - Medalia (licensed Icelandic EHR) — formal medical records. No API
    integration yet; data exchange is manual by licensed clinicians.
  - Biody Manager (France) — raw body-composition data, fetched on
    demand via a Supabase Edge Function; results are not persisted in
    Lifeline's database.

Trust boundaries:
  - Browser/app → API: Supabase JWT in the Authorization header;
    every API route re-derives the user server-side
    (getUserFromRequest) — no client-asserted identity.
  - API → database: two distinct clients. The anon client is subject
    to RLS; the service-role client bypasses RLS and exists ONLY in
    server code. A hard convention (enforced in review) forbids
    importing the service-role client or its env var into any
    "use client" file.
  - Website → Biody edge function: requires BOTH the service-role
    bearer (platform JWT gate) and an HMAC signature over the request
    (X-Lifeline-Signature) — a leaked service-role key alone cannot
    forge a call.

═══════════════════════════════════════════════════════════════════
2. AUTHENTICATION & SESSION MANAGEMENT
═══════════════════════════════════════════════════════════════════

  - Supabase Auth (GoTrue): bcrypt-hashed passwords, JWT access tokens
    with short expiry plus rotating refresh tokens (Supabase platform
    defaults; access-token lifetime ~1 hour). Sign-out revokes the
    refresh token.
  - Staff MFA: TOTP enrolment is mandatory; the admin app refuses
    access until the session is stepped up to AAL2. Server-side, every
    admin mutation endpoint independently re-verifies AAL2
    (requireAdminAAL2) — the check is not UI-only. Exception: the
    external-counsel role (lawyer), which can only reach the legal
    document area (no patient data) — documented in the posture
    statement v1.2.
  - Password flows: double-entry confirmation on every flow that sets
    a password (B2C signup, B2B signup, password change, invite
    claims). Email confirmation runs on our own domain via
    token_hash + verifyOtp; raw Supabase action links are never
    emailed.
  - Brute force: Supabase Auth applies platform rate limits to auth
    endpoints. Our own sensitive token endpoints add per-IP,
    database-backed rate limits (e.g. B2B invite verification: 20
    attempts/hour/IP via a check_rate_limit RPC) on top of a
    per-invite lockout, with expired/used tokens short-circuited
    before verification to prevent enumeration and timing leaks.
  - Staff offboarding: access is centrally revoked by deactivating the
    staff row — RLS policies and API gates all check is-active status
    on every request, so a deactivated account loses admin access on
    its next request even with a live session token.

═══════════════════════════════════════════════════════════════════
3. AUTHORIZATION MODEL
═══════════════════════════════════════════════════════════════════

  - Postgres Row Level Security on every table holding personal data.
    Tables that are API-mediated carry an explicit deny-all policy
    (FOR ALL USING (false)) so the only path is the server API.
  - Staff checks inside policies go through SECURITY DEFINER helper
    functions (is_active_staff(), is_admin_staff()) — never inline
    subqueries against the staff table (avoids recursive-policy bugs,
    one audited implementation).
  - API-layer gates are role-aware: read endpoints accept any active
    staff; write endpoints require admin-write roles AND AAL2.
    Read-only roles (external lawyer, external medical advisor) are
    blocked from writes at BOTH layers — API gate and RLS — defence
    in depth, not a single chokepoint.
  - Client-facing data access goes through the anon client under RLS;
    clients can only see their own rows (auth.uid() scoping).

═══════════════════════════════════════════════════════════════════
4. SECRETS & KEY MANAGEMENT
═══════════════════════════════════════════════════════════════════

Current state:
  - Application secrets (service-role key, HMAC signing secret, AI
    provider keys, SMTP) live in Vercel environment variables —
    encrypted at rest, scoped per environment, never committed.
    .env.local is gitignored; no secrets in the repository.
  - The column-encryption key lives in Supabase Vault
    (vault.secrets.lifeline_encryption_key); only SECURITY DEFINER
    functions (encrypt_text / decrypt_text) can read it. It is not an
    application env var, so an application-layer compromise does not
    directly expose it.
  - GitHub Actions secrets (DB connection string for backups) are
    repository secrets with least scope.

KNOWN GAP — rotation: there is no scheduled rotation policy. Keys are
rotated reactively (on suspicion of exposure). Planned: documented
rotation runbook + calendar for the service-role key, HMAC secret and
Vault key (the pgcrypto design supports re-encryption migration).

═══════════════════════════════════════════════════════════════════
5. RATE LIMITING & ABUSE PROTECTION
═══════════════════════════════════════════════════════════════════

  - Platform layer: Vercel provides DDoS mitigation and TLS
    termination on all endpoints; Supabase applies its own limits on
    auth endpoints.
  - Application layer (selective, on the endpoints that warrant it):
      - B2B invite verification: 20/hour/IP (DB-backed RPC) + lockout.
      - AI document parsing (lab reports, body-composition): per-user
        daily quotas by tier; staff exempt.
      - Error-ingestion endpoint: per-user in-memory throttle to stop
        log flooding.
  - Public AI endpoints require an authenticated user; there are no
    anonymous compute-expensive endpoints.

KNOWN GAP: no global WAF rules beyond the platform defaults, and rate
limits are per-endpoint by design rather than a blanket middleware.
Accepted at current traffic; revisit at public launch.

═══════════════════════════════════════════════════════════════════
6. BACKUPS & DISASTER RECOVERY
═══════════════════════════════════════════════════════════════════

  - Supabase managed daily snapshots, 7-day rolling window,
    restorable from the Supabase dashboard.
  - Independent nightly logical backup (GitHub Actions, 03:00 UTC):
    pg_dump of the full public schema + data, uploaded to a private
    Supabase Storage bucket (db-backups), 14-day retention, manual
    trigger available for pre-migration snapshots. This is
    deliberately a second, portable copy outside the managed snapshot
    system.
  - Storage buckets (signed PDFs etc.) are private with per-bucket
    RLS; bucket contents are included in the provider's redundancy,
    not in pg_dump.

KNOWN GAP — restore drills: a full timed restore from the nightly
dump into a clean project has not yet been performed as a documented
drill; RPO is ~24h worst case (nightly dump) and RTO is untested.
Planned before public launch.

═══════════════════════════════════════════════════════════════════
7. VULNERABILITY & DEPENDENCY MANAGEMENT
═══════════════════════════════════════════════════════════════════

  - April 2026: an external code-level security audit of the platform
    was performed; findings were remediated in three sprints
    (RLS hardening, audit logging, consent system, column encryption,
    MFA enforcement, DSR workflow) — captured as posture v1.0.
  - TypeScript strict mode + ESLint in development; framework and
    dependencies are kept on current major versions.

KNOWN GAPS:
  - No automated SCA/dependency scanning pipeline in CI (no
    Dependabot/Snyk config in-repo); updates are manual. Cheap to fix
    — planned.
  - No formal third-party penetration test yet. Planned once the
    public launch surface is final; the April audit was code-review
    based, not adversarial.

═══════════════════════════════════════════════════════════════════
8. LOGGING, MONITORING & DETECTION
═══════════════════════════════════════════════════════════════════

  - Immutable health-data audit log (Postgres triggers, admin-only
    read, 6-year retention) records every INSERT/UPDATE/DELETE on
    clients, messages, weight logs and body-composition events with
    actor identity and role.
  - Error telemetry is fully in-house (Sentry was removed 2026-06
    when the subscription ended; no third-party error service):
      - Server: captureException/captureMessage helpers write directly
        to public.app_errors; a withErrorReporting wrapper captures
        unhandled throws in API route handlers; the Next.js
        instrumentation onRequestError hook captures uncaught request
        errors.
      - Browser: a global error/unhandledrejection handler posts to
        /api/errors/capture, which is rate-limited per user.
      - PII redaction (kennitala + email regex) runs before storage on
        BOTH paths; cookies, headers and request bodies are never
        captured. Error data never leaves the EEA database — one
        fewer subprocessor than a hosted APM.
      - Trade-off, stated plainly: error reporting now shares fate
        with the primary database (Sentry was independent
        infrastructure). Vercel runtime logs remain an independent
        secondary signal for outage forensics.
  - Triage UI at /admin/errors (admin only); a daily error-digest cron
    emails a summary of new errors; a weekly cron chases overdue staff
    access reviews.

KNOWN GAP — detection is largely human-in-the-loop: the audit log is
query-on-demand, error notification latency is up to 24h (daily
digest, no real-time paging), and there is no automated anomaly
detection or alerting on unusual access patterns (e.g. a staff
account reading an abnormal number of client records). Accepted at
current team size (every staff member is personally known); revisit
as the team grows.

═══════════════════════════════════════════════════════════════════
9. ENVIRONMENTS, CI/CD & CHANGE MANAGEMENT
═══════════════════════════════════════════════════════════════════

  - Deployment: GitHub → Vercel. main auto-deploys to production;
    feature branches get isolated preview URLs. Production aliases
    are TLS-managed by Vercel.
  - Database migrations are plain SQL files in the repo, written
    idempotently, applied manually in the Supabase SQL editor —
    deliberate human gate on every schema change; pre-migration
    snapshots can be triggered on demand.

KNOWN GAPS:
  - Single production Supabase project; no separate staging database.
    Preview deployments exercise production data paths. Mitigated by
    the manual migration gate and idempotent SQL, but a staging
    project is the correct fix — planned.
  - Single-maintainer repository: no enforced branch protection /
    second-reviewer requirement yet. Will be enabled when the
    engineering team grows beyond one.

═══════════════════════════════════════════════════════════════════
10. ENDPOINT & DEVICE SECURITY
═══════════════════════════════════════════════════════════════════

  - Staff sign a device & access policy at onboarding (screen lock,
    no shared devices, no data exfiltration to personal storage);
    admin access additionally requires TOTP MFA, which limits the
    blast radius of a stolen password.
  - No MDM (mobile device management) is deployed — contractual +
    MFA controls only. Accepted at current team size; revisit when
    clinical staffing scales.

═══════════════════════════════════════════════════════════════════
11. GAP REGISTER — SUMMARY & PRIORITY
═══════════════════════════════════════════════════════════════════

  #  | Gap                                   | Risk   | Plan
  ───┼───────────────────────────────────────┼────────┼──────────────────
  1  | No scheduled secret/key rotation      | Medium | Rotation runbook + calendar
  2  | Restore drill never executed          | Medium | Timed drill pre-launch
  3  | No automated dependency scanning      | Medium | Enable Dependabot alerts + PRs
  4  | No formal penetration test            | Medium | Commission post-launch-surface
  5  | No staging database                   | Medium | Second Supabase project
  6  | No real-time alerting (daily digest)  | Low*   | Scheduled audit-log reports
     | nor access-anomaly detection          |        | + paging on fatal errors
  7  | No branch protection (single dev)     | Low*   | Enable with 2nd engineer
  8  | No MDM                                | Low*   | Revisit at clinical scale

  *Low at current scale (single-digit, personally-known staff; closed
  pre-launch user base). These re-rate to Medium at public launch.

═══════════════════════════════════════════════════════════════════
12. CHANGELOG
═══════════════════════════════════════════════════════════════════

v1.1 (2026-06-10)
  Error telemetry section rewritten: Sentry fully removed (subscription
  ended); in-house pipeline (app_errors + /api/errors/capture +
  instrumentation hook) documented, including the shared-fate
  trade-off vs. independent APM and the up-to-24h notification
  latency. Server-side reporter hardened with the same kennitala/email
  redaction as the browser path as part of this update. Gap #6
  broadened to cover real-time alerting.

v1.0 (2026-06-10)
  Initial release, prepared for external technical security review.
  Documents architecture/trust boundaries, authn/z, secrets, rate
  limiting, backups/DR, vulnerability management, monitoring, CI/CD,
  device posture, and an explicit 8-item gap register with priorities.
`;
}
