// Single source of truth for every legal document Lifeline maintains,
// used by BOTH the admin review page (/admin/legal/drafts) and the
// no-login external-counsel link (/legal-review/[token]).
//
// Each document is tagged with:
//   - location: where the document primarily lives / is used
//       website | b2c | b2b | app | other
//   - approval: one line describing what acceptance / sign-off the
//       document requires from the end party (user, employee, company
//       signatory, staff member, processor, or "none — published").
//
// The draft-override mechanism (an admin- or lawyer-pasted revision in
// legal_document_drafts) is applied here so both views show the latest
// text. Reads degrade gracefully if a table is missing.
//
// SERVER ONLY — imports supabase-admin. Do not import from a
// "use client" component; the pages resolve everything to strings and
// pass those down as props.

import { supabaseAdmin } from "@/lib/supabase-admin";
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
  INDIVIDUAL_THJONUSTUSKILMALAR_VERSION,
  INDIVIDUAL_HEALTH_CONSENT_VERSION,
  INDIVIDUAL_PRIVACY_VERSION,
  INDIVIDUAL_QUALITY_CONSENT_VERSION,
  renderIndividualThjonustuskilmalar,
  renderIndividualHealthConsent,
  renderIndividualPrivacyPolicy,
  renderIndividualQualityResearchConsent,
} from "@/lib/individual-assessment-content";
import {
  PUBLIC_PRIVACY_VERSION,
  PUBLIC_PRIVACY_LAST_UPDATED,
  PUBLIC_TERMS_VERSION,
  PUBLIC_TERMS_LAST_UPDATED,
  PUBLIC_SALES_TERMS_VERSION,
  PUBLIC_SALES_TERMS_LAST_UPDATED,
  renderPublicPrivacyPolicy,
  renderPublicTermsOfService,
  renderPublicSalesTerms,
} from "@/lib/public-pages-content";
import {
  SECURITY_POSTURE_VERSION,
  SECURITY_POSTURE_LAST_UPDATED,
  renderSecurityPosture,
} from "@/lib/security-posture";

export type DocLanguage = "is" | "en";
export type DocLocation = "website" | "b2c" | "b2b" | "app" | "other";

export interface DraftMeta {
  proposed_version: string;
  edited_by_email: string;
  edited_by_name: string | null;
  created_at: string;
  source_note: string | null;
  text_hash: string;
  edited_via?: string;
}

export interface ResolvedDoc {
  id: string;
  title: string;
  version: string;
  filenameBase: string;
  description: string;
  sourceLanguage: DocLanguage;
  location: DocLocation;
  approval: string;
  text: { is: string | null; en: string | null };
  drafts: { is: DraftMeta | null; en: DraftMeta | null };
}

export interface LocationGroup {
  location: DocLocation;
  title: string;
  blurb: string;
  docs: ResolvedDoc[];
}

// Human-readable header + explanation for each location bucket.
export const LOCATION_META: Record<DocLocation, { title: string; blurb: string }> = {
  website: {
    title: "Website — public pages",
    blurb:
      "Published on lifelinehealth.is and readable by anyone. No signature is collected on the page itself (the sales terms are additionally accepted at checkout). Counsel review recommended; keep in sync with src/lib/public-pages-content.ts.",
  },
  b2c: {
    title: "B2C — individual (self-pay) documents",
    blurb:
      "The direct-to-individual health-assessment set: a person who buys the heilsumat themselves (no employer). Accepted by the individual at booking / before the clinical workflow. Source in src/lib/individual-assessment-content.ts.",
  },
  b2b: {
    title: "B2B — company (employer-sponsored) documents",
    blurb:
      "Documents in the employer-sponsored pathway: signed by a company signatory or contact person, or click-through-accepted by employees joining via a company roster. Templates are filled with company-specific values at signing.",
  },
  app: {
    title: "App — in-app click-through consents",
    blurb:
      "Click-through documents the end user accepts inside the Lifeline app. Each acceptance is hashed + stored (platform_agreement_acceptances / client_consents). Changing the text requires a version bump so the acceptance hash stays meaningful.",
  },
  other: {
    title: "Other — internal, staff & processor arrangements",
    blurb:
      "Everything not user-facing: the internal compliance posture, staff/employment click-throughs signed at onboarding, and processor / joint-controller arrangements signed by third parties that touch data on Lifeline's behalf.",
  },
};

