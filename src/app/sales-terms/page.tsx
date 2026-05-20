import Link from "next/link";
import LifelineLogo from "@/app/components/LifelineLogo";
import BackButton from "@/app/components/BackButton";

export const metadata = {
  title: "Sales Terms — Lifeline Health",
  description:
    "Lifeline Health sales and subscription terms for consumer purchases of health assessments and Lifeline app subscriptions. Payments, subscriptions, refunds and right of withdrawal.",
};

const VERSION = "1.0";
const LAST_UPDATED = "20 May 2026";

export default function SalesTermsPage() {
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
        <p className="text-sm text-gray-500">
          Version {VERSION} — Last updated {LAST_UPDATED} ·{" "}
          <Link href="/soluskilmalar" className="underline">Íslensk útgáfa</Link>
        </p>
        <h1>Sales &amp; Subscription Terms</h1>

        <p>
          These sales terms govern consumer purchases (the &quot;consumer&quot;, &quot;you&quot;)
          of Lifeline Health ehf. services through lifelinehealth.is and the Lifeline mobile
          app. They supplement, and do not limit, Lifeline&apos;s general{" "}
          <Link href="/terms">Terms of Service and Privacy Policy</Link>. In case of conflict,
          these sales terms control for all matters concerning payment, subscription and
          refunds. The legally binding version is the{" "}
          <Link href="/soluskilmalar">Icelandic original</Link>; this English text is provided
          for convenience.
        </p>

        <h2>1. Seller and corporate structure</h2>
        <p>
          <strong>1.1</strong> The seller of the services described in these terms, as the
          business is operated today, is:
        </p>
        <ul>
          <li>Lifeline Health ehf.</li>
          <li>Reg. no. (kennitala): 590925-1440</li>
          <li>Registered address: Langholtsvegi 111, 104 Reykjavík, Iceland</li>
          <li>Email: <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a></li>
          <li>Website: <a href="https://lifelinehealth.is">lifelinehealth.is</a></li>
        </ul>
        <p>
          Lifeline Health ehf. is a licensed healthcare provider operating under Act no.
          40/2007 on Healthcare Services and is registered as such with the Directorate of
          Health (Embætti landlæknis).
        </p>
        <p>
          <strong>1.2</strong> Lifeline Health ehf. is in the process of incorporating a
          separate daughter company to operate the health-coaching and lifestyle-guidance
          offering (the subscription service described in section 3.2) as a standalone
          entity. The purpose is to keep Lifeline Health ehf.&apos;s healthcare operating
          licence cleanly separated from activity that does not constitute regulated
          healthcare under Act no. 40/2007. Until that daughter company is operational,
          Lifeline Health ehf. is the seller of both services listed in section 3. These
          terms will be updated with at least 30 days&apos; notice when the daughter
          company assumes responsibility for the subscription service.
        </p>

        <h2>2. Scope and acceptance</h2>
        <p>
          By completing a payment on the Lifeline website or inside the Lifeline app you
          confirm that you have read, understood and accepted these terms. Services are sold
          only to individuals aged 18 or over who reside in Iceland or the EEA.
        </p>

        <h2>3. Services offered</h2>

        <h3>3.1 Health assessment (one-off purchase) — regulated healthcare</h3>
        <p>
          A comprehensive clinical health assessment comprising questionnaires, lifestyle
          evaluation, a body-composition measurement at a partner station, laboratory
          results where applicable, and interpretation by a Lifeline Health ehf. physician.
          The health assessment is <strong>regulated healthcare</strong>{" "}
          (heilbrigðisþjónusta) within the meaning of Act no. 40/2007, provided by Lifeline
          Health ehf. under its healthcare operating licence. Sold as a one-off purchase and
          delivered digitally inside your account in the app and on the web.
        </p>

        <h3>3.2 Lifeline app subscription — health coaching and lifestyle guidance</h3>
        <p>
          Ongoing access to personalised health coaching, daily guidance, nutrition plans,
          follow-up, and messaging with Lifeline coaches. The subscription service is{" "}
          <strong>health coaching and lifestyle guidance</strong> — it does not constitute
          regulated healthcare under Act no. 40/2007, and it does not replace medical care,
          clinical diagnosis or treatment. Subscriptions are sold on monthly or annual
          billing cycles as shown on the checkout screen. As noted in section 1.2,
          operation of this service will transfer to a Lifeline Health daughter company
          when that company becomes operational.
        </p>
        <p>
          The exact price, included features and billing period are always shown on the
          checkout screen before payment is confirmed.
        </p>

        <h2>4. Price, currency and VAT</h2>
        <p>
          All prices are displayed in Icelandic króna (ISK). Lifeline Health&apos;s services
          qualify as healthcare services exempt from value-added tax under Article 2(2) of
          Act no. 50/1988 on Value Added Tax, and therefore <strong>no VAT</strong> is added
          to the price of health assessments or health-coaching subscriptions.
        </p>
        <p>
          Lifeline reserves the right to change prices. Price changes do not apply to
          services already paid for or to the current billing period of an existing
          subscription. Subscription price changes are notified at least 30 days before the
          next renewal by email or in-app.
        </p>

        <h2>5. Payment and payment processing</h2>
        <p>
          Card payments (Visa, Mastercard) are processed by our payment partner Straumur
          greiðslumiðlun ehf. Lifeline never stores full card numbers on its servers — only
          encrypted tokens necessary for subscription renewal.
        </p>
        <p>
          Payment is authorised at checkout and captured when the service is delivered or
          the subscription period begins. A receipt is sent by email after every successful
          payment and is also available inside your account.
        </p>

        <h2>6. Subscriptions, auto-renewal and cancellation</h2>
        <p>
          Subscriptions automatically renew at the end of each billing period at the
          then-current price until you cancel. A reminder for upcoming renewal of an annual
          subscription is sent by email at least 7 days in advance.
        </p>
        <p>
          You may cancel at any time, without reason, through the settings in the app, at{" "}
          <Link href="/account">lifelinehealth.is/account</Link>, or by email to{" "}
          <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
          Cancellation takes effect at the end of the current paid period — your access
          remains unchanged until then. Pro-rated refunds of unused portions of a billing
          period are not provided unless required by mandatory law.
        </p>

        <h2>7. Delivery of the service</h2>
        <p>Digital services begin as soon as payment is confirmed:</p>
        <ul>
          <li>
            <strong>Health assessment (one-off):</strong> the booking flow and questionnaires
            open immediately. The body-composition measurement is performed at a partner
            station at the time you book.
          </li>
          <li>
            <strong>Subscription:</strong> full access to subscription features opens
            immediately and the subscription period starts on the payment date.
          </li>
        </ul>

        <h2>8. Right of withdrawal (14-day cooling-off)</h2>
        <p>
          Under Act no. 16/2016 on Consumer Contracts the consumer generally has 14 days to
          withdraw from a distance contract, without giving any reason, from the date the
          contract was concluded.
        </p>
        <p>
          <strong>Important exception for digital health services:</strong> because
          Lifeline&apos;s services are delivered digitally and immediately at your request,
          you expressly agree on the checkout screen:
        </p>
        <ul>
          <li>
            to ask Lifeline to begin performance of the service <em>within</em> the 14-day
            cooling-off period; and
          </li>
          <li>
            to acknowledge that your right of withdrawal <em>lapses</em> once the service has
            been fully performed (Art. 18(1)(d) of Act no. 16/2016).
          </li>
        </ul>
        <p>In practice this means:</p>
        <ul>
          <li>
            <strong>Health assessment (one-off):</strong> you may withdraw without reason until
            the assessment has been performed. Once the assessment has been fully performed
            the right of withdrawal lapses. If you have used part of the service before
            withdrawing you must pay a proportionate amount for the portion already
            delivered.
          </li>
          <li>
            <strong>Subscription:</strong> you may withdraw within 14 days of starting a new
            subscription. If the subscription has already given you access to content, a
            proportionate amount may be deducted from the refund pursuant to Art. 21(2) of
            Act no. 16/2016. Automatic renewal does not create a new withdrawal right —
            cancel under section 6.
          </li>
        </ul>
        <p>
          To exercise the right of withdrawal, send a clear statement to{" "}
          <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a> before the
          period expires. A withdrawal form is set out in Annex I to Act no. 16/2016.
        </p>

        <h2>9. Refunds</h2>
        <p>
          Refunds payable under these terms or mandatory law are credited to the same payment
          method used for the original payment, no later than <strong>14 days</strong> from
          the date the request is considered valid. No administrative fee is charged on
          refunds.
        </p>

        <h2>10. Failed payment and renewal</h2>
        <p>
          If automatic renewal fails (e.g. expired card or insufficient funds), Lifeline
          will retry the charge for up to 7 days and notify you by email. If payment is not
          received within that period, access to subscription features is automatically
          suspended. Access is restored as soon as payment is successful.
        </p>

        <h2>11. Chargebacks and disputed charges</h2>
        <p>
          If you believe you have been wrongly charged, please contact Lifeline at{" "}
          <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a> before
          filing a chargeback with your card issuer. This allows a faster and correct
          resolution. Lifeline responds to such requests within 5 business days.
        </p>

        <h2>12. Medical disclaimer</h2>
        <p>
          <strong>The health assessment (section 3.1)</strong> is a regulated healthcare
          service and is not a substitute for the care of your GP or specialist.
        </p>
        <p>
          <strong>The subscription service (section 3.2)</strong> is health coaching and
          lifestyle guidance — not regulated healthcare. It complements, but does not
          replace, medical diagnosis or treatment. Subscription content must not be used to
          make clinical decisions.
        </p>
        <p>
          In an emergency always call 112. Discontinue or change medication only in
          consultation with a physician. Further limitation-of-liability provisions are set
          out in the general <Link href="/terms">Terms of Service</Link>.
        </p>

        <h2>13. Privacy</h2>
        <p>
          Processing of personal data in connection with payment and service provision is
          carried out in accordance with the{" "}
          <Link href="/privacy">Lifeline Privacy Policy</Link>, Act no. 90/2018 on Data
          Protection and the Processing of Personal Data, and Regulation (EU) 2016/679
          (GDPR). Straumur greiðslumiðlun ehf. acts as an independent data controller for
          processing of payment data.
        </p>

        <h2>14. Complaints</h2>
        <p>
          Complaints regarding payment, service or the operation of these terms should be
          sent to <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
          Lifeline will respond formally within 14 days of receipt. If a resolution cannot
          be reached, the consumer may refer the matter to:
        </p>
        <ul>
          <li>
            <strong>The Icelandic Consumer Agency (Neytendastofa)</strong> —{" "}
            <a href="https://www.neytendastofa.is" target="_blank" rel="noopener noreferrer">
              neytendastofa.is
            </a>
          </li>
          <li>
            <strong>The Appeals Committee for Goods and Services Purchases</strong> —{" "}
            <a href="https://www.neytendastofa.is/kaerunefnd-voru-og-thjonustukaupa/" target="_blank" rel="noopener noreferrer">
              neytendastofa.is/kaerunefnd
            </a>
          </li>
          <li>
            <strong>The Icelandic Data Protection Authority (Persónuvernd)</strong> for
            complaints regarding the processing of personal data —{" "}
            <a href="https://www.personuvernd.is" target="_blank" rel="noopener noreferrer">
              personuvernd.is
            </a>
          </li>
        </ul>

        <h2>15. Changes to these terms</h2>
        <p>
          Lifeline may update these terms. Material changes will be notified by email or
          in-app at least 30 days before they take effect. The current version is always
          available at <Link href="/sales-terms">lifelinehealth.is/sales-terms</Link>.
        </p>

        <h2>16. Governing law and jurisdiction</h2>
        <p>
          These terms are governed by Icelandic law. Disputes shall be brought before the
          District Court of Reykjavík, subject to mandatory consumer-protection law,
          including the consumer&apos;s right to bring proceedings in the courts of his or
          her own jurisdiction.
        </p>

        <h2>17. Contact</h2>
        <ul>
          <li>General enquiries and complaints: <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a></li>
          <li>Privacy: <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a></li>
        </ul>

        <p className="text-xs text-gray-400 mt-12">
          Lifeline Health ehf. · reg. no. 590925-1440 · Langholtsvegi 111, 104 Reykjavík, Iceland
        </p>
      </main>
    </div>
  );
}
