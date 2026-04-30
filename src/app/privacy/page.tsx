import Link from "next/link";
import LifelineLogo from "@/app/components/LifelineLogo";
import BackButton from "@/app/components/BackButton";

export const metadata = {
  title: "Privacy Policy — Lifeline Health",
  description: "How Lifeline Health collects, uses, stores, and protects your personal and health data.",
};

const VERSION = "1.4";
const LAST_UPDATED = "29 April 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <Link href="/" className="flex items-center gap-2">
            <LifelineLogo className="w-8 h-8" />
            <span className="font-semibold">Lifeline Health</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-sm prose-slate">
        <p className="text-sm text-gray-500">Version {VERSION} — Last updated {LAST_UPDATED}</p>
        <h1>Privacy Policy</h1>

        <p>
          This policy explains what personal data Lifeline Health ehf.
          (&quot;<strong>Lifeline</strong>&quot;, &quot;we&quot;, &quot;our&quot;) collects about you, why we
          collect it, how we use it, who we share it with, how long we keep it, and the rights you
          have over it. It sits alongside our{" "}
          <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> — if
          anything here conflicts, this document wins for privacy matters.
        </p>

        <h2>1. Who controls your data</h2>
        <p>
          Lifeline Health ehf., an Icelandic company (Reykjavík), is the data controller for your
          personal data. For questions or requests, email{" "}
          <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
        </p>

        <h2>2. Categories of data we collect</h2>
        <ul>
          <li><strong>Identity &amp; contact:</strong> name, kennitala, email, phone number, address.</li>
          <li><strong>Account:</strong> password (stored as a salted hash, never in plain text), login history, device + IP at session level.</li>
          <li><strong>Health profile:</strong> date of birth, sex, height, weight, activity level, health goals, medical history you choose to share.</li>
          <li><strong>Measurements:</strong> body-composition results (fat %, muscle mass, phase angle, BMR, body water, etc.) from our measurement partner Biody.</li>
          <li><strong>Usage:</strong> meals logged, weigh-ins, program progress, app interactions, messages exchanged with Lifeline coaches.</li>
          <li><strong>Business onboarding (B2B only):</strong> the company you belong to and onboarding completion status.</li>
        </ul>

        <h2>3. How we collect it</h2>
        <ul>
          <li>Directly from you when you register, complete assessments, or use the app.</li>
          <li>From your employer (B2B only) who provides your name, kennitala, email and phone before inviting you — you then complete the rest yourself.</li>
          <li>From Biody Manager when you attend a body-composition scan at one of our partner clinics.</li>
          <li>Automatically via the app (e.g. your phone&apos;s timezone, device type for support).</li>
        </ul>

        <h2>4. Why we use it (legal basis)</h2>
        <ul>
          <li><strong>Performance of a contract (GDPR Art. 6(1)(b)).</strong> Providing the service you signed up for — assessments, reports, coaching, body composition tracking.</li>
          <li><strong>Explicit consent for special-category data (Art. 9(2)(a)).</strong> Health data is only processed once you have agreed to our terms during onboarding.</li>
          <li><strong>Legitimate interests (Art. 6(1)(f)).</strong> Fraud prevention, debugging errors, and secure operation of our platform.</li>
          <li><strong>Consent (Art. 6(1)(a)).</strong> Marketing emails and use of anonymised data for research — both opt-in; you can withdraw consent at any time.</li>
          <li><strong>Legal obligation (Art. 6(1)(c)).</strong> Where Icelandic health law, tax law, or court orders require retention or disclosure.</li>
        </ul>

        <h2>5. How we store your kennitala</h2>
        <p>
          Kennitala is considered sensitive personal data under Icelandic law. We follow the
          principle of <strong>data minimisation</strong>: only the last four digits are stored
          in our database, and only for the limited purposes of identifying employee rosters in
          B2B onboarding and matching duplicates. We do not store, decrypt, or transmit your full
          kennitala — neither to staff nor to any third party. If a future regulatory or clinical
          process requires it, that process will live inside Medalia (the licensed sjúkraskrár-
          system) where access is logged under Icelandic law nr. 55/2009 §14, not in this app.
        </p>

        <h2>6. Who we share your data with</h2>
        <table>
          <thead><tr><th>Recipient</th><th>Purpose</th><th>Location</th></tr></thead>
          <tbody>
            <tr><td>Medalia ehf.</td><td>Licensed health record system (sjúkraskrá) under Icelandic law nr. 55/2009 — joint controller with Lifeline for health record data per GDPR Art. 26</td><td>Iceland</td></tr>
            <tr><td>Supabase Inc.</td><td>Database, authentication, operational data</td><td>EU (Frankfurt)</td></tr>
            <tr><td>Vercel Inc.</td><td>Web hosting, delivery</td><td>EU + US (with SCCs)</td></tr>
            <tr><td>Resend (Lilo Labs Inc.)</td><td>Transactional email delivery</td><td>EU + US (with SCCs)</td></tr>
            <tr><td>Biody Manager (Aminogram SAS)</td><td>Body-composition measurement partner</td><td>EU (France)</td></tr>
            <tr><td>Your employer (B2B only)</td><td>Onboarding completion status — no health data</td><td>Iceland</td></tr>
            <tr><td>Icelandic authorities</td><td>Where legally required (court order, health law)</td><td>Iceland</td></tr>
          </tbody>
        </table>
        <p>
          We never sell personal data. All processors are bound by GDPR-compliant data processing
          agreements. Transfers outside the EEA rely on EU Standard Contractual Clauses.
        </p>

        <h2>6a. Where your health record lives</h2>
        <p>
          Lifeline operates as a licensed healthcare service (heilbrigðisþjónusta) under
          Icelandic law nr. 40/2007. Your formal medical record (sjúkraskrá) — including
          clinical interpretations, blood-test results, doctor&apos;s notes, and finalised
          health-assessment outcomes — is held in <strong>Medalia ehf.</strong>, a sjúkraskrár-
          system licensed under Icelandic law nr. 55/2009. Lifeline and Medalia act as{" "}
          <strong>joint controllers</strong> for that record under GDPR Art. 26.
        </p>
        <p>
          The Lifeline app and admin console are operational tools (scheduling, programs,
          coaching, self-tracking) — not your medical record. Body-composition values from
          Biody scans are entered into Medalia by a clinician as part of your assessment;
          a copy is also shown in your Lifeline dashboard for your own self-tracking, with
          your explicit consent and only visible to you.
        </p>

        <h2>7. What we share with Biody Manager</h2>
        <p>
          To register you as a patient on the measurement device, we send Biody your name, email,
          date of birth (derived from your kennitala), sex, height, and activity level. We do
          <strong> not</strong> send your kennitala or your Lifeline account password. Biody stores
          the measurement data and returns it to us; we link it to your Lifeline account.
        </p>

        <h2>8. Retention</h2>
        <ul>
          <li><strong>Active accounts:</strong> we keep your data for as long as you use Lifeline.</li>
          <li><strong>Account deletion:</strong> personally identifying information is deleted within 30 days of your request, except where retention is required by Icelandic law.</li>
          <li><strong>Inactive B2B invitations:</strong> unused invitations are deleted after 12 months.</li>
          <li><strong>Audit logs:</strong> kept for 24 months for security and regulatory purposes.</li>
          <li><strong>Anonymised aggregates:</strong> may be kept indefinitely as they no longer identify you.</li>
        </ul>

        <h2>9. Security measures</h2>
        <ul>
          <li>TLS encryption in transit; database hosted on Supabase with at-rest encryption at the storage layer.</li>
          <li>Role-based access control via Row-Level Security; specialty-based separation between coaches, clinicians, and admins.</li>
          <li>Audit logging on every write to health-sensitive tables (clients, messages, weight log, body composition events).</li>
          <li>Quarterly staff access review — every team member&apos;s permissions are revisited every 90 days.</li>
          <li>Service-role credentials stored in a secrets manager, never in source code.</li>
          <li>MFA (TOTP, AAL2) required for every Lifeline staff session before admin access is granted.</li>
          <li>Sentry redaction strips request bodies on health-related routes so error monitoring cannot leak Art. 9 data.</li>
        </ul>
        <p>
          No system is perfectly secure. If you believe your account has been compromised, contact{" "}
          <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
        </p>

        <h2>10. Your rights</h2>
        <p>Under the Icelandic Data Protection Act and the EU GDPR you have the right to:</p>
        <ul>
          <li><strong>Access</strong> the personal data we hold about you.</li>
          <li><strong>Correct</strong> anything that is wrong.</li>
          <li><strong>Delete</strong> your data (the &quot;right to be forgotten&quot;), subject to legal retention.</li>
          <li><strong>Restrict or object</strong> to certain processing.</li>
          <li><strong>Portability</strong> — receive your data in a structured, machine-readable format.</li>
          <li><strong>Withdraw consent</strong> at any time for marketing or research use.</li>
          <li><strong>Lodge a complaint</strong> with the{" "}
            <a href="https://www.personuvernd.is/">Icelandic Data Protection Authority (Persónuvernd)</a>.
          </li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:pv@lifelinehealth.is">pv@lifelinehealth.is</a> (our data protection
          inbox) or submit a request from your account settings under <em>Data &amp; privacy</em>.
          We respond within 30 days per GDPR Art. 12. Health record requests that need data held
          in Medalia are coordinated with our joint-controller per the Art. 26 arrangement.
        </p>

        <h2>11. Cookies &amp; analytics</h2>
        <p>
          We use strictly necessary cookies to keep you signed in. We do not use advertising
          cookies. Any analytics we run is privacy-preserving and aggregate (no cross-site tracking).
        </p>

        <h2>12. Children</h2>
        <p>
          Lifeline is not intended for children under 18. If you believe a child has created an
          account, contact us and we will delete it.
        </p>

        <h2>13. B2B (company onboarding) specifics</h2>
        <p>
          When your employer onboards you through Lifeline:
        </p>
        <ul>
          <li>Lifeline acts as a <strong>data processor</strong> for the contact details your employer provides, and as a <strong>data controller</strong> for the health data you share directly with us.</li>
          <li>Your employer&apos;s contact person can see your name, email, phone, and the last four digits of your kennitala — <strong>not</strong> your body composition, measurements, or any clinical data.</li>
          <li>Your employer receives only onboarding completion status — nothing clinical.</li>
          <li>If you leave the company, your Lifeline account remains yours. You decide whether to keep it.</li>
        </ul>

        <h2>14. International transfers</h2>
        <p>
          Your data is primarily hosted in the EU. Some of our processors (e.g. Resend) operate in
          the US under EU Standard Contractual Clauses. We do not transfer data to jurisdictions
          without adequate protections.
        </p>

        <h2>15. Automated decision-making</h2>
        <p>
          Lifeline does not make decisions with legal or similarly significant effects based solely
          on automated processing. All clinically relevant decisions involve a qualified Lifeline
          physician.
        </p>

        <h2>16. Changes to this policy</h2>
        <p>
          We will notify you of material changes at least 14 days before they take effect, by email
          or in-app. The current version is always at{" "}
          <a href="/privacy">lifelinehealth.is/privacy</a>.
        </p>

        <h2>17. Contact</h2>
        <p>
          Questions, concerns, or requests about your personal data:{" "}
          <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
        </p>

        <p className="text-xs text-gray-400 mt-12">
          Lifeline Health ehf. · Reykjavík, Iceland
        </p>
      </main>
    </div>
  );
}
