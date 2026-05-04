// Plain-text mirrors of the public /privacy and /terms pages.
//
// Why this file exists separately from src/app/privacy/page.tsx and
// src/app/terms/page.tsx:
// - The public pages are styled JSX (headings, lists, tables, links)
//   which is great for end users but unreadable when the lawyer wants
//   to review the literal contractual text.
// - The lawyer reviews documents on /admin/legal/drafts which lists
//   plain-text versions of every legal document. We want privacy + tos
//   to appear there in the same readable form as every other doc.
//
// MAINTENANCE: edit BOTH this file and the corresponding JSX page when
// content changes, then bump the version + last-updated below. The
// public JSX page is what users see; this renderer is what the lawyer
// reviews. They must stay in sync.

export const PUBLIC_PRIVACY_VERSION = "v1.4";
export const PUBLIC_PRIVACY_LAST_UPDATED = "2026-04-29";
export const PUBLIC_TERMS_VERSION = "v1.2";
export const PUBLIC_TERMS_LAST_UPDATED = "2026-04-17";

export function renderPublicPrivacyPolicy(): string {
  return `LIFELINE HEALTH — PRIVACY POLICY
Version ${PUBLIC_PRIVACY_VERSION}  ·  Last updated ${PUBLIC_PRIVACY_LAST_UPDATED}

This policy explains what personal data Lifeline Health ehf. ("Lifeline",
"we", "our") collects about you, why we collect it, how we use it, who
we share it with, how long we keep it, and the rights you have over it.
It sits alongside our Terms of Service — if anything here conflicts,
this document wins for privacy matters.

1. WHO CONTROLS YOUR DATA
Lifeline Health ehf., an Icelandic company (Reykjavík), is the data
controller for your personal data. For questions or requests, email
contact@lifelinehealth.is.

2. CATEGORIES OF DATA WE COLLECT
- Identity & contact: name, kennitala, email, phone number, address.
- Account: password (stored as a salted hash, never in plain text),
  login history, device + IP at session level.
- Health profile: date of birth, sex, height, weight, activity level,
  health goals, medical history you choose to share.
- Measurements: body-composition results (fat %, muscle mass, phase
  angle, BMR, body water, etc.) from our measurement partner Biody.
- Usage: meals logged, weigh-ins, program progress, app interactions,
  messages exchanged with Lifeline coaches.
- Business onboarding (B2B only): the company you belong to and
  onboarding completion status.

3. HOW WE COLLECT IT
- Directly from you when you register, complete assessments, or use
  the app.
- From your employer (B2B only) who provides your name, kennitala,
  email and phone before inviting you — you then complete the rest
  yourself.
- From Biody Manager when you attend a body-composition scan at one
  of our partner clinics.
- Automatically via the app (e.g. your phone's timezone, device type
  for support).

4. WHY WE USE IT (LEGAL BASIS)
- Performance of a contract (GDPR Art. 6(1)(b)). Providing the service
  you signed up for — assessments, reports, coaching, body composition
  tracking.
- Explicit consent for special-category data (Art. 9(2)(a)). Health
  data is only processed once you have agreed to our terms during
  onboarding.
- Legitimate interests (Art. 6(1)(f)). Fraud prevention, debugging
  errors, and secure operation of our platform.
- Consent (Art. 6(1)(a)). Marketing emails and use of anonymised data
  for research — both opt-in; you can withdraw consent at any time.
- Legal obligation (Art. 6(1)(c)). Where Icelandic health law, tax law,
  or court orders require retention or disclosure.

5. HOW WE STORE YOUR KENNITALA
Kennitala is considered sensitive personal data under Icelandic law.
We follow the principle of data minimisation: only the last four digits
are stored in our database, and only for the limited purposes of
identifying employee rosters in B2B onboarding and matching duplicates.
We do not store, decrypt, or transmit your full kennitala — neither to
staff nor to any third party. If a future regulatory or clinical process
requires it, that process will live inside Medalia (the licensed
sjúkraskrár-system) where access is logged under Icelandic law nr.
55/2009 §14, not in this app.

6. WHO WE SHARE YOUR DATA WITH
  Recipient                       | Purpose                                                                                                   | Location
  Medalia ehf.                     | Licensed health record system (sjúkraskrá) per Lög 55/2009 — joint controller with Lifeline (GDPR Art. 26) | Iceland
  Supabase Inc.                    | Database, authentication, operational data                                                                 | EU (Frankfurt)
  Vercel Inc.                      | Web hosting, delivery                                                                                      | EU + US (with SCCs)
  Resend (Lilo Labs Inc.)          | Transactional email delivery                                                                               | EU + US (with SCCs)
  Biody Manager (Aminogram SAS)    | Body-composition measurement partner                                                                       | EU (France)
  Your employer (B2B only)         | Onboarding completion status — no health data                                                              | Iceland
  Icelandic authorities            | Where legally required (court order, health law)                                                           | Iceland

We never sell personal data. All processors are bound by GDPR-compliant
data processing agreements. Transfers outside the EEA rely on EU
Standard Contractual Clauses.

6a. WHERE YOUR HEALTH RECORD LIVES
Lifeline operates as a licensed healthcare service (heilbrigðisþjónusta)
under Icelandic law nr. 40/2007. Your formal medical record (sjúkraskrá)
— including clinical interpretations, blood-test results, doctor's
notes, and finalised health-assessment outcomes — is held in Medalia
ehf., a sjúkraskrár-system licensed under Icelandic law nr. 55/2009.
Lifeline and Medalia act as joint controllers for that record under
GDPR Art. 26.

The Lifeline app and admin console are operational tools (scheduling,
programs, coaching, self-tracking) — not your medical record. Body-
composition values from Biody scans are entered into Medalia by a
clinician as part of your assessment; a copy is also shown in your
Lifeline dashboard for your own self-tracking, with your explicit
consent and only visible to you.

7. WHAT WE SHARE WITH BIODY MANAGER
To register you as a patient on the measurement device, we send Biody
your name, email, date of birth (derived from your kennitala), sex,
height, and activity level. We do NOT send your kennitala or your
Lifeline account password. Biody stores the measurement data and
returns it to us; we link it to your Lifeline account.

8. RETENTION
- Active accounts: we keep your data for as long as you use Lifeline.
- Account deletion: personally identifying information is deleted
  within 30 days of your request, except where retention is required
  by Icelandic law.
- Inactive B2B invitations: unused invitations are deleted after 12
  months.
- Audit logs: kept for 24 months for security and regulatory purposes.
- Anonymised aggregates: may be kept indefinitely as they no longer
  identify you.

9. SECURITY MEASURES
- TLS encryption in transit; database hosted on Supabase with at-rest
  encryption at the storage layer.
- Role-based access control via Row-Level Security; specialty-based
  separation between coaches, clinicians, and admins.
- Audit logging on every write to health-sensitive tables (clients,
  messages, weight log, body composition events).
- Quarterly staff access review — every team member's permissions are
  revisited every 90 days.
- Service-role credentials stored in a secrets manager, never in
  source code.
- MFA (TOTP, AAL2) required for every Lifeline staff session before
  admin access is granted.
- Sentry redaction strips request bodies on health-related routes so
  error monitoring cannot leak Art. 9 data.

No system is perfectly secure. If you believe your account has been
compromised, contact contact@lifelinehealth.is.

10. YOUR RIGHTS
Under the Icelandic Data Protection Act and the EU GDPR you have the
right to:
- Access the personal data we hold about you.
- Correct anything that is wrong.
- Delete your data (the "right to be forgotten"), subject to legal
  retention.
- Restrict or object to certain processing.
- Portability — receive your data in a structured, machine-readable
  format.
- Withdraw consent at any time for marketing or research use.
- Lodge a complaint with the Icelandic Data Protection Authority
  (Persónuvernd) at www.personuvernd.is.

To exercise any of these rights, email contact@lifelinehealth.is (our
data protection inbox) or submit a request from your account settings
under Data & privacy. We respond within 30 days per GDPR Art. 12.
Health record requests that need data held in Medalia are coordinated
with our joint-controller per the Art. 26 arrangement.

11. COOKIES & ANALYTICS
We use strictly necessary cookies to keep you signed in. We do not use
advertising cookies. Any analytics we run is privacy-preserving and
aggregate (no cross-site tracking).

12. CHILDREN
Lifeline is not intended for children under 18. If you believe a child
has created an account, contact us and we will delete it.

13. B2B (COMPANY ONBOARDING) SPECIFICS
When your employer onboards you through Lifeline:
- Lifeline acts as a data processor for the contact details your
  employer provides, and as a data controller for the health data you
  share directly with us.
- Your employer's contact person can see your name, email, phone, and
  the last four digits of your kennitala — NOT your body composition,
  measurements, or any clinical data.
- Your employer receives only onboarding completion status — nothing
  clinical.
- If you leave the company, your Lifeline account remains yours. You
  decide whether to keep it.

14. INTERNATIONAL TRANSFERS
Your data is primarily hosted in the EU. Some of our processors (e.g.
Resend) operate in the US under EU Standard Contractual Clauses. We do
not transfer data to jurisdictions without adequate protections.

15. AUTOMATED DECISION-MAKING
Lifeline does not make decisions with legal or similarly significant
effects based solely on automated processing. All clinically relevant
decisions involve a qualified Lifeline physician.

16. CHANGES TO THIS POLICY
We will notify you of material changes at least 14 days before they
take effect, by email or in-app. The current version is always at
lifelinehealth.is/privacy.

17. CONTACT
Questions, concerns, or requests about your personal data:
contact@lifelinehealth.is.

— Lifeline Health ehf. · Reykjavík, Iceland`;
}

