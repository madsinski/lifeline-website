// Server-rendered viewer for every legal document Lifeline maintains.
// Pulls live text from the renderer libs so the page stays in sync.
// Grouped into categories to make the lawyer's review quicker.

import Link from "next/link";
import {
  renderMedaliaJointControllerArrangement,
  MEDALIA_JOINT_CONTROLLER_VERSION,
  renderBiodyDPA,
  BIODY_DPA_VERSION,
  renderDPIAInterim,
  DPIA_INTERIM_VERSION,
  renderClientConsentBiodyImport,
  CLIENT_CONSENT_BIODY_IMPORT_VERSION,
} from "@/lib/processor-agreements";
import {
  TOS_VERSION,
  DPA_VERSION,
  EMPLOYEE_TOS_VERSION,
  HEALTH_CONSENT_VERSION,
  renderTermsOfService,
  renderDataProcessingAgreement,
  renderEmployeeTermsOfService,
  renderHealthAssessmentConsent,
} from "@/lib/platform-terms-content";
import {
  STAFF_NDA_VERSION,
  STAFF_CONFIDENTIALITY_VERSION,
  STAFF_ACCEPTABLE_USE_VERSION,
  STAFF_DATA_PROTECTION_VERSION,
  STAFF_ONBOARDING_CHECKLIST_VERSION,
  STAFF_PIECE_RATE_EMPLOYMENT_VERSION,
  STAFF_CONTRACTOR_VERSION,
  renderStaffNDA,
  renderStaffConfidentiality,
  renderStaffAcceptableUse,
  renderStaffDataProtectionBriefing,
  renderStaffOnboardingChecklist,
  renderStaffPieceRateEmployment,
  renderStaffContractorAgreement,
} from "@/lib/staff-terms-content";
import {
  THJONUSTUSKILMALAR_VERSION,
  THJONUSTUSAMNINGUR_VERSION,
  renderThjonustuskilmalar,
  renderThjonustusamningur,
  renderPurchaseOrder,
} from "@/lib/agreement-templates";
import {
  PUBLIC_PRIVACY_VERSION,
  PUBLIC_PRIVACY_LAST_UPDATED,
  PUBLIC_TERMS_VERSION,
  PUBLIC_TERMS_LAST_UPDATED,
  renderPublicPrivacyPolicy,
  renderPublicTermsOfService,
} from "@/lib/public-pages-content";
import {
  SECURITY_POSTURE_VERSION,
  SECURITY_POSTURE_LAST_UPDATED,
  renderSecurityPosture,
} from "@/lib/security-posture";
import DocCard, { type DocLanguage } from "./DocCard";
import LegalTabBar from "../LegalTabBar";

interface DraftSection {
  id: string;
  title: string;
  version: string;
  filenameBase: string;
  description: string;
  // Source language is the one the document was originally drafted in.
  // The other language is shown as a placeholder until translated —
  // see DocCard for how that is rendered.
  sourceLanguage: DocLanguage;
  text: { is: string | null; en: string | null };
}

interface DraftCategory {
  title: string;
  blurb: string;
  drafts: DraftSection[];
}

// Sample params used to render the templated B2B documents. These are
// placeholders so counsel sees the structure; real signed copies are
// generated at signing time with the actual company.
const SAMPLE_COMPANY = {
  companyName: "[Sample Company Name ehf.]",
  companyKennitala: "[123456-7890]",
};
const SAMPLE_PO = {
  ...SAMPLE_COMPANY,
  poNumber: "[PO-XXXX]",
  lineItems: [
    { description: "[Þjónusta — sample line item]", qty: 1, unit_price_isk: 0, total_isk: 0 },
  ],
  subtotalIsk: 0,
  vatIsk: 0,
  totalIsk: 0,
  billingCadence: "monthly",
  startsAt: null,
  endsAt: null,
};

