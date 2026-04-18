import Link from "next/link";
import LifelineLogo from "@/app/components/LifelineLogo";
import BackButton from "@/app/components/BackButton";

export const metadata = {
  title: "Terms & Privacy — Lifeline Health",
  description: "Lifeline Health terms of service, data processing, and privacy policy.",
};

const VERSION = "1.2";
const LAST_UPDATED = "17 April 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <LifelineLogo className="w-8 h-8" />
          <span className="font-semibold">Lifeline Health</span>
        </Link>
        <BackButton />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-sm prose-slate">
        <p className="text-sm text-gray-500">Version {VERSION} — Last updated {LAST_UPDATED}</p>
        <h1>Terms of Service &amp; Privacy Policy</h1>

        <p>
          This page covers the terms under which Lifeline Health ehf. (&quot;<strong>Lifeline</strong>&quot;,
          &quot;we&quot;, &quot;our&quot;) provides its services, and how we handle personal data
          about individual users (&quot;<strong>you</strong>&quot;) and business customers.
          It is written in plain language. A formal Icelandic translation is available on request.
        </p>

        <h2>1. Who we are</h2>
        <p>
          Lifeline Health ehf. is an Icelandic company providing digital health coaching, body
          composition tracking, and telemedicine services through the website{" "}
          <a href="https://lifelinehealth.is">lifelinehealth.is</a> and the Lifeline mobile app.
        </p>

        <h2>2. Services we provide</h2>
        <ul>
          <li>Health assessments, programs, and coaching delivered by licensed Lifeline staff.</li>
          <li>Body composition measurements performed at partner clinics using the Biody Manager device, and made available to you digitally.</li>
          <li>Optional in-app tracking (meals, weigh-ins, habits) and community features.</li>
          <li>For business customers: employee onboarding and aggregate reporting.</li>
        </ul>

        <h2>3. Your account</h2>
        <p>
          To use Lifeline you must create an account. You&apos;re responsible for keeping your
          password safe and for activity on your account. You must be at least 18 years old, or
          have parental consent, to register.
        </p>

        <h2>4. Personal data we collect</h2>
        <p>When you register directly, we collect:</p>
        <ul>
          <li>Name, email, phone number</li>
          <li>Date of birth, sex, height, weight, activity level</li>
          <li>Health goals you choose to share</li>
          <li>Body composition measurements, if you visit a partner clinic</li>
          <li>Meal logs, weigh-ins, program progress, and messages if you use those features</li>
        </ul>
        <p>
          If you onboard through a business customer (your employer), the contact person at your
          company provides us your <strong>name, kennitala, email, and phone</strong> before inviting
          you. You then fill in the remaining fields yourself during onboarding. Lifeline never
          shares your health data back to your employer — only onboarding completion status.
        </p>

        <h2>5. How we store your kennitala</h2>
        <p>
          Your kennitala is encrypted at rest using industry-standard symmetric encryption. The
          encryption key is managed separately from the database. Only a narrow set of server
          processes — not individuals — can request a decryption, and every decryption is logged.
          Lifeline staff who need to identify you in a support context see only the last four digits
          by default.
        </p>

        <h2>6. What we use your data for</h2>
        <ul>
          <li><strong>Service operation.</strong> Providing the features you requested.</li>
          <li><strong>Safety &amp; quality.</strong> Detecting abuse, preventing fraud, debugging errors.</li>
          <li><strong>Research (opt-out).</strong> We may use <em>non-identifiable</em> versions of your data
          to improve Lifeline and for anonymised clinical research. You can opt out during
          onboarding or at any time from your account settings.</li>
          <li><strong>Marketing (opt-out).</strong> Occasional product updates and promotions by email.
          You can opt out during onboarding, from any email, or from account settings.</li>
        </ul>

        <h2>7. Who we share data with</h2>
        <ul>
          <li><strong>Biody Manager</strong> (our body composition measurement partner). We share name, email,
          date of birth, sex, height, and activity level to register you as a patient. We do not send
          your kennitala to Biody.</li>
          <li><strong>Supabase</strong> (our database and authentication provider) and <strong>Vercel</strong> (our
          web hosting provider), under GDPR-compliant data processing agreements.</li>
          <li><strong>Resend</strong> (our transactional email provider), which delivers invitations and
          notifications.</li>
          <li><strong>Icelandic health authorities and law enforcement</strong>, if legally required.</li>
        </ul>
        <p>We never sell your personal data.</p>

        <h2>8. How long we keep your data</h2>
        <p>
          We keep your account and related health data while your account is active. If you delete
          your account, we delete personally identifying information within 30 days, except where
          retention is required by Icelandic health law. Anonymised aggregates may be kept indefinitely.
        </p>

        <h2>9. Your rights</h2>
        <p>
          Under the Icelandic Data Protection Act and the EU GDPR you have the right to access,
          correct, export, restrict, or delete your personal data. Email{" "}
          <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a> and we will respond
          within 30 days. You also have the right to lodge a complaint with the{" "}
          <a href="https://www.personuvernd.is/">Icelandic Data Protection Authority (Persónuvernd)</a>.
        </p>

        <h2>10. Security</h2>
        <p>
          Lifeline uses TLS for data in transit, encryption at rest for sensitive fields, role-based
          access controls, and audit logging. No system is perfect — if you believe your account has
          been compromised, contact <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
        </p>

        <h2>11. For business customers (B2B)</h2>
        <p>
          If your organisation onboards employees through Lifeline, the following applies in addition:
        </p>
        <ul>
          <li>Lifeline acts as a <strong>data processor</strong> for health data that employees choose to share, and as a <strong>data controller</strong> for platform operations.</li>
          <li>The contact person at your company can see the employee roster (name, email, phone, kennitala last-4) and onboarding completion status — <strong>not</strong> health data.</li>
          <li>A full kennitala export is available to Lifeline staff only, for audit and regulatory purposes.</li>
          <li>Your organisation represents that it has a lawful basis (employment contract, occupational-health programme, or employee consent) to share employee contact information with Lifeline.</li>
          <li>Lifeline will delete employee records at your written request, except where retention is legally required.</li>
        </ul>

        <h2>12. Payment and subscriptions</h2>
        <p>
          Paid subscriptions are billed in advance, non-refundable except where required by Icelandic
          consumer law, and automatically renew. You can cancel anytime from your account settings.
          For B2B, billing is governed by your separate service agreement.
        </p>

        <h2>13. Medical disclaimer</h2>
        <p>
          Lifeline is a health coaching and wellness service, not a substitute for a licensed
          physician. Always consult a qualified clinician before making changes to medications,
          chronic-disease management, or if you are pregnant, nursing, or have a medical condition.
          In an emergency, call 112.
        </p>

        <h2>14. Changes to these terms</h2>
        <p>
          We may update this document occasionally. Material changes will be notified to you by
          email or in-app at least 14 days before they take effect. The current version is always
          available at <a href="/terms">lifelinehealth.is/terms</a>.
        </p>

        <h2>15. Governing law</h2>
        <p>
          These terms are governed by Icelandic law. Disputes are subject to the exclusive jurisdiction
          of the courts of Reykjavík, unless consumer protection law provides otherwise.
        </p>

        <h2>16. Contact</h2>
        <ul>
          <li>General: <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a></li>
          <li>Privacy: <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a></li>
          <li>Security: <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a></li>
        </ul>

        <p className="text-xs text-gray-400 mt-12">
          Lifeline Health ehf. &middot; Reykjavík, Iceland
        </p>
      </main>
    </div>
  );
}