// Fixed display order of the location groups.
export const LOCATION_ORDER: DocLocation[] = ["website", "b2c", "b2b", "app", "other"];

// Sample params for the templated B2B documents — placeholders so
// counsel sees the structure; real signed copies use the actual company.
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

// The raw, un-overlaid document definitions. Order within a location
// is the display order.
interface RawDoc {
  id: string;
  title: string;
  version: string;
  filenameBase: string;
  description: string;
  sourceLanguage: DocLanguage;
  location: DocLocation;
  approval: string;
  text: { is: string | null; en: string | null };
}

function rawDocs(): RawDoc[] {
  return [
    // ─────────── website ───────────
    {
      id: "privacy-policy",
      title: "Privacy Policy",
      version: `${PUBLIC_PRIVACY_VERSION} · updated ${PUBLIC_PRIVACY_LAST_UPDATED}`,
      filenameBase: `privacy-policy-${PUBLIC_PRIVACY_VERSION}`,
      description: "Public privacy policy at lifelinehealth.is/privacy. Plain-text mirror — styled version is at the live URL.",
      sourceLanguage: "en",
      location: "website",
      approval: "Published — no user acceptance collected. Counsel review recommended.",
      text: { is: renderPublicPrivacyPolicy("is"), en: renderPublicPrivacyPolicy("en") },
    },
    {
      id: "terms-of-service",
      title: "Terms of Service (public)",
      version: `${PUBLIC_TERMS_VERSION} · updated ${PUBLIC_TERMS_LAST_UPDATED}`,
      filenameBase: `terms-of-service-${PUBLIC_TERMS_VERSION}`,
      description: "Public terms at lifelinehealth.is/terms. Plain-text mirror — styled version is at the live URL.",
      sourceLanguage: "en",
      location: "website",
      approval: "Published — no user acceptance collected. Counsel review recommended.",
      text: { is: renderPublicTermsOfService("is"), en: renderPublicTermsOfService("en") },
    },
    {
      id: "sales-terms",
      title: "Söluskilmálar / Sales & Subscription Terms (B2C)",
      version: `${PUBLIC_SALES_TERMS_VERSION} · updated ${PUBLIC_SALES_TERMS_LAST_UPDATED}`,
      filenameBase: `sales-terms-${PUBLIC_SALES_TERMS_VERSION}`,
      description:
        "B2C purchase + subscription terms required by Straumur and Icelandic consumer law. Live at /soluskilmalar (IS, binding) and /sales-terms (EN). Covers seller identity, VAT-exempt pricing, auto-renewal, 14-day cooling-off with the digital-service exception (Act 16/2016 §18(1)(d)), refunds and complaints.",
      sourceLanguage: "is",
      location: "website",
      approval: "Accepted by the buyer at Straumur checkout (click-through) + published on site.",
      text: { is: renderPublicSalesTerms("is"), en: renderPublicSalesTerms("en") },
    },

    // ─────────── b2c ───────────
    {
      id: "individual-thjonustuskilmalar",
      title: "Þjónustuskilmálar — heilsumat einstaklinga (B2C)",
      version: INDIVIDUAL_THJONUSTUSKILMALAR_VERSION,
      filenameBase: `individual-thjonustuskilmalar-${INDIVIDUAL_THJONUSTUSKILMALAR_VERSION}`,
      description:
        "B2C service terms for the self-pay individual assessment (Lyfja Smáratorg measurements / Sameind blood tests / phone-video-in-person doctor). Lawyer note: (1) §5 drafts Sameind ehf. as an INDEPENDENT controller for the lab analysis — flip to processor if the contract says so; (2) §3(b) assumes Lifeline staffs the measurement station at Lyfja — reword if Lyfja staff take the measurements.",
      sourceLanguage: "is",
      location: "b2c",
      approval: "Accepted by the individual at booking / checkout (click-through).",
      text: { is: renderIndividualThjonustuskilmalar("is"), en: renderIndividualThjonustuskilmalar("en") },
    },
    {
      id: "individual-health-consent",
      title: "Upplýst samþykki — heilsumat einstaklinga (B2C)",
      version: INDIVIDUAL_HEALTH_CONSENT_VERSION,
      filenameBase: `individual-health-consent-${INDIVIDUAL_HEALTH_CONSENT_VERSION}`,
      description:
        "Informed consent (GDPR Art. 9(2)(a)) the individual accepts before any clinical workflow. Explicit lines for the Sameind blood draw + analysis and the phone/video/in-person doctor consultation.",
      sourceLanguage: "is",
      location: "b2c",
      approval: "Explicit consent — individual accepts before the clinical workflow begins.",
      text: { is: renderIndividualHealthConsent("is"), en: renderIndividualHealthConsent("en") },
    },
    {
      id: "individual-privacy",
      title: "Persónuverndarstefna — heilsumat einstaklinga (B2C)",
      version: INDIVIDUAL_PRIVACY_VERSION,
      filenameBase: `individual-privacy-${INDIVIDUAL_PRIVACY_VERSION}`,
      description:
        "Privacy policy for the individual assessment. §4 covers delivery through partners (Lyfja station + Sameind). Keep the Sameind role consistent with §5 of the þjónustuskilmálar.",
      sourceLanguage: "is",
      location: "b2c",
      approval: "Provided to the individual for information — no signature required.",
      text: { is: renderIndividualPrivacyPolicy("is"), en: renderIndividualPrivacyPolicy("en") },
    },
    {
      id: "individual-quality-consent",
      title: "Samþykki fyrir rannsókn / gæðamati — einstaklingar (B2C)",
      version: INDIVIDUAL_QUALITY_CONSENT_VERSION,
      filenameBase: `individual-quality-consent-${INDIVIDUAL_QUALITY_CONSENT_VERSION}`,
      description:
        "Separate, optional informed consent to use non-identifiable assessment data for internal quality assurance and service development. Ábyrgðarmaður: Guðmundur Vignir Sigurðsson, MD, PhD.",
      sourceLanguage: "is",
      location: "b2c",
      approval: "Optional opt-in — individual may decline; declining does not affect care.",
      text: { is: renderIndividualQualityResearchConsent("is"), en: renderIndividualQualityResearchConsent("en") },
    },

    // ─────────── b2b ───────────
    {
      id: "platform-dpa",
      title: "Data Processing Agreement (B2B contact persons)",
      version: DPA_VERSION,
      filenameBase: `platform-dpa-${DPA_VERSION}`,
      description: "DPA accepted by B2B contact persons during company onboarding.",
      sourceLanguage: "is",
      location: "b2b",
      approval: "Click-through accepted by the company contact person at onboarding.",
      text: { is: renderDataProcessingAgreement("is"), en: renderDataProcessingAgreement("en") },
    },
    {
      id: "employee-tos",
      title: "Employee Terms of Service",
      version: EMPLOYEE_TOS_VERSION,
      filenameBase: `employee-tos-${EMPLOYEE_TOS_VERSION}`,
      description: "Click-through accepted by employees joining via a B2B roster.",
      sourceLanguage: "is",
      location: "b2b",
      approval: "Click-through accepted by each employee joining via a company roster.",
      text: { is: renderEmployeeTermsOfService("is"), en: renderEmployeeTermsOfService("en") },
    },
    {
      id: "thjonustuskilmalar",
      title: "Klínískir skilmálar heilsumats (B2B service terms)",
      version: THJONUSTUSKILMALAR_VERSION,
      filenameBase: `thjonustuskilmalar-${THJONUSTUSKILMALAR_VERSION}`,
      description: "Generic clinical service terms attached to every B2B service agreement.",
      sourceLanguage: "is",
      location: "b2b",
      approval: "Counsel-reviewed template; attached to every signed B2B service agreement.",
      text: { is: renderThjonustuskilmalar("is"), en: renderThjonustuskilmalar("en") },
    },
    {
      id: "thjonustusamningur",
      title: "Þjónustusamningur (B2B service agreement template)",
      version: THJONUSTUSAMNINGUR_VERSION,
      filenameBase: `thjonustusamningur-${THJONUSTUSAMNINGUR_VERSION}`,
      description: "Per-company B2B service agreement. Rendered here with placeholder company name + kennitala.",
      sourceLanguage: "is",
      location: "b2b",
      approval: "Signed by the company signatory per engagement.",
      text: { is: renderThjonustusamningur(SAMPLE_COMPANY, "is"), en: renderThjonustusamningur(SAMPLE_COMPANY, "en") },
    },
    {
      id: "purchase-order",
      title: "Purchase Order template",
      version: "v1.0",
      filenameBase: "purchase-order-template",
      description: "Per-engagement PO attached as appendix to the service agreement. Placeholder line items.",
      sourceLanguage: "is",
      location: "b2b",
      approval: "Signed as an annex to the service agreement per engagement.",
      text: { is: renderPurchaseOrder(SAMPLE_PO, "is"), en: renderPurchaseOrder(SAMPLE_PO, "en") },
    },

    // ─────────── app ───────────
    {
      id: "platform-tos",
      title: "Platform Terms of Service",
      version: TOS_VERSION,
      filenameBase: `platform-tos-${TOS_VERSION}`,
      description: "Click-through TOS for B2C clients on app signup.",
      sourceLanguage: "is",
      location: "app",
      approval: "Click-through at app signup; hashed into platform_agreement_acceptances.",
      text: { is: renderTermsOfService("is"), en: renderTermsOfService("en") },
    },
    {
      id: "health-consent",
      title: "Health Assessment Consent",
      version: HEALTH_CONSENT_VERSION,
      filenameBase: `health-consent-${HEALTH_CONSENT_VERSION}`,
      description: "Explicit consent (GDPR Art. 9(2)(a)) to process Art. 9 health data — mandatory before any clinical workflow.",
      sourceLanguage: "is",
      location: "app",
      approval: "Explicit click-through consent before any clinical workflow (GDPR Art. 9).",
      text: { is: renderHealthAssessmentConsent("is"), en: renderHealthAssessmentConsent("en") },
    },
    {
      id: "client-consent-biody-import",
      title: "Biody import consent (in-app toggle)",
      version: CLIENT_CONSENT_BIODY_IMPORT_VERSION,
      filenameBase: `client-consent-biody-import-${CLIENT_CONSENT_BIODY_IMPORT_VERSION}`,
      description: "Plain-language consent shown when a user opts in to syncing their Biody body composition into the app dashboard.",
      sourceLanguage: "is",
      location: "app",
      approval: "In-app opt-in toggle; exact text hashed into client_consents at consent time.",
      text: { is: renderClientConsentBiodyImport("is"), en: renderClientConsentBiodyImport("en") },
    },

    // ─────────── other ───────────
    {
      id: "security-posture",
      title: "Security & Privacy Posture Statement",
      version: `${SECURITY_POSTURE_VERSION} · updated ${SECURITY_POSTURE_LAST_UPDATED}`,
      filenameBase: `lifeline-security-posture-${SECURITY_POSTURE_VERSION}`,
      description:
        "Full inventory of legal basis, data categories, hosting, encryption, access controls, audit logging, DSR workflow, processors, breach response, DPIA and staff training. Maintained in src/lib/security-posture.ts — bump version + last_updated when content changes.",
      sourceLanguage: "is",
      location: "other",
      approval: "Internal — DPO-maintained. No external sign-off; send to Persónuvernd / procurement on request.",
      text: { is: renderSecurityPosture(), en: renderSecurityPosture() },
    },
    {
      id: "staff-nda",
      title: "Staff NDA (Trúnaðarsamningur)",
      version: STAFF_NDA_VERSION,
      filenameBase: `staff-nda-${STAFF_NDA_VERSION}`,
      description: "Required for every staff member regardless of role.",
      sourceLanguage: "is",
      location: "other",
      approval: "Signed by every staff member at onboarding.",
      text: { is: renderStaffNDA("is"), en: renderStaffNDA("en") },
    },
    {
      id: "staff-confidentiality",
      title: "Healthcare Confidentiality (Þagnarskylda)",
      version: STAFF_CONFIDENTIALITY_VERSION,
      filenameBase: `staff-confidentiality-${STAFF_CONFIDENTIALITY_VERSION}`,
      description: "Statutory healthcare confidentiality declaration under Lög 34/2012 + 74/1997. Required for clinicians.",
      sourceLanguage: "is",
      location: "other",
      approval: "Signed by clinicians (doctor / nurse / psychologist) at onboarding.",
      text: { is: renderStaffConfidentiality("is"), en: renderStaffConfidentiality("en") },
    },
    {
      id: "staff-acceptable-use",
      title: "Acceptable Use (Tækjareglur)",
      version: STAFF_ACCEPTABLE_USE_VERSION,
      filenameBase: `staff-acceptable-use-${STAFF_ACCEPTABLE_USE_VERSION}`,
      description: "Device + access policy. Required for every staff member.",
      sourceLanguage: "is",
      location: "other",
      approval: "Signed by every staff member at onboarding.",
      text: { is: renderStaffAcceptableUse("is"), en: renderStaffAcceptableUse("en") },
    },
    {
      id: "staff-data-protection",
      title: "Data Protection Briefing (Persónuverndarfræðsla)",
      version: STAFF_DATA_PROTECTION_VERSION,
      filenameBase: `staff-data-protection-${STAFF_DATA_PROTECTION_VERSION}`,
      description: "GDPR / Lög 90/2018 briefing. Required for every staff member.",
      sourceLanguage: "is",
      location: "other",
      approval: "Signed by every staff member at onboarding.",
      text: { is: renderStaffDataProtectionBriefing("is"), en: renderStaffDataProtectionBriefing("en") },
    },
    {
      id: "staff-onboarding-checklist",
      title: "Operational Onboarding Checklist (Móttökugátlisti)",
      version: STAFF_ONBOARDING_CHECKLIST_VERSION,
      filenameBase: `staff-onboarding-checklist-${STAFF_ONBOARDING_CHECKLIST_VERSION}`,
      description: "Day-one operational rules: where data lives, coaching-message limits, incident reporting, offboarding.",
      sourceLanguage: "is",
      location: "other",
      approval: "Signed by every staff member at onboarding.",
      text: { is: renderStaffOnboardingChecklist("is"), en: renderStaffOnboardingChecklist("en") },
    },
    {
      id: "staff-piece-rate",
      title: "Piece-rate Employment (Lausráðningarsamningur)",
      version: STAFF_PIECE_RATE_EMPLOYMENT_VERSION,
      filenameBase: `staff-piece-rate-${STAFF_PIECE_RATE_EMPLOYMENT_VERSION}`,
      description: "Click-through employment contract for clinicians paid per measurement. Lifeline as employer of record.",
      sourceLanguage: "is",
      location: "other",
      approval: "Signed by clinicians paid per measurement.",
      text: { is: renderStaffPieceRateEmployment("is"), en: renderStaffPieceRateEmployment("en") },
    },
    {
      id: "staff-contractor",
      title: "Contractor Agreement (Verktakasamningur)",
      version: STAFF_CONTRACTOR_VERSION,
      filenameBase: `staff-contractor-${STAFF_CONTRACTOR_VERSION}`,
      description: "Click-through contractor agreement for genuinely independent contractors (not used for clinicians by default).",
      sourceLanguage: "is",
      location: "other",
      approval: "Signed by genuinely independent contractors.",
      text: { is: renderStaffContractorAgreement("is"), en: renderStaffContractorAgreement("en") },
    },
    {
      id: "medalia-joint-controller",
      title: "Medalia joint-controller arrangement",
      version: MEDALIA_JOINT_CONTROLLER_VERSION,
      filenameBase: `medalia-joint-controller-${MEDALIA_JOINT_CONTROLLER_VERSION}`,
      description:
        "GDPR Art. 26 joint-controller arrangement for sjúkraskrá-grade health record data. Lawyer note: review whether this supplements the existing vinnslusamningur (DPA) with Medalia or whether the DPA suffices.",
      sourceLanguage: "is",
      location: "other",
      approval: "Signed by Medalia ehf. (Art. 26 joint controller).",
      text: { is: renderMedaliaJointControllerArrangement("is"), en: renderMedaliaJointControllerArrangement("en") },
    },
    {
      id: "biody-dpa",
      title: "Biody Manager DPA",
      version: BIODY_DPA_VERSION,
      filenameBase: `biody-dpa-${BIODY_DPA_VERSION}`,
      description:
        "GDPR Art. 28 DPA with Aminogram SAS (Biody Manager). Biody's infrastructure stores client measurements, making it a processor. Standard SaaS pattern.",
      sourceLanguage: "is",
      location: "other",
      approval: "Signed by Aminogram SAS / Biody (Art. 28 processor).",
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
      location: "other",
      approval: "Signed internally by the persónuverndarfulltrúi (DPO).",
      text: { is: renderDPIAInterim("is"), en: renderDPIAInterim("en") },
    },
  ];
}

