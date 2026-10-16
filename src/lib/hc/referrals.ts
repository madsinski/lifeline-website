// Where Lifeline puts a client in touch with someone else, and what for.
//
// Since the Medalia split (2026-10-16) that is only Vera heilsusetur's
// partners — physio, psychologist, nutritionist — contacted on the client's
// behalf with their consent. Referrals to heilsugæsla or a specialist and
// in-house doctor assessments are the doctor's, in Medalia; old rows of those
// kinds are still readable here, but cannot be created.
//
// Nothing here is a diagnosis. A reason is what the client wants help with
// ("Verkur í hné"), never a conclusion we drew.
//
// Client-safe: no imports.

/*
 * Medalia split (Mads, 2026-10-16): Lifeline no longer refers anyone or asks
 * its own doctor for an assessment — the doctor's side is Medalia's. The only
 * thing that can be created now is a Vera partner contact (physio,
 * psychologist, nutritionist), done on the client's behalf with consent.
 *
 * lifeline_doctor / heilsugaesla / specialist remain in the TYPE and the
 * labels so historic rows still render, but REFERRAL_TARGETS — the list the
 * API accepts and the UI offers — is the partner list only.
 */
export const ALL_REFERRAL_TARGETS = ["lifeline_doctor", "heilsugaesla", "physio", "psychologist", "nutritionist", "specialist"] as const;
/** Any target a stored row may have (display). */
export type ReferralTarget = (typeof ALL_REFERRAL_TARGETS)[number];
/** Legacy doctor-path targets: readable, never creatable. */
export const LEGACY_REFERRAL_TARGETS = ["lifeline_doctor", "heilsugaesla", "specialist"] as const;
export const isLegacyTarget = (t: string) => (LEGACY_REFERRAL_TARGETS as readonly string[]).includes(t);

/* sent/failed/done: a Vera partner contacted on the client's behalf.
   requested/approved/declined: the removed doctor path — historic rows only. */
export const ALL_REFERRAL_STATUSES = ["requested", "approved", "declined", "done", "sent", "failed"] as const;
export type ReferralStatus = (typeof ALL_REFERRAL_STATUSES)[number];
/** Statuses a row can still be moved to. */
export const REFERRAL_STATUSES = ["sent", "failed", "done"] as const;

export interface Referral {
  id: string;
  target: ReferralTarget;
  reason: string;
  note: string | null;
  status: ReferralStatus;
  suggested_by: string | null;
  requested_by: string;
  doctor_notified_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  /* Vera partner contact (migration-hc-partners.sql). */
  partner_id?: string | null;
  consent_at?: string | null;
  consent_by?: string | null;
  sent_at?: string | null;
  sent_by?: string | null;
  contacted_at?: string | null;
}

/** A therapist at Vera heilsusetur (admin → Heilsuferð → Samstarfsaðilar). */
export interface Partner {
  id: string;
  name: string;
  profession: PartnerProfession;
  organization: string;
  email: string;
  phone: string | null;
  note: string | null;
  active: boolean;
}

/**
 * Lifeline does not refer patients. These three are partners at Vera
 * heilsusetur that the nurse contacts ON THE CLIENT'S BEHALF, with consent:
 * an email carrying only name, kennitala and contact details.
 */
export const PARTNER_TARGETS = ["physio", "psychologist", "nutritionist"] as const;
export type PartnerProfession = (typeof PARTNER_TARGETS)[number];
/** What can be created: the Vera partner contacts, nothing else. */
export const REFERRAL_TARGETS: readonly ReferralTarget[] = PARTNER_TARGETS;
export const isPartner = (t: string): t is PartnerProfession => (PARTNER_TARGETS as readonly string[]).includes(t);
/** Heilsugæsla / specialist (legacy): advice to the client, which a doctor confirmed. */
export const isAdvice = (t: string) => t === "heilsugaesla" || t === "specialist";

export const PROFESSION_IS: Record<PartnerProfession, { one: string; service: string }> = {
  physio: { one: "sjúkraþjálfari", service: "sjúkraþjálfun" },
  psychologist: { one: "sálfræðingur", service: "sálfræðiþjónustu" },
  nutritionist: { one: "næringarfræðingur", service: "næringarráðgjöf" },
};