export function renderPublicTermsOfService(): string {
  return `LIFELINE HEALTH — TERMS OF SERVICE & PRIVACY POLICY (PUBLIC)
Version ${PUBLIC_TERMS_VERSION}  ·  Last updated ${PUBLIC_TERMS_LAST_UPDATED}

This page covers the terms under which Lifeline Health ehf. ("Lifeline",
"we", "our") provides its services, and how we handle personal data
about individual users ("you") and business customers. It is written
in plain language. A formal Icelandic translation is available on
request.

1. WHO WE ARE
Lifeline Health ehf. is an Icelandic company providing digital health
coaching, body composition tracking, and telemedicine services through
the website lifelinehealth.is and the Lifeline mobile app.

2. SERVICES WE PROVIDE
- Health assessments, programs, and coaching delivered by licensed
  Lifeline staff.
- Body composition measurements performed at partner clinics using the
  Biody Manager device, and made available to you digitally.
- Optional in-app tracking (meals, weigh-ins, habits) and community
  features.
- For business customers: employee onboarding and aggregate reporting.

3. YOUR ACCOUNT
To use Lifeline you must create an account. You're responsible for
keeping your password safe and for activity on your account. You must
be at least 18 years old, or have parental consent, to register.

4. PERSONAL DATA WE COLLECT
When you register directly, we collect:
- Name, email, phone number
- Date of birth, sex, height, weight, activity level
- Health goals you choose to share
- Body composition measurements, if you visit a partner clinic
- Meal logs, weigh-ins, program progress, and messages if you use those
  features

If you onboard through a business customer (your employer), the contact
person at your company provides us your name, kennitala, email, and
phone before inviting you. You then fill in the remaining fields
yourself during onboarding. Lifeline never shares your health data
back to your employer — only onboarding completion status.

5. HOW WE STORE YOUR KENNITALA
Your kennitala is encrypted at rest using industry-standard symmetric
encryption. The encryption key is managed separately from the database.
Only a narrow set of server processes — not individuals — can request
a decryption, and every decryption is logged. Lifeline staff who need
to identify you in a support context see only the last four digits by
default.

6. WHAT WE USE YOUR DATA FOR
- Service operation. Providing the features you requested.
- Safety & quality. Detecting abuse, preventing fraud, debugging
  errors.
- Research (opt-out). We may use non-identifiable versions of your
  data to improve Lifeline and for anonymised clinical research. You
  can opt out during onboarding or at any time from your account
  settings.
- Marketing (opt-out). Occasional product updates and promotions by
  email. You can opt out during onboarding, from any email, or from
  account settings.

7. WHO WE SHARE DATA WITH
- Medalia ehf. — licensed sjúkraskrár-system (Icelandic law nr. 55/2009)
  where your formal medical record is held. Lifeline and Medalia act
  as joint controllers for health-record data under GDPR Art. 26.
- Biody Manager (our body composition measurement partner). We share
  name, email, date of birth, sex, height, and activity level to
  register you as a patient. We do not send your kennitala to Biody.
  Lifeline only stores the last four digits of your kennitala (data
  minimisation); we do not store the full number.
- Supabase (our database and authentication provider) and Vercel (our
  web hosting provider), under GDPR-compliant data processing
  agreements.
- Resend (our transactional email provider), which delivers
  invitations and notifications.
- Icelandic health authorities and law enforcement, if legally
  required.

We never sell your personal data.

8. HOW LONG WE KEEP YOUR DATA
We keep your account and related health data while your account is
active. If you delete your account, we delete personally identifying
information within 30 days, except where retention is required by
Icelandic health law. Anonymised aggregates may be kept indefinitely.

9. YOUR RIGHTS
Under the Icelandic Data Protection Act and the EU GDPR you have the
right to access, correct, export, restrict, or delete your personal
data. Email contact@lifelinehealth.is and we will respond within 30
days. You also have the right to lodge a complaint with the Icelandic
Data Protection Authority (Persónuvernd) at www.personuvernd.is.

10. SECURITY
Lifeline uses TLS for data in transit, encryption at rest for sensitive
fields, role-based access controls, and audit logging. No system is
perfect — if you believe your account has been compromised, contact
contact@lifelinehealth.is.

11. FOR BUSINESS CUSTOMERS (B2B)
If your organisation onboards employees through Lifeline, the following
applies in addition:
- Lifeline acts as a data processor for health data that employees
  choose to share, and as a data controller for platform operations.
- The contact person at your company can see the employee roster
  (name, email, phone, kennitala last-4) and onboarding completion
  status — NOT health data.
- A full kennitala export is available to Lifeline staff only, for
  audit and regulatory purposes.
- Your organisation represents that it has a lawful basis (employment
  contract, occupational-health programme, or employee consent) to
  share employee contact information with Lifeline.
- Lifeline will delete employee records at your written request,
  except where retention is legally required.

12. PAYMENT AND SUBSCRIPTIONS
Paid subscriptions are billed in advance, non-refundable except where
required by Icelandic consumer law, and automatically renew. You can
cancel anytime from your account settings. For B2B, billing is
governed by your separate service agreement.

13. MEDICAL DISCLAIMER
Lifeline is a health coaching and wellness service, not a substitute
for a licensed physician. Always consult a qualified clinician before
making changes to medications, chronic-disease management, or if you
are pregnant, nursing, or have a medical condition. In an emergency,
call 112.

14. CHANGES TO THESE TERMS
We may update this document occasionally. Material changes will be
notified to you by email or in-app at least 14 days before they take
effect. The current version is always available at
lifelinehealth.is/terms.

15. GOVERNING LAW
These terms are governed by Icelandic law. Disputes are subject to the
exclusive jurisdiction of the courts of Reykjavík, unless consumer
protection law provides otherwise.

16. CONTACT
- General: contact@lifelinehealth.is
- Privacy: contact@lifelinehealth.is
- Security: contact@lifelinehealth.is

— Lifeline Health ehf. · Reykjavík, Iceland`;
}
