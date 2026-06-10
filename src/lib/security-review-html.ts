// Branded HTML renderings of the security documents, served on the
// password-gated /security-review page via iframe srcDoc.
//
// CANONICAL SOURCE: docs/security-review/*.html — this file is GENERATED
// from those with scripts in that folder (see git history). When the posture
// or brief version bumps, regenerate the HTML there, re-run the generation
// command from the commit message, and regenerate the PDFs.

export const SECURITY_POSTURE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Lifeline Health · Security &amp; Privacy Posture Statement v1.7</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<style>
  :root {
    --ink: #111827;
    --ink-2: #374151;
    --ink-3: #6B7280;
    --ink-4: #9CA3AF;
    --rule: #E5E7EB;
    --rule-soft: #F3F4F6;
    --accent: #10B981;
    --accent-bg: #ECFDF5;
    --warn-bg: #FFF7ED;
    --warn-ink: #92400E;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: var(--ink);
    background: #fff;
    line-height: 1.55;
    font-size: 14px;
  }
  .page { max-width: 820px; margin: 0 auto; padding: 56px 48px 80px 48px; }

  .title-block { border-bottom: 2px solid var(--accent); padding-bottom: 18px; margin-bottom: 28px; }
  .title-kicker {
    text-transform: uppercase; letter-spacing: 0.12em;
    font-size: 11px; font-weight: 700;
    color: var(--accent);
  }
  .title-block h1 {
    margin: 6px 0 4px 0;
    font-size: 28px; line-height: 1.18; letter-spacing: -0.012em;
    color: var(--ink);
  }
  .title-block .subtitle { color: var(--ink-2); font-size: 14px; margin-bottom: 4px; }
  .title-block .meta {
    font-size: 11px; color: var(--ink-3);
    margin-top: 12px; display: flex; gap: 22px; flex-wrap: wrap;
  }
  .title-block .meta strong { color: var(--ink-2); font-weight: 600; }

  h2 {
    font-size: 17px; margin: 32px 0 8px 0; padding-top: 12px;
    border-top: 1px solid var(--rule);
    color: var(--ink); letter-spacing: -0.005em;
  }
  h2 .num { color: var(--accent); margin-right: 8px; font-weight: 700; }
  h3 { font-size: 14px; margin: 18px 0 6px 0; color: var(--ink-2); }
  h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3); margin: 14px 0 4px 0; }

  p { margin: 8px 0; }
  ul, ol { margin: 8px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  strong { color: var(--ink); }

  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--rule-soft); padding: 1px 5px; border-radius: 3px; font-size: 12px; }

  table {
    width: 100%; border-collapse: collapse;
    margin: 10px 0 16px 0; font-size: 12.5px;
  }
  th, td { border-bottom: 1px solid var(--rule); padding: 7px 8px; text-align: left; vertical-align: top; }
  th {
    background: var(--rule-soft);
    font-weight: 600; color: var(--ink-2);
    border-bottom: 1px solid var(--rule); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  tr:last-child td { border-bottom: none; }

  .callout {
    border-left: 3px solid var(--accent);
    background: var(--accent-bg);
    padding: 10px 14px;
    margin: 12px 0;
    border-radius: 0 4px 4px 0;
  }
  .callout h4 { margin-top: 0; color: var(--accent); }
  .callout-warn { border-left-color: #F59E0B; background: var(--warn-bg); }
  .callout-warn h4 { color: var(--warn-ink); }

  .check { list-style: none; padding-left: 4px; }
  .check li { padding-left: 20px; position: relative; }
  .check li::before { content: "✓"; color: var(--accent); font-weight: 700; position: absolute; left: 0; }

  .small { font-size: 12px; color: var(--ink-3); }

  @media print {
    body { font-size: 11.5px; }
    .page { padding: 16mm 18mm 18mm 18mm; max-width: none; }
    h2 { page-break-after: avoid; }
    table, tr, td, th { page-break-inside: avoid; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    a { color: var(--ink); text-decoration: none; }
  }

  .toolbar {
    position: fixed; top: 16px; right: 16px;
    background: var(--ink); color: #fff;
    padding: 8px 14px; border-radius: 999px;
    font-size: 12px; font-weight: 600;
    border: none; cursor: pointer;
    box-shadow: 0 6px 14px rgba(0,0,0,0.12);
  }
  .toolbar:hover { background: #000; }

  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid var(--rule); font-size: 11px; color: var(--ink-4); }
</style>
</head>
<body>
<button class="toolbar no-print" onclick="window.print()">Print / Export PDF</button>
<div class="page">

  <header class="title-block">
    <div class="title-kicker">Lifeline Health · Compliance</div>
    <h1>Security &amp; Privacy Posture Statement</h1>
    <div class="subtitle">All technical and organisational measures protecting personal data — Act 90/2018, Act 55/2009, Act 40/2007, GDPR</div>
    <div class="meta">
      <span><strong>Version:</strong> v1.7</span>
      <span><strong>Last updated:</strong> 10 June 2026</span>
      <span><strong>Controller:</strong> Lifeline Health ehf.</span>
      <span><strong>Language:</strong> English companion — the Icelandic original prevails</span>
    </div>
  </header>

  <section>
    <p>
      This document describes all technical and organisational security measures that Lifeline Health ehf.
      has in place to protect personal data, in accordance with Icelandic Act No. 90/2018 on Data Protection,
      Act No. 55/2009 on Medical Records, Act No. 40/2007 on Health Services, and Regulation (EU) 2016/679 (GDPR).
      It is intended for audits by Persónuvernd (the Icelandic DPA), for legal counsel, and for B2B customers
      assessing our security posture before entrusting us with their employees' data.
    </p>
  </section>

  <section>
    <h2><span class="num">1</span>Entity and contact</h2>
    <table>
      <tr><th>Role</th><th>Details</th></tr>
      <tr><td>Data controller</td><td>Lifeline Health ehf. · Reg. no. (kennitala) 590925-1440 · Langholtsvegur 111, 104 Reykjavík, Iceland · contact@lifelinehealth.is · www.lifelinehealth.is</td></tr>
      <tr><td>Data Protection Officer</td><td>Mads Christian Aanesen, CTO and founder · contact@lifelinehealth.is</td></tr>
      <tr><td>Supervisory authority</td><td>Persónuvernd · postur@personuvernd.is · www.personuvernd.is — data subjects may lodge complaints directly</td></tr>
      <tr><td>Other regulators</td><td>Directorate of Health (healthcare licence, Act 41/2007); Icelandic Health Insurance where applicable</td></tr>
    </table>
  </section>

  <section>
    <h2><span class="num">2</span>Scope of service</h2>
    <p>
      Lifeline Health operates a licensed healthcare service (health assessments, blood tests, body-composition
      measurements, doctor consultations, training and counselling) under Act No. 40/2007. Technically the
      service consists of three layers:
    </p>
    <ul>
      <li><strong>Lifeline app + admin</strong> — operational tooling (bookings, training plans, coach messaging, self-tracking). Data protection under Act 90/2018. <em>Not a medical record.</em></li>
      <li><strong>Medalia</strong> — medical-records system licensed under Act 55/2009, hosting clients' formal medical records. Joint controllership under GDPR Art. 26.</li>
      <li><strong>Biody Manager</strong> — external measurement device + cloud service for raw body-composition data. Processor under GDPR Art. 28.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">3</span>Lawful basis</h2>
    <table>
      <tr><th>Data</th><th>Basis</th></tr>
      <tr><td>Personal data</td><td>Art. 6(1)(b) contract performance · Art. 6(1)(c) legal obligation (Acts 55/2009, 40/2007, tax law) · Art. 6(1)(f) legitimate interests (security, incident management, debugging)</td></tr>
      <tr><td>Health data (Art. 9)</td><td>Art. 9(2)(a) explicit consent · Art. 9(2)(h) healthcare by professionals bound by confidentiality (Act 34/2012)</td></tr>
      <tr><td>Marketing / research</td><td>Art. 6(1)(a) separate opt-in consent, revocable at any time</td></tr>
    </table>
  </section>

  <section>
    <h2><span class="num">4</span>Data categories</h2>
    <ul>
      <li><strong>General personal data</strong> (Lifeline Supabase): name, email, phone, address, date of birth; <strong>last 4 digits of the kennitala only</strong> — the full national ID is never stored (data minimisation, Art. 5(1)(c)); subscription status, bookings, payments.</li>
      <li><strong>Special categories (Art. 9):</strong> medical-record data lives in Medalia; raw body-composition data lives in Biody Manager and is fetched on demand with explicit consent (no persistent storage in Lifeline since 2026-05-03); coach–client messages (may contain health information) are stored <strong>encrypted</strong> in the Lifeline database.</li>
      <li><strong>Wellness data:</strong> self-logged weight, activity, meals, reflections; plans, scores, completions.</li>
      <li><strong>Staff and business data:</strong> staff records (role, licences, contracts); B2B company data (contracts, invoices, employee rosters).</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">5</span>Hosting &amp; data location</h2>
    <table>
      <tr><th>Provider</th><th>Role</th><th>Location</th></tr>
      <tr><td>Medalia ehf.</td><td>Medical-records system (EHR)</td><td>Iceland</td></tr>
      <tr><td>Biody Manager</td><td>Body-composition measurements</td><td>France (EEA)</td></tr>
      <tr><td>Supabase Inc.</td><td>Database, authentication</td><td>Germany (EEA)</td></tr>
      <tr><td>Vercel Inc.</td><td>Web hosting, frontend services</td><td>EEA + USA (SCC)</td></tr>
      <tr><td>Resend (Lilo Labs)</td><td>Email delivery</td><td>EEA + USA (SCC)</td></tr>
    </table>
    <p class="small">All parties outside the EEA rely on Standard Contractual Clauses under GDPR Art. 46.</p>
  </section>

  <section>
    <h2><span class="num">6</span>Encryption</h2>
    <h3>In transit</h3>
    <ul>
      <li>TLS 1.3 on all public endpoints (managed by Vercel).</li>
      <li>Internal calls to the Biody-sync edge function require <strong>both</strong> a service-role bearer token (Supabase gateway JWT check) <strong>and</strong> an HMAC signature (<code>X-Lifeline-Signature</code>). Defence in depth: a leaked service-role key alone cannot forge a call.</li>
    </ul>
    <h3>At rest</h3>
    <ul>
      <li>Supabase storage layer encrypted by default (AES-256, AWS KMS).</li>
      <li><strong>Column-level encryption</strong> on top for Art. 9 and PII data: <code>messages.content</code> and <code>clients.phone / address / date_of_birth / emergency_contact_* / kennitala_last4</code>, using pgcrypto <code>pgp_sym_encrypt</code> (AES-256) with the key held in Supabase Vault. Only SECURITY DEFINER helper functions can retrieve the key. Plaintext columns were dropped on 2026-05-03; only encrypted BYTEA columns remain.</li>
      <li>Signed PDF documents (staff, client-consent, legal-signoff, platform, company) live in private Supabase Storage buckets, each with dedicated RLS policies.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">7</span>Access controls</h2>
    <h3>Authentication</h3>
    <ul>
      <li>Supabase Auth: bcrypt-hashed passwords; password double-entry on every flow that sets a password (B2C/B2B signup, password change, invite claims).</li>
      <li>Email confirmation runs on Lifeline's own domain via <code>token_hash + verifyOtp</code> — raw Supabase action links are never emailed (no live sign-in links in third-party mailboxes).</li>
      <li><strong>Staff: mandatory TOTP two-factor (AAL2)</strong> before any admin access. Exception: external lawyers (role <code>lawyer</code>) who only reach <code>/admin/legal/*</code> (no patient data); their signatures are evidenced by authenticated session, IP logging, SHA-256 of the document text and a stored PDF certificate.</li>
    </ul>
    <h3>Role-based access (RBAC) and specialty separation</h3>
    <ul>
      <li>Roles: <code>coach</code>, <code>doctor</code>, <code>nurse</code>, <code>psychologist</code>, <code>admin</code>, <code>lawyer</code>, <code>medical_advisor</code> — each with its own Row Level Security policies in PostgreSQL.</li>
      <li>Clinicians see clinical communications; coaches see the coaching surface; admin has operational superuser rights.</li>
      <li><strong>Lawyer:</strong> legal drafts and signoff system only. <strong>Medical advisor:</strong> read-only across the admin (MFA required); all writes blocked in both RLS and API gates.</li>
    </ul>
    <h3>Pre-launch site access gate</h3>
    <ul>
      <li>The marketing site is closed until launch. Access via an admin-managed ACL: per-user/company/group grants with optional expiry, ad-hoc cohort groups, and shareable invite tokens stored <strong>only as SHA-256 hashes</strong>. Validation runs in SECURITY DEFINER functions. The previous hardcoded preview key was fully removed on 2026-06-02.</li>
    </ul>
    <div class="callout-warn callout">
      <h4>Stated plainly</h4>
      <p style="margin:0">The pre-launch gate protects marketing content — it is <strong>not</strong> a security boundary for personal data. All data remains protected by authentication, RLS and API gates regardless of it.</p>
    </div>
    <h3>Quarterly access review</h3>
    <ul>
      <li>Every active staff member is reviewed every 90 days; automatic overdue reminders; each decision recorded with before/after role and permissions.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">8</span>Audit logging &amp; error logging</h2>
    <ul>
      <li><strong>health_audit_log:</strong> append-only entries for every INSERT/UPDATE/DELETE on clients, messages, weight logs and body-composition events, written by automatic Postgres triggers (cannot be bypassed by application code). Records actor identity, role, action, table, row and timestamp. Retention: 6 years per Act 55/2009 §13. Admin-only read.</li>
      <li><strong>Error logging is fully in-house</strong> (no third-party service; Sentry removed 2026-06): frontend and backend errors are written directly to <code>app_errors</code> in Supabase (EEA). Kennitala values and email addresses are regex-scrubbed before storage on <strong>both</strong> paths; cookies, headers and request bodies are never captured. Triage in <code>/admin/errors</code> + a daily email digest.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">9</span>Data subject rights</h2>
    <p>Clients hold the full set of GDPR rights (access, rectification, erasure — limited for medical records, restriction, objection, portability, consent withdrawal).</p>
    <ul>
      <li>Requests are submitted in plain language via the account area ("Make a privacy request"), stored in <code>dsr_requests</code>, and emailed to the DPO with an action checklist and the 30-day deadline (Art. 12(3)).</li>
      <li>Admin manages the workflow with status transitions; a documented runbook holds the procedure and SQL for every request type.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">10</span>Processors &amp; joint controllers</h2>
    <table>
      <tr><th>Party</th><th>Relationship</th><th>Status</th></tr>
      <tr><td>Medalia ehf.</td><td>Joint controller (Art. 26)</td><td>DPA signed; joint-controller arrangement drafted, under counsel review</td></tr>
      <tr><td>Aminogram SAS (Biody)</td><td>Processor (Art. 28)</td><td>Processing agreement pending signature</td></tr>
      <tr><td>Supabase Inc.</td><td>Processor (Art. 28)</td><td>DPA accepted via terms of service</td></tr>
      <tr><td>Vercel Inc.</td><td>Processor (Art. 28)</td><td>DPA accepted via terms of service</td></tr>
      <tr><td>Resend (Lilo Labs)</td><td>Processor (Art. 28)</td><td>DPA accepted via terms of service</td></tr>
    </table>
  </section>

  <section>
    <h2><span class="num">11</span>Breach response</h2>
    <ul>
      <li>72-hour notification duty to Persónuvernd (Art. 33); client notification per Art. 34 where required.</li>
      <li>All staff are contractually bound (signed at onboarding) to report suspected incidents immediately to the DPO, who assesses severity and notification duty.</li>
      <li>Incidents are recorded in the audit log plus a dedicated incident report where applicable; the in-house error-logging system provides the technical view.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">12</span>DPIA</h2>
    <p>DPIA-lite for the wellness-mode interim architecture (until the Medalia API), signed by the DPO and stored in the legal archive. Review cadence: annually or on any major data-flow change. Next review: 2027-05-04.</p>
  </section>

  <section>
    <h2><span class="num">13</span>Staff training &amp; contracts</h2>
    <ul>
      <li>Before access: every staff member e-signs (Act 28/2001) an NDA, a device &amp; access policy, privacy training, and an onboarding checklist. Clinical staff additionally sign a confidentiality declaration under Act 34/2012. External lawyers sign NDA + privacy training only.</li>
      <li>Every signature is preserved with a SHA-256 hash of the contract text, signer IP and browser fingerprint, timestamp, and a fully traceable PDF in a private bucket.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">14</span>Client consent</h2>
    <ul>
      <li>Granular, per-purpose consent stored with key, version, text hash, grant/revoke timestamps, IP and user agent; a PDF certificate is generated and emailed; revocable at any time.</li>
      <li>Key consents: health-assessment consent (required for all assessments) and <code>biody-import-v1</code> (on-demand fetch of body-composition data, never stored).</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">15</span>Cookies &amp; analytics</h2>
    <p>Only strictly necessary cookies (the Supabase Auth session token). No advertising cookies, no cross-site tracking. Any future analytics: anonymised aggregate only.</p>
  </section>

  <section>
    <h2><span class="num">16</span>Architecture — wellness vs. medical record</h2>
    <div class="callout">
      <h4>Core point for a DPA audit</h4>
      <p style="margin:0">The Lifeline app is a <strong>wellness dashboard, not a medical record</strong>. Users see their own self-tracking, bookings, plans and coach messages — never clinical assessments or doctors' letters. A prominent in-app notice states: "This is your self-tracking dashboard — not your medical record."</p>
    </div>
    <ul>
      <li>The medical record lives in Medalia (Act 55/2009), with access control and audit logging per §14 of that act.</li>
      <li>Body composition is fetched on demand from Biody after explicit consent; no persistent copies in Lifeline since 2026-05-03 — the same pattern intended for the Medalia API.</li>
      <li><strong>Planned (in progress, not yet live):</strong> a direct Medalia ↔ Biody API integration. Once operational, measurements flow straight into the EHR and the Biody connection on the Lifeline admin side is retired — further shrinking health-data flow through the Lifeline layer. The app's on-demand, consented fetch remains. No system change has been made yet.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">17</span>Evidence map — where the auditor finds what</h2>
    <table>
      <tr><th>What</th><th>Table / storage</th></tr>
      <tr><td>DPIA</td><td><code>company_documents</code> (kind='dpia')</td></tr>
      <tr><td>Joint controller + DPAs (Medalia, Biody)</td><td><code>company_documents</code> (kind='joint_controller' / 'dpa')</td></tr>
      <tr><td>B2B service agreements</td><td><code>b2b_agreements</code> + <code>b2b_purchase_orders</code></td></tr>
      <tr><td>Staff signed agreements</td><td><code>staff_agreement_acceptances</code> + private PDF bucket</td></tr>
      <tr><td>Client consents</td><td><code>client_consents</code> + private PDF bucket</td></tr>
      <tr><td>Lawyer signoffs</td><td><code>legal_review_signoffs</code> + private PDF bucket</td></tr>
      <tr><td>Health-data audit trail</td><td><code>health_audit_log</code></td></tr>
      <tr><td>Access reviews</td><td><code>staff_access_reviews</code></td></tr>
      <tr><td>Data subject requests</td><td><code>dsr_requests</code></td></tr>
      <tr><td>Pre-launch access grants</td><td><code>access_grants</code> + <code>access_invite_tokens</code> (SHA-256)</td></tr>
      <tr><td>Privacy incidents</td><td><code>health_audit_log</code> + <code>app_errors</code> (/admin/errors)</td></tr>
    </table>
  </section>

  <section>
    <h2><span class="num">18</span>Technical and organisational measures — summary</h2>
    <h3>Technical</h3>
    <ul class="check">
      <li>Column-level encryption of Art. 9 and PII data (pgcrypto + Vault)</li>
      <li>Row Level Security on every table holding personal data</li>
      <li>MFA (TOTP / AAL2) mandatory for all staff with patient-data access</li>
      <li>TLS 1.3 on all public endpoints</li>
      <li>HMAC signing of internal service calls (with service-role bearer — neither suffices alone)</li>
      <li>Email confirmation via verifyOtp on our own domain (no raw action links)</li>
      <li>Password double-entry in every password-setting flow</li>
      <li>Admin-managed pre-launch access list (tokens stored only as SHA-256 hashes)</li>
      <li>PII scrubbing in in-house error logging — no error data leaves for third parties</li>
      <li>Audit log via Postgres triggers (traceability per Act 55/2009)</li>
      <li>Daily encrypted backups (Supabase pg_dump → Storage)</li>
      <li>Automatic error logging and incident management</li>
    </ul>
    <h3>Organisational</h3>
    <ul class="check">
      <li>Written agreements with all processors (Art. 28)</li>
      <li>Joint controller (Medalia) with a written arrangement</li>
      <li>Mandatory privacy training for all staff</li>
      <li>Clinical confidentiality declaration for health professionals</li>
      <li>Onboarding checklist with day-to-day rules + incident reporting</li>
      <li>Periodic (90-day) staff access reviews</li>
      <li>Lawful kennitala handling (only last 4 digits stored)</li>
      <li>DPIA for high-risk processing, signed by the DPO</li>
      <li>DSR process with SLA and a documented runbook</li>
      <li>Legal counsel reviews legal drafts before signature</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">19</span>Changelog</h2>
    <table>
      <tr><th>Version</th><th>Date</th><th>Change</th></tr>
      <tr><td>v1.7</td><td>2026-06-10</td><td>Planned Medalia ↔ Biody API integration documented (plan only; admin-side Biody connection to be retired, app-side on-demand fetch stays).</td></tr>
      <tr><td>v1.6</td><td>2026-06-10</td><td>Sentry fully removed; in-house error logging documented (one fewer subprocessor); PII scrubbing confirmed on both paths; DPO title corrected to CTO.</td></tr>
      <tr><td>v1.5</td><td>2026-06-10</td><td>English companion rendering added; role list corrected to include medical_advisor.</td></tr>
      <tr><td>v1.4</td><td>2026-06-10</td><td>Pre-launch access ACL replaces hardcoded preview key; auth-flow hardening (password double-entry, own-domain verifyOtp); Biody-sync dual auth confirmed; B2B login email decoupled from HR email.</td></tr>
      <tr><td>v1.3</td><td>2026-05-16</td><td>Post-assessment feedback survey: lawful basis, encryption, 3-year retention with purge function, DSR runbook coverage.</td></tr>
      <tr><td>v1.2</td><td>2026-05-04</td><td>External lawyer exempted from AAL2 (legal archive only); signature evidence via session, IP, SHA-256 and PDF certificate.</td></tr>
      <tr><td>v1.1</td><td>2026-05-04</td><td>Registered address updated across all legal documents.</td></tr>
      <tr><td>v1.0</td><td>2026-05-04</td><td>Initial release after external audit + remediation sprints: RLS hardening, audit log, DSR workflow, consent system, column encryption, MFA enforcement, quarterly access review.</td></tr>
    </table>
  </section>

  <div class="footer">
    Lifeline Health ehf. · Security &amp; Privacy Posture Statement v1.7 · 10 June 2026 ·
    English convenience translation — the Icelandic original (maintained in the Lifeline admin, /admin/legal/posture) prevails in case of discrepancy.
  </div>

</div>
</body>
</html>
`;

export const TECHNICAL_BRIEF_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Lifeline Health · Technical Security Brief v1.2</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<style>
  :root {
    --ink: #111827;
    --ink-2: #374151;
    --ink-3: #6B7280;
    --ink-4: #9CA3AF;
    --rule: #E5E7EB;
    --rule-soft: #F3F4F6;
    --accent: #10B981;
    --accent-bg: #ECFDF5;
    --warn-bg: #FFF7ED;
    --warn-ink: #92400E;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: var(--ink);
    background: #fff;
    line-height: 1.55;
    font-size: 14px;
  }
  .page { max-width: 820px; margin: 0 auto; padding: 56px 48px 80px 48px; }

  .title-block { border-bottom: 2px solid var(--accent); padding-bottom: 18px; margin-bottom: 28px; }
  .title-kicker {
    text-transform: uppercase; letter-spacing: 0.12em;
    font-size: 11px; font-weight: 700;
    color: var(--accent);
  }
  .title-block h1 {
    margin: 6px 0 4px 0;
    font-size: 28px; line-height: 1.18; letter-spacing: -0.012em;
    color: var(--ink);
  }
  .title-block .subtitle { color: var(--ink-2); font-size: 14px; margin-bottom: 4px; }
  .title-block .meta {
    font-size: 11px; color: var(--ink-3);
    margin-top: 12px; display: flex; gap: 22px; flex-wrap: wrap;
  }
  .title-block .meta strong { color: var(--ink-2); font-weight: 600; }

  h2 {
    font-size: 17px; margin: 32px 0 8px 0; padding-top: 12px;
    border-top: 1px solid var(--rule);
    color: var(--ink); letter-spacing: -0.005em;
  }
  h2 .num { color: var(--accent); margin-right: 8px; font-weight: 700; }
  h3 { font-size: 14px; margin: 18px 0 6px 0; color: var(--ink-2); }
  h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3); margin: 14px 0 4px 0; }

  p { margin: 8px 0; }
  ul, ol { margin: 8px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  strong { color: var(--ink); }

  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--rule-soft); padding: 1px 5px; border-radius: 3px; font-size: 12px; }

  table {
    width: 100%; border-collapse: collapse;
    margin: 10px 0 16px 0; font-size: 12.5px;
  }
  th, td { border-bottom: 1px solid var(--rule); padding: 7px 8px; text-align: left; vertical-align: top; }
  th {
    background: var(--rule-soft);
    font-weight: 600; color: var(--ink-2);
    border-bottom: 1px solid var(--rule); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  tr:last-child td { border-bottom: none; }

  .callout {
    border-left: 3px solid var(--accent);
    background: var(--accent-bg);
    padding: 10px 14px;
    margin: 12px 0;
    border-radius: 0 4px 4px 0;
  }
  .callout h4 { margin-top: 0; color: var(--accent); }
  .callout-warn { border-left-color: #F59E0B; background: var(--warn-bg); }
  .callout-warn h4 { color: var(--warn-ink); }

  .badge {
    display: inline-block; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.05em;
    padding: 1px 7px; border-radius: 999px;
  }
  .badge-med { background: var(--warn-bg); color: var(--warn-ink); }
  .badge-low { background: var(--rule-soft); color: var(--ink-3); }

  .small { font-size: 12px; color: var(--ink-3); }

  @media print {
    body { font-size: 11.5px; }
    .page { padding: 16mm 18mm 18mm 18mm; max-width: none; }
    h2 { page-break-after: avoid; }
    table, tr, td, th { page-break-inside: avoid; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    a { color: var(--ink); text-decoration: none; }
  }

  .toolbar {
    position: fixed; top: 16px; right: 16px;
    background: var(--ink); color: #fff;
    padding: 8px 14px; border-radius: 999px;
    font-size: 12px; font-weight: 600;
    border: none; cursor: pointer;
    box-shadow: 0 6px 14px rgba(0,0,0,0.12);
  }
  .toolbar:hover { background: #000; }

  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid var(--rule); font-size: 11px; color: var(--ink-4); }
</style>
</head>
<body>
<button class="toolbar no-print" onclick="window.print()">Print / Export PDF</button>
<div class="page">

  <header class="title-block">
    <div class="title-kicker">Lifeline Health · Security Engineering</div>
    <h1>Technical Security Brief</h1>
    <div class="subtitle">Engineering-level companion to the Security &amp; Privacy Posture Statement, written for technical security reviewers — including an explicit gap register</div>
    <div class="meta">
      <span><strong>Version:</strong> v1.2</span>
      <span><strong>Last updated:</strong> 10 June 2026</span>
      <span><strong>Owner:</strong> Mads Christian Aanesen, CTO</span>
      <span><strong>Distribution:</strong> External security review</span>
    </div>
  </header>

  <section>
    <div class="callout">
      <h4>How to read this document</h4>
      <p style="margin:0">Every claim here is verifiable in the codebase or infrastructure. Where something is missing, it is listed in the gap register (§11) rather than papered over — we would rather name a gap ourselves than have it discovered.</p>
    </div>
  </section>

  <section>
    <h2><span class="num">1</span>System architecture &amp; trust boundaries</h2>
    <h3>Components</h3>
    <ul>
      <li><strong>Next.js application</strong> (Vercel, Fluid Compute / Node) — marketing site, client account area, staff admin app, and all API routes from one codebase.</li>
      <li><strong>Supabase</strong> (Postgres + Auth + Storage, Germany/EEA) — single system of record for operational (non-EHR) data.</li>
      <li><strong>React Native client app</strong> (separate repo) — talks to the same Supabase project and the website's API routes.</li>
      <li><strong>Medalia</strong> (licensed Icelandic EHR) — formal medical records. No API integration yet; data exchange is manual by licensed clinicians.</li>
      <li><strong>Biody Manager</strong> (France) — raw body-composition data, fetched on demand via a Supabase Edge Function; results are not persisted in Lifeline's database.</li>
    </ul>
    <div class="callout">
      <h4>Planned — in progress, not yet live</h4>
      <p style="margin:0">A direct <strong>Medalia ↔ Biody API integration</strong> is being processed. Once operational, the Lifeline-admin-side Biody connection will be retired and measurements will flow straight into the EHR; the client app's on-demand, user-consented Biody fetch remains. Net effect: one fewer health-data path through the Lifeline layer. No code has shipped for this yet.</p>
    </div>
    <h3>Trust boundaries</h3>
    <ul>
      <li><strong>Browser/app → API:</strong> Supabase JWT in the Authorization header; every API route re-derives the user server-side — no client-asserted identity.</li>
      <li><strong>API → database:</strong> two distinct clients. The anon client is subject to RLS; the service-role client bypasses RLS and exists only in server code. A hard convention forbids importing it (or its env var) into any client-side file.</li>
      <li><strong>Website → Biody edge function:</strong> requires <strong>both</strong> the service-role bearer (platform JWT gate) and an HMAC signature over the request — a leaked service-role key alone cannot forge a call.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">2</span>Authentication &amp; session management</h2>
    <ul>
      <li>Supabase Auth (GoTrue): bcrypt-hashed passwords, short-lived JWT access tokens (~1 h) with rotating refresh tokens; sign-out revokes the refresh token.</li>
      <li><strong>Staff MFA:</strong> TOTP enrolment is mandatory; the admin app refuses access until the session is stepped up to AAL2. Server-side, <strong>every admin mutation endpoint independently re-verifies AAL2</strong> — the check is not UI-only. Exception: the external-counsel role, which only reaches the legal archive (no patient data).</li>
      <li><strong>Password flows:</strong> double-entry confirmation everywhere a password is set; email confirmation on our own domain via <code>token_hash + verifyOtp</code> — raw Supabase action links are never emailed.</li>
      <li><strong>Brute force:</strong> Supabase platform rate limits on auth endpoints; our own sensitive token endpoints add per-IP database-backed limits (e.g. B2B invite verification: 20 attempts/hour/IP) on top of per-invite lockout, with expired/used tokens short-circuited before verification to prevent enumeration and timing leaks.</li>
      <li><strong>Offboarding:</strong> deactivating the staff row revokes access centrally — RLS policies and API gates check is-active status on every request, so a deactivated account loses admin access on its next request even with a live token.</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">3</span>Authorization model</h2>
    <ul>
      <li>Postgres Row Level Security on every table holding personal data; API-mediated tables carry an explicit deny-all policy (<code>FOR ALL USING (false)</code>) so the only path is the server API.</li>
      <li>Staff checks inside policies go through SECURITY DEFINER helper functions (<code>is_active_staff()</code>, <code>is_admin_staff()</code>) — never inline subqueries against the staff table (avoids recursive-policy bugs; one audited implementation).</li>
      <li>API-layer gates are role-aware: reads accept any active staff; writes require admin-write roles <em>and</em> AAL2. Read-only roles (external lawyer, medical advisor) are blocked from writes at <strong>both</strong> layers — defence in depth, not a single chokepoint.</li>
      <li>Client-facing data access goes through the anon client under RLS; clients only see their own rows (<code>auth.uid()</code> scoping).</li>
    </ul>
  </section>

  <section>
    <h2><span class="num">4</span>Secrets &amp; key management</h2>
    <ul>
      <li>Application secrets (service-role key, HMAC secret, AI provider keys, SMTP) live in Vercel environment variables — encrypted at rest, scoped per environment, never committed. <code>.env.local</code> is gitignored; no secrets in the repository.</li>
      <li>The column-encryption key lives in <strong>Supabase Vault</strong>; only SECURITY DEFINER functions can read it. It is not an application env var, so an application-layer compromise does not directly expose it.</li>
      <li>GitHub Actions secrets (DB connection string for backups) are repository secrets with least scope.</li>
    </ul>
    <div class="callout-warn callout">
      <h4>Known gap — rotation</h4>
      <p style="margin:0">No scheduled rotation policy; keys are rotated reactively. Planned: documented rotation runbook + calendar for the service-role key, HMAC secret and Vault key (the pgcrypto design supports re-encryption migration).</p>
    </div>
  </section>

  <section>
    <h2><span class="num">5</span>Rate limiting &amp; abuse protection</h2>
    <ul>
      <li><strong>Platform:</strong> Vercel DDoS mitigation and TLS termination; Supabase limits on auth endpoints.</li>
      <li><strong>Application (selective, where it matters):</strong> B2B invite verification 20/hour/IP (DB-backed) + lockout; per-user daily quotas on AI document parsing (staff exempt); per-user throttle on error ingestion to stop log flooding.</li>
      <li>No anonymous compute-expensive endpoints — public AI endpoints require an authenticated user.</li>
    </ul>
    <div class="callout-warn callout">
      <h4>Known gap</h4>
      <p style="margin:0">No global WAF rules beyond platform defaults; rate limits are per-endpoint by design. Accepted at current traffic; revisit at public launch.</p>
    </div>
  </section>

  <section>
    <h2><span class="num">6</span>Backups &amp; disaster recovery</h2>
    <ul>
      <li>Supabase managed daily snapshots, 7-day rolling window, restorable from the dashboard.</li>
      <li><strong>Independent nightly logical backup</strong> (GitHub Actions, 03:00 UTC): <code>pg_dump</code> of the full public schema + data into a private storage bucket, 14-day retention, manual trigger for pre-migration snapshots — deliberately a second, portable copy outside the managed snapshot system.</li>
      <li>Storage buckets (signed PDFs etc.) are private with per-bucket RLS; covered by provider redundancy.</li>
    </ul>
    <div class="callout-warn callout">
      <h4>Known gap — restore drills</h4>
      <p style="margin:0">A full timed restore from the nightly dump into a clean project has not yet been performed as a documented drill. RPO is ~24 h worst case; RTO is untested. Planned before public launch.</p>
    </div>
  </section>

  <section>
    <h2><span class="num">7</span>Vulnerability &amp; dependency management</h2>
    <ul>
      <li>April 2026: an external code-level security audit was performed; findings were remediated across three sprints (RLS hardening, audit logging, consent system, column encryption, MFA enforcement, DSR workflow) — captured as posture v1.0.</li>
      <li>TypeScript strict mode + ESLint in development; framework and dependencies kept on current major versions.</li>
    </ul>
    <div class="callout-warn callout">
      <h4>Known gaps</h4>
      <p style="margin:0">No automated SCA/dependency scanning in CI (updates are manual — cheap to fix, planned). No formal third-party penetration test yet; planned once the public launch surface is final. The April audit was code-review based, not adversarial.</p>
    </div>
  </section>

  <section>
    <h2><span class="num">8</span>Logging, monitoring &amp; detection</h2>
    <ul>
      <li><strong>Immutable health-data audit log</strong> (Postgres triggers, admin-only read, 6-year retention) records every INSERT/UPDATE/DELETE on clients, messages, weight logs and body-composition events with actor identity and role.</li>
      <li><strong>Error telemetry is fully in-house</strong> (Sentry removed 2026-06; no third-party error service):
        <ul>
          <li>Server: <code>captureException</code>/<code>captureMessage</code> helpers write directly to <code>app_errors</code>; a <code>withErrorReporting</code> wrapper captures unhandled API-route throws; the Next.js instrumentation <code>onRequestError</code> hook captures uncaught request errors.</li>
          <li>Browser: a global error handler posts to a rate-limited ingestion endpoint.</li>
          <li>PII redaction (kennitala + email regex) runs before storage on <strong>both</strong> paths; cookies, headers and request bodies are never captured. Error data never leaves the EEA database — one fewer subprocessor than a hosted APM.</li>
          <li>Trade-off, stated plainly: error reporting now shares fate with the primary database (a hosted APM was independent infrastructure). Vercel runtime logs remain an independent secondary signal.</li>
        </ul>
      </li>
      <li>Triage UI in the admin; daily error-digest email; weekly cron chases overdue access reviews.</li>
    </ul>
    <div class="callout-warn callout">
      <h4>Known gap — detection is human-in-the-loop</h4>
      <p style="margin:0">Audit log is query-on-demand; error notification latency is up to 24 h (daily digest, no real-time paging); no automated anomaly detection on access patterns. Accepted at current team size (every staff member personally known); revisit as the team grows.</p>
    </div>
  </section>

  <section>
    <h2><span class="num">9</span>Environments, CI/CD &amp; change management</h2>
    <ul>
      <li>GitHub → Vercel: <code>main</code> auto-deploys to production; feature branches get isolated preview URLs; TLS managed by the platform.</li>
      <li>Database migrations are plain, idempotent SQL files in the repo, applied manually in the Supabase SQL editor — a deliberate human gate on every schema change, with pre-migration snapshots on demand.</li>
    </ul>
    <div class="callout-warn callout">
      <h4>Known gaps</h4>
      <p style="margin:0">Single production Supabase project — no separate staging database (preview deployments exercise production data paths; mitigated by the manual migration gate). Single-maintainer repository — no enforced branch protection / second reviewer yet; will be enabled when the engineering team grows beyond one.</p>
    </div>
  </section>

  <section>
    <h2><span class="num">10</span>Endpoint &amp; device security</h2>
    <ul>
      <li>Staff sign a device &amp; access policy at onboarding (screen lock, no shared devices, no exfiltration to personal storage); admin access additionally requires TOTP MFA, limiting the blast radius of a stolen password.</li>
      <li>No MDM deployed — contractual + MFA controls only. Accepted at current team size; revisit when clinical staffing scales.</li>
    </ul>
  </section>

  <section class="page-break">
    <h2><span class="num">11</span>Gap register — summary &amp; priority</h2>
    <table>
      <tr><th>#</th><th>Gap</th><th>Risk</th><th>Plan</th></tr>
      <tr><td>1</td><td>No scheduled secret/key rotation</td><td><span class="badge badge-med">Medium</span></td><td>Rotation runbook + calendar</td></tr>
      <tr><td>2</td><td>Restore drill never executed</td><td><span class="badge badge-med">Medium</span></td><td>Timed drill pre-launch</td></tr>
      <tr><td>3</td><td>No automated dependency scanning</td><td><span class="badge badge-med">Medium</span></td><td>Enable Dependabot alerts + PRs</td></tr>
      <tr><td>4</td><td>No formal penetration test</td><td><span class="badge badge-med">Medium</span></td><td>Commission once launch surface is final</td></tr>
      <tr><td>5</td><td>No staging database</td><td><span class="badge badge-med">Medium</span></td><td>Second Supabase project</td></tr>
      <tr><td>6</td><td>No real-time alerting (daily digest) nor access-anomaly detection</td><td><span class="badge badge-low">Low*</span></td><td>Scheduled audit-log reports + paging on fatal errors</td></tr>
      <tr><td>7</td><td>No branch protection (single dev)</td><td><span class="badge badge-low">Low*</span></td><td>Enable with second engineer</td></tr>
      <tr><td>8</td><td>No MDM</td><td><span class="badge badge-low">Low*</span></td><td>Revisit at clinical scale</td></tr>
    </table>
    <p class="small">*Low at current scale (single-digit, personally-known staff; closed pre-launch user base). These re-rate to Medium at public launch.</p>
  </section>

  <section>
    <h2><span class="num">12</span>Changelog</h2>
    <table>
      <tr><th>Version</th><th>Date</th><th>Change</th></tr>
      <tr><td>v1.2</td><td>2026-06-10</td><td>Planned Medalia ↔ Biody API integration documented (plan only — no code shipped; admin-side Biody connection to be retired, app-side fetch stays).</td></tr>
      <tr><td>v1.1</td><td>2026-06-10</td><td>Error telemetry rewritten: Sentry fully removed; in-house pipeline documented incl. shared-fate trade-off and up-to-24h notification latency; server-side reporter hardened with kennitala/email redaction; gap #6 broadened.</td></tr>
      <tr><td>v1.0</td><td>2026-06-10</td><td>Initial release for external technical security review: architecture/trust boundaries, authn/z, secrets, rate limiting, backups/DR, vulnerability management, monitoring, CI/CD, device posture, 8-item gap register.</td></tr>
    </table>
  </section>

  <div class="footer">
    Lifeline Health ehf. · Technical Security Brief v1.2 · 10 June 2026 ·
    Companion to the Security &amp; Privacy Posture Statement v1.7 — both maintained in the Lifeline admin (/admin/legal/posture).
  </div>

</div>
</body>
</html>
`;