export const TARGET_IS: Record<ReferralTarget, { label: string; blurb: string; color: string }> = {
  lifeline_doctor: { label: "Læknir Lifeline (eldra ferli)", blurb: "Eldra ferli: læknir Lifeline mat niðurstöðu. Læknisþátturinn er nú í Medalia.", color: "#0F172A" },
  heilsugaesla: { label: "Heilsugæslan (eldra ferli)", blurb: "Eldra ferli: ráðlegging um að leita til heilsugæslu. Nú í höndum læknis í Medalia.", color: "#E11D48" },
  physio: { label: "Sjúkraþjálfari (Vera)", blurb: "Samstarfsaðili (Vera heilsusetur) hefur samband við skjólstæðinginn.", color: "#F59E0B" },
  psychologist: { label: "Sálfræðingur (Vera)", blurb: "Samstarfsaðili (Vera heilsusetur) hefur samband við skjólstæðinginn.", color: "#8B5CF6" },
  nutritionist: { label: "Næringarfræðingur (Vera)", blurb: "Samstarfsaðili (Vera heilsusetur) hefur samband við skjólstæðinginn.", color: "#10B981" },
  specialist: { label: "Sérfræðingur (eldra ferli)", blurb: "Eldra ferli: ráðlegging um að leita til sérfræðings. Nú í höndum læknis í Medalia.", color: "#0EA5E9" },
};

/** In-house assessment (legacy): the doctor's answer was "assessed", not approve/decline. */
export const isInHouse = (t: ReferralTarget) => t === "lifeline_doctor";

export const STATUS_IS: Record<ReferralStatus, string> = {
  requested: "Bíður læknis",
  approved: "Ráðlagt skjólstæðingi",
  declined: "Ekki þörf",
  done: "Frágengið",
  sent: "Sent samstarfsaðila",
  failed: "Tölvupóstur fór ekki",
};

/** A partner contact's status says who and when, not just a word. */
export function partnerStatus(r: Referral, partnerName: string | null): string {
  const who = partnerName ?? "samstarfsaðila";
  if (r.status === "done") return `Samband komið á við ${who}`;
  if (r.status === "failed") return `Tölvupóstur til ${who} fór ekki`;
  return `Sent til ${who}`;
}

/**
 * The email to the partner. ONLY name, kennitala and contact details — the
 * reason, notes and anything from the health check stay in Lifeline.
 */
export function partnerEmail(o: {
  partnerName: string; profession: PartnerProfession; clientName: string; kennitala: string | null;
  phone: string | null; email: string | null; nurse: string;
}) {
  const kt = o.kennitala ? `${o.kennitala.slice(0, 6)}-${o.kennitala.slice(6)}` : "—";
  const lines = [
    `Nafn: ${o.clientName}`,
    `Kennitala: ${kt}`,
    `Sími: ${o.phone ?? "—"}`,
    `Netfang: ${o.email ?? "—"}`,
  ];
  const intro = `${o.clientName} hefur óskað eftir ${PROFESSION_IS[o.profession].service} og samþykkt að við sendum þér nafn sitt, kennitölu og samskiptaupplýsingar. Viltu hafa samband við viðkomandi?`;
  return {
    subject: `Beiðni um samband frá Lifeline Health`,
    intro, lines,
    text: `Góðan dag ${o.partnerName}.\n\n${intro}\n\n${lines.join("\n")}\n\nKveðja,\n${o.nurse}\nLifeline Health`,
  };
}

/** The client's copy: what was shared, with whom. */
export function clientShareEmail(o: { clientName: string; partnerName: string; profession: PartnerProfession; organization: string }) {
  const first = o.clientName.split(" ")[0];
  const body = `Eins og við ræddum höfum við sent nafn þitt, kennitölu og samskiptaupplýsingar til ${o.partnerName}, ${PROFESSION_IS[o.profession].one} (${o.organization}), sem hefur samband við þig. Engar heilsufarsupplýsingar voru sendar.`;
  return {
    subject: `Við sendum upplýsingar þínar til ${o.partnerName}`,
    body,
    text: `Hæ ${first}.\n\n${body}\n\nKveðja,\nLifeline Health`,
  };
}

/**
 * The reasons that come up again and again, so they are one click.
 *
 * Phrased as what the client wants help with, not as a diagnosis. The
 * reason stays in Lifeline (encrypted); the partner only gets contact details.
 */
export const COMMON_REASONS: Record<ReferralTarget, string[]> = {
  lifeline_doctor: [], // legacy target: not creatable
  heilsugaesla: [], // legacy target: not creatable
  physio: [
    "Verkur í hné",
    "Verkur í baki",
    "Verkur í öxl",
    "Verkur í mjöðm",
    "Stoðkerfisvandi hindrar hreyfingu",
    "Endurhæfing eftir álag eða aðgerð",
    "Þarf aðlagaða æfingaáætlun",
  ],
  psychologist: [
    "Þunglyndiseinkenni",
    "Kvíðaeinkenni",
    "Viðvarandi streita og álag",
    "Svefnvandi án líkamlegrar skýringar",
    "Matarhegðun — lotur eða tilfinningaát",
    "Áfengi eða önnur efni",
    "Fjárhættuspil",
  ],
  nutritionist: [
    "Þyngdarstjórnun",
    "Matarhegðun og máltíðaskipulag",
    "Einkenni frá meltingu",
    "Óþol eða útilokun fæðuflokka",
    "Prótein undir viðmiðum",
    "Næring við styrktarþjálfun",
  ],
  specialist: [], // legacy target: not creatable
};