interface LatestDraftRow {
  document_key: string;
  language: "is" | "en";
  proposed_version: string;
  text: string;
  text_hash: string;
  edited_by_email: string;
  edited_by_name: string | null;
  source_note: string | null;
  created_at: string;
  edited_via?: string;
}

// Most recent draft per (document_key, language). Degrades to an empty
// map if the table is missing (migration not yet applied).
async function loadLatestDrafts(): Promise<Map<string, LatestDraftRow>> {
  const map = new Map<string, LatestDraftRow>();
  try {
    const { data } = await supabaseAdmin
      .from("legal_document_drafts")
      .select("document_key, language, proposed_version, text, text_hash, edited_by_email, edited_by_name, source_note, created_at, edited_via")
      .order("created_at", { ascending: false });
    for (const row of (data || []) as LatestDraftRow[]) {
      const k = `${row.document_key}::${row.language}`;
      if (!map.has(k)) map.set(k, row);
    }
  } catch {
    // no overrides — source-code text is shown everywhere
  }
  return map;
}

function overlay(draftMap: Map<string, LatestDraftRow>, doc: RawDoc): ResolvedDoc {
  const forLang = (lang: "is" | "en"): { text: string | null; meta: DraftMeta | null } => {
    const draft = draftMap.get(`${doc.id}::${lang}`);
    if (!draft) return { text: doc.text[lang], meta: null };
    return {
      text: draft.text,
      meta: {
        proposed_version: draft.proposed_version,
        edited_by_email: draft.edited_by_email,
        edited_by_name: draft.edited_by_name,
        created_at: draft.created_at,
        source_note: draft.source_note,
        text_hash: draft.text_hash,
        edited_via: draft.edited_via,
      },
    };
  };
  const is = forLang("is");
  const en = forLang("en");
  return {
    ...doc,
    text: { is: is.text, en: en.text },
    drafts: { is: is.meta, en: en.meta },
  };
}

// Resolve every document (drafts overlaid) grouped by location, in the
// fixed LOCATION_ORDER. Empty groups are omitted.
export async function getLegalDocGroups(): Promise<LocationGroup[]> {
  const draftMap = await loadLatestDrafts();
  const resolved = rawDocs().map((d) => overlay(draftMap, d));
  return LOCATION_ORDER.map((loc) => ({
    location: loc,
    title: LOCATION_META[loc].title,
    blurb: LOCATION_META[loc].blurb,
    docs: resolved.filter((d) => d.location === loc),
  })).filter((g) => g.docs.length > 0);
}
