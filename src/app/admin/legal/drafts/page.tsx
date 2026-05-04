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
  SECURITY_POSTURE_VERSION,
  SECURITY_POSTURE_LAST_UPDATED,
  renderSecurityPosture,
} from "@/lib/security-posture";
import CopyButton from "./CopyButton";
import DocReviewPanel from "./DocReviewPanel";

interface DraftSection {
  id: string;
  title: string;
  version: string;
  filename: string;
  description: string;
  text: string;
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
          filename: `lifeline-security-posture-${SECURITY_POSTURE_VERSION}.txt`,
          description:
            "Full inventory of legal basis, data categories, hosting, encryption, access controls, audit logging, DSR workflow, processors, breach response, DPIA, staff training, and the wellness/sjúkraskrá architecture. Maintained in src/lib/security-posture.ts — bump version + last_updated when content changes.",
          text: renderSecurityPosture(),
        },
      ],
    },
    {
      title: "Public-facing",
      blurb: "Visible to anyone on the website. Already published — counsel may suggest copy edits.",
      drafts: [
        {
          id: "privacy-policy",
          title: "Privacy Policy",
          version: "v1.4",
          filename: "privacy-policy-v1.4.html",
          description:
            "Public privacy policy at /privacy. Lawyer should review the published page directly: this list links to it.",
          text: "(JSX page — open https://www.lifelinehealth.is/privacy or src/app/privacy/page.tsx in the repo to read the full content)",
        },
        {
          id: "terms-of-service",
          title: "Terms of Service (public)",
          version: "current",
          filename: "terms-public.html",
          description:
            "Public terms at /terms. Lawyer should review the published page directly.",
          text: "(JSX page — open https://www.lifelinehealth.is/terms or src/app/terms/page.tsx in the repo)",
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
          filename: `platform-tos-${TOS_VERSION}.txt`,
          description: "Click-through TOS for B2C clients on app signup.",
          text: renderTermsOfService(),
        },
        {
          id: "platform-dpa",
          title: "Data Processing Agreement (B2B contact persons)",
          version: DPA_VERSION,
          filename: `platform-dpa-${DPA_VERSION}.txt`,
          description: "DPA accepted by B2B contact persons during company onboarding.",
          text: renderDataProcessingAgreement(),
        },
        {
          id: "employee-tos",
          title: "Employee Terms of Service",
          version: EMPLOYEE_TOS_VERSION,
          filename: `employee-tos-${EMPLOYEE_TOS_VERSION}.txt`,
          description: "Click-through accepted by employees joining via a B2B roster.",
          text: renderEmployeeTermsOfService(),
        },
        {
          id: "health-consent",
          title: "Health Assessment Consent",
          version: HEALTH_CONSENT_VERSION,
          filename: `health-consent-${HEALTH_CONSENT_VERSION}.txt`,
          description:
            "Explicit consent (GDPR Art. 9(2)(a)) to process Art. 9 health data — mandatory before any clinical workflow.",
          text: renderHealthAssessmentConsent(),
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
          filename: `staff-nda-${STAFF_NDA_VERSION}.txt`,
          description: "Required for every staff member regardless of role.",
          text: renderStaffNDA(),
        },
        {
          id: "staff-confidentiality",
          title: "Healthcare Confidentiality (Þagnarskylda)",
          version: STAFF_CONFIDENTIALITY_VERSION,
          filename: `staff-confidentiality-${STAFF_CONFIDENTIALITY_VERSION}.txt`,
          description:
            "Statutory healthcare confidentiality declaration under Lög 34/2012 + 74/1997. Required for clinicians (doctor / nurse / psychologist).",
          text: renderStaffConfidentiality(),
        },
        {
          id: "staff-acceptable-use",
          title: "Acceptable Use (Tækjareglur)",
          version: STAFF_ACCEPTABLE_USE_VERSION,
          filename: `staff-acceptable-use-${STAFF_ACCEPTABLE_USE_VERSION}.txt`,
          description: "Device + access policy. Required for every staff member.",
          text: renderStaffAcceptableUse(),
        },
        {
          id: "staff-data-protection",
          title: "Data Protection Briefing (Persónuverndarfræðsla)",
          version: STAFF_DATA_PROTECTION_VERSION,
          filename: `staff-data-protection-${STAFF_DATA_PROTECTION_VERSION}.txt`,
          description: "GDPR / Lög 90/2018 briefing. Required for every staff member.",
          text: renderStaffDataProtectionBriefing(),
        },
        {
          id: "staff-onboarding-checklist",
          title: "Operational Onboarding Checklist (Móttökugátlisti)",
          version: STAFF_ONBOARDING_CHECKLIST_VERSION,
          filename: `staff-onboarding-checklist-${STAFF_ONBOARDING_CHECKLIST_VERSION}.txt`,
          description:
            "Day-one operational rules: where data lives, what's allowed in coaching messages, incident reporting, offboarding. Required for every staff member.",
          text: renderStaffOnboardingChecklist(),
        },
        {
          id: "staff-piece-rate",
          title: "Piece-rate Employment (Lausráðningarsamningur)",
          version: STAFF_PIECE_RATE_EMPLOYMENT_VERSION,
          filename: `staff-piece-rate-${STAFF_PIECE_RATE_EMPLOYMENT_VERSION}.txt`,
          description:
            "Click-through employment contract for clinicians paid per measurement. Lifeline as employer of record.",
          text: renderStaffPieceRateEmployment(),
        },
        {
          id: "staff-contractor",
          title: "Contractor Agreement (Verktakasamningur)",
          version: STAFF_CONTRACTOR_VERSION,
          filename: `staff-contractor-${STAFF_CONTRACTOR_VERSION}.txt`,
          description:
            "Click-through contractor agreement for genuinely independent contractors (not used for clinicians by default).",
          text: renderStaffContractorAgreement(),
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
          filename: `thjonustuskilmalar-${THJONUSTUSKILMALAR_VERSION}.txt`,
          description: "Generic clinical service terms attached to every B2B service agreement.",
          text: renderThjonustuskilmalar(),
        },
        {
          id: "thjonustusamningur",
          title: "Þjónustusamningur (B2B service agreement template)",
          version: THJONUSTUSAMNINGUR_VERSION,
          filename: `thjonustusamningur-${THJONUSTUSAMNINGUR_VERSION}.txt`,
          description:
            "Per-company B2B service agreement. Rendered here with placeholder company name + kennitala.",
          text: renderThjonustusamningur(SAMPLE_COMPANY),
        },
        {
          id: "purchase-order",
          title: "Purchase Order template",
          version: "v1.0",
          filename: "purchase-order-template.txt",
          description:
            "Per-engagement PO attached as appendix to the service agreement. Placeholder line items.",
          text: renderPurchaseOrder(SAMPLE_PO),
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
          filename: `medalia-joint-controller-${MEDALIA_JOINT_CONTROLLER_VERSION}.txt`,
          description:
            "GDPR Art. 26 joint-controller arrangement for sjúkraskrá-grade health record data. Lawyer note: Lifeline already has a separate vinnslusamningur (DPA) with Medalia — review whether this Art. 26 arrangement supplements that, or whether the existing DPA covers the relationship sufficiently.",
          text: renderMedaliaJointControllerArrangement(),
        },
        {
          id: "biody-dpa",
          title: "Biody Manager DPA",
          version: BIODY_DPA_VERSION,
          filename: `biody-dpa-${BIODY_DPA_VERSION}.txt`,
          description:
            "GDPR Art. 28 DPA with Aminogram SAS (Biody Manager). Lifeline operates the Biody account + API integration but Biody's infrastructure stores client measurements — that storage activity makes Biody a processor regardless of who controls the workflow. Standard SaaS pattern.",
          text: renderBiodyDPA(),
        },
        {
          id: "dpia-interim",
          title: "DPIA — wellness-mode interim",
          version: DPIA_INTERIM_VERSION,
          filename: `dpia-interim-${DPIA_INTERIM_VERSION}.txt`,
          description:
            "DPIA under GDPR Art. 35 / Lög 90/2018 §29 covering the current wellness-mode interim architecture. Signed by the persónuverndarfulltrúi (DPO).",
          text: renderDPIAInterim(),
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
          filename: `client-consent-biody-import-${CLIENT_CONSENT_BIODY_IMPORT_VERSION}.txt`,
          description:
            "Plain-language consent shown when a user opts in to syncing their Biody body composition into the app dashboard.",
          text: renderClientConsentBiodyImport(),
        },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Legal drafts</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed">
            Every legal document Lifeline maintains, organised by category. Send to counsel
            for review using Copy or Download. Once signed, store executed PDFs under{" "}
            <Link href="/admin/legal" className="underline underline-offset-2">Legal &amp; agreements</Link>.
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
          {cat.drafts.map((d) => {
            const dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(d.text);
            return (
              <section key={d.id} id={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <header className="border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-base font-semibold text-[#1F2937]">
                      {d.title} <span className="text-xs font-normal text-gray-400 ml-1">{d.version}</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">{d.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={d.text} />
                    <a
                      href={dataUrl}
                      download={d.filename}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                      Download .txt
                    </a>
                  </div>
                </header>
                <pre className="px-5 py-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50/30 max-h-[420px] overflow-y-auto">
                  {d.text}
                </pre>
                <DocReviewPanel
                  documentKey={d.id}
                  documentVersion={d.version}
                  documentTitle={d.title}
                  documentText={d.text}
                />
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}