export default function LegalDraftsPage() {
  const categories: DraftCategory[] = [
    {
      title: "Audit-ready security & privacy posture",
      blurb:
        "Comprehensive snapshot of every technical and organisational measure Lifeline has in place. Send this to Persónuvernd if there's an audit, to insurance underwriters, or to B2B procurement teams. Version-controlled — bump in source when you change it.",
      drafts: [
        {
          id: "security-posture",
          title: "Security & Privacy Posture Statement",
          version: `${SECURITY_POSTURE_VERSION} · updated ${SECURITY_POSTURE_LAST_UPDATED}`,
          filenameBase: `lifeline-security-posture-${SECURITY_POSTURE_VERSION}`,
          description:
            "Full inventory of legal basis, data categories, hosting, encryption, access controls, audit logging, DSR workflow, processors, breach response, DPIA, staff training, and the wellness/sjúkraskrá architecture. Maintained in src/lib/security-posture.ts — bump version + last_updated when content changes.",
          // Bilingual document: Icelandic body with English section headers.
          // Same string serves both toggles — keep as-is until a fully
          // English version of the posture statement is drafted.
          sourceLanguage: "is",
          text: { is: renderSecurityPosture(), en: renderSecurityPosture() },
        },
      ],
    },
    {
      title: "Public-facing",
      blurb:
        "Visible to anyone on the website at /privacy and /terms. Plain-text mirror shown here for review; the live styled version lives at the URL. Both must be kept in sync — see src/lib/public-pages-content.ts.",
      drafts: [
        {
          id: "privacy-policy",
          title: "Privacy Policy",
          version: `${PUBLIC_PRIVACY_VERSION} · updated ${PUBLIC_PRIVACY_LAST_UPDATED}`,
          filenameBase: `privacy-policy-${PUBLIC_PRIVACY_VERSION}`,
          description:
            "Public privacy policy at lifelinehealth.is/privacy. Plain-text mirror — styled version is at the live URL.",
          sourceLanguage: "en",
          text: { is: renderPublicPrivacyPolicy("is"), en: renderPublicPrivacyPolicy("en") },
        },
        {
          id: "terms-of-service",
          title: "Terms of Service (public)",
          version: `${PUBLIC_TERMS_VERSION} · updated ${PUBLIC_TERMS_LAST_UPDATED}`,
          filenameBase: `terms-of-service-${PUBLIC_TERMS_VERSION}`,
          description:
            "Public terms at lifelinehealth.is/terms. Plain-text mirror — styled version is at the live URL.",
          sourceLanguage: "en",
          text: { is: renderPublicTermsOfService("is"), en: renderPublicTermsOfService("en") },
        },
      ],
    },
    {
      title: "B2C / B2B onboarding click-through documents",
      blurb:
        "Documents the user / employee accepts at signup. Each acceptance is hashed + signed and stored in platform_agreement_acceptances.",
      drafts: [
        {
          id: "platform-tos",
          title: "Platform Terms of Service",
          version: TOS_VERSION,
          filenameBase: `platform-tos-${TOS_VERSION}`,
          description: "Click-through TOS for B2C clients on app signup.",
          sourceLanguage: "is",
          text: { is: renderTermsOfService("is"), en: renderTermsOfService("en") },
        },
        {
          id: "platform-dpa",
          title: "Data Processing Agreement (B2B contact persons)",
          version: DPA_VERSION,
          filenameBase: `platform-dpa-${DPA_VERSION}`,
          description: "DPA accepted by B2B contact persons during company onboarding.",
          sourceLanguage: "is",
          text: { is: renderDataProcessingAgreement("is"), en: renderDataProcessingAgreement("en") },
        },
        {
          id: "employee-tos",
          title: "Employee Terms of Service",
          version: EMPLOYEE_TOS_VERSION,
          filenameBase: `employee-tos-${EMPLOYEE_TOS_VERSION}`,
          description: "Click-through accepted by employees joining via a B2B roster.",
          sourceLanguage: "is",
          text: { is: renderEmployeeTermsOfService("is"), en: renderEmployeeTermsOfService("en") },
        },
        {
          id: "health-consent",
          title: "Health Assessment Consent",
          version: HEALTH_CONSENT_VERSION,
          filenameBase: `health-consent-${HEALTH_CONSENT_VERSION}`,
          description:
            "Explicit consent (GDPR Art. 9(2)(a)) to process Art. 9 health data — mandatory before any clinical workflow.",
          sourceLanguage: "is",
          text: { is: renderHealthAssessmentConsent("is"), en: renderHealthAssessmentConsent("en") },
        },
      ],
    },
    {
      title: "Staff / employment click-through documents",
      blurb:
        "Documents every team member signs at onboarding. Drives the /admin/onboard flow; required-by-role matrix in staff-terms-content.ts.",
      drafts: [
        {
          id: "staff-nda",
          title: "Staff NDA (Trúnaðarsamningur)",
          version: STAFF_NDA_VERSION,
          filenameBase: `staff-nda-${STAFF_NDA_VERSION}`,
          description: "Required for every staff member regardless of role.",
          sourceLanguage: "is",
          text: { is: renderStaffNDA("is"), en: renderStaffNDA("en") },
        },
        {
          id: "staff-confidentiality",
          title: "Healthcare Confidentiality (Þagnarskylda)",
          version: STAFF_CONFIDENTIALITY_VERSION,
          filenameBase: `staff-confidentiality-${STAFF_CONFIDENTIALITY_VERSION}`,
          description:
            "Statutory healthcare confidentiality declaration under Lög 34/2012 + 74/1997. Required for clinicians (doctor / nurse / psychologist).",
          sourceLanguage: "is",
          text: { is: renderStaffConfidentiality("is"), en: renderStaffConfidentiality("en") },
        },
        {
          id: "staff-acceptable-use",
          title: "Acceptable Use (Tækjareglur)",
          version: STAFF_ACCEPTABLE_USE_VERSION,
          filenameBase: `staff-acceptable-use-${STAFF_ACCEPTABLE_USE_VERSION}`,
          description: "Device + access policy. Required for every staff member.",
          sourceLanguage: "is",
          text: { is: renderStaffAcceptableUse("is"), en: renderStaffAcceptableUse("en") },
        },
        {
          id: "staff-data-protection",
          title: "Data Protection Briefing (Persónuverndarfræðsla)",
          version: STAFF_DATA_PROTECTION_VERSION,
          filenameBase: `staff-data-protection-${STAFF_DATA_PROTECTION_VERSION}`,
          description: "GDPR / Lög 90/2018 briefing. Required for every staff member.",
          sourceLanguage: "is",
          text: { is: renderStaffDataProtectionBriefing("is"), en: renderStaffDataProtectionBriefing("en") },
        },
        {
          id: "staff-onboarding-checklist",
          title: "Operational Onboarding Checklist (Móttökugátlisti)",
          version: STAFF_ONBOARDING_CHECKLIST_VERSION,
          filenameBase: `staff-onboarding-checklist-${STAFF_ONBOARDING_CHECKLIST_VERSION}`,
          description:
            "Day-one operational rules: where data lives, what's allowed in coaching messages, incident reporting, offboarding. Required for every staff member.",
          sourceLanguage: "is",
          text: { is: renderStaffOnboardingChecklist("is"), en: renderStaffOnboardingChecklist("en") },
        },
        {
          id: "staff-piece-rate",
          title: "Piece-rate Employment (Lausráðningarsamningur)",
          version: STAFF_PIECE_RATE_EMPLOYMENT_VERSION,
          filenameBase: `staff-piece-rate-${STAFF_PIECE_RATE_EMPLOYMENT_VERSION}`,
          description:
            "Click-through employment contract for clinicians paid per measurement. Lifeline as employer of record.",
          sourceLanguage: "is",
          text: { is: renderStaffPieceRateEmployment("is"), en: renderStaffPieceRateEmployment("en") },
        },
        {
          id: "staff-contractor",
          title: "Contractor Agreement (Verktakasamningur)",
          version: STAFF_CONTRACTOR_VERSION,
          filenameBase: `staff-contractor-${STAFF_CONTRACTOR_VERSION}`,
          description:
            "Click-through contractor agreement for genuinely independent contractors (not used for clinicians by default).",
          sourceLanguage: "is",
          text: { is: renderStaffContractorAgreement("is"), en: renderStaffContractorAgreement("en") },
        },
      ],
    },
    {
      title: "B2B service agreement templates",
      blurb:
        "Templates filled with company-specific values when a B2B engagement is signed. The placeholder values below are samples — counsel should review the structure.",
      drafts: [
        {
          id: "thjonustuskilmalar",
          title: "Klínískir skilmálar heilsumats (B2B service terms)",
          version: THJONUSTUSKILMALAR_VERSION,
          filenameBase: `thjonustuskilmalar-${THJONUSTUSKILMALAR_VERSION}`,
          description: "Generic clinical service terms attached to every B2B service agreement.",
          sourceLanguage: "is",
          text: { is: renderThjonustuskilmalar("is"), en: renderThjonustuskilmalar("en") },
        },
        {
          id: "thjonustusamningur",
          title: "Þjónustusamningur (B2B service agreement template)",
          version: THJONUSTUSAMNINGUR_VERSION,
          filenameBase: `thjonustusamningur-${THJONUSTUSAMNINGUR_VERSION}`,
          description:
            "Per-company B2B service agreement. Rendered here with placeholder company name + kennitala.",
          sourceLanguage: "is",
          text: { is: renderThjonustusamningur(SAMPLE_COMPANY, "is"), en: renderThjonustusamningur(SAMPLE_COMPANY, "en") },
        },
        {
          id: "purchase-order",
          title: "Purchase Order template",
          version: "v1.0",
          filenameBase: "purchase-order-template",
          description:
            "Per-engagement PO attached as appendix to the service agreement. Placeholder line items.",
          sourceLanguage: "is",
          text: { is: renderPurchaseOrder(SAMPLE_PO, "is"), en: renderPurchaseOrder(SAMPLE_PO, "en") },
        },
      ],
    },
    {
      title: "Processor / joint-controller arrangements",
      blurb:
        "Arrangements with third parties that touch personal data on Lifeline's behalf.",
      drafts: [
        {
          id: "medalia-joint-controller",
          title: "Medalia joint-controller arrangement",
          version: MEDALIA_JOINT_CONTROLLER_VERSION,
          filenameBase: `medalia-joint-controller-${MEDALIA_JOINT_CONTROLLER_VERSION}`,
          description:
            "GDPR Art. 26 joint-controller arrangement for sjúkraskrá-grade health record data. Lawyer note: Lifeline already has a separate vinnslusamningur (DPA) with Medalia — review whether this Art. 26 arrangement supplements that, or whether the existing DPA covers the relationship sufficiently.",
          sourceLanguage: "is",
          text: { is: renderMedaliaJointControllerArrangement("is"), en: renderMedaliaJointControllerArrangement("en") },
        },
        {
          id: "biody-dpa",
          title: "Biody Manager DPA",
          version: BIODY_DPA_VERSION,
          filenameBase: `biody-dpa-${BIODY_DPA_VERSION}`,
          description:
            "GDPR Art. 28 DPA with Aminogram SAS (Biody Manager). Lifeline operates the Biody account + API integration but Biody's infrastructure stores client measurements — that storage activity makes Biody a processor regardless of who controls the workflow. Standard SaaS pattern.",
          sourceLanguage: "is",
          text: { is: renderBiodyDPA("is"), en: renderBiodyDPA("en") },
        },
        {
          id: "dpia-interim",
          title: "DPIA — wellness-mode interim",
          version: DPIA_INTERIM_VERSION,
          filenameBase: `dpia-interim-${DPIA_INTERIM_VERSION}`,
          description:
            "DPIA under GDPR Art. 35 / Lög 90/2018 §29 covering the current wellness-mode interim architecture. Signed by the persónuverndarfulltrúi (DPO).",
          sourceLanguage: "is",
          text: { is: renderDPIAInterim("is"), en: renderDPIAInterim("en") },
        },
      ],
    },
    {
      title: "Client consent texts",
      blurb:
        "Specific consent strings the user accepts when toggling app-level controls. The exact text is hashed into client_consents at consent time.",
      drafts: [
        {
          id: "client-consent-biody-import",
          title: "Biody import consent (in-app toggle)",
          version: CLIENT_CONSENT_BIODY_IMPORT_VERSION,
          filenameBase: `client-consent-biody-import-${CLIENT_CONSENT_BIODY_IMPORT_VERSION}`,
          description:
            "Plain-language consent shown when a user opts in to syncing their Biody body composition into the app dashboard.",
          sourceLanguage: "is",
          text: { is: renderClientConsentBiodyImport("is"), en: renderClientConsentBiodyImport("en") },
        },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <LegalTabBar />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Documents</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed">
            Every legal document Lifeline maintains, organised by category. Send to counsel
            for review using Copy or Download, or have them sign off in-app. Signed copies
            of click-through acceptances live under the{" "}
            <Link href="/admin/legal" className="underline underline-offset-2">Signed acceptances</Link> tab.
          </p>
        </div>
        <a
          href="https://github.com/madsinski/lifeline-website/blob/main/supabase/runbooks/sprint1-2-followup.md"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
        >
          Sign-off runbook ↗
        </a>
      </div>

      {/* Quick category index */}
      <nav className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Jump to</p>
        <ul className="space-y-1.5">
          {categories.map((c) => (
            <li key={c.title}>
              <a href={`#cat-${c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                 className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2">
                {c.title}
              </a>
              <span className="text-gray-400 ml-2">({c.drafts.length})</span>
            </li>
          ))}
        </ul>
      </nav>

      {categories.map((cat) => (
        <div key={cat.title} id={`cat-${cat.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1F2937]">{cat.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">{cat.blurb}</p>
          </div>
          {cat.drafts.map((d) => (
            <DocCard
              key={d.id}
              id={d.id}
              title={d.title}
              version={d.version}
              filenameBase={d.filenameBase}
              description={d.description}
              sourceLanguage={d.sourceLanguage}
              text={d.text}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
