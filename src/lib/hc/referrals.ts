// Where a health check sends people, and what for.
//
// A health check is a screening, so a good share of them end in "somebody
// else should look at this". Five destinations cover almost all of it, and
// the common reasons are worth having as one click rather than free text —
// both so the nurse is quick and so the doctor gets the same words every
// time.
//
// Nothing here is a diagnosis. A reason is what the doctor is being asked to
// look at ("Fastandi blóðsykur yfir viðmiðum"), never a conclusion we drew.
// The nurse proposes; the doctor decides.
//
// Client-safe: no imports.

// "lifeline_doctor" is the in-house one: a Lifeline doctor looks at a result
// or a question before the plan goes further (it replaced the separate
// "biðja lækni að meta" flag; the journey's doctor_review_* fields mirror it).
export const REFERRAL_TARGETS = ["lifeline_doctor", "heilsugaesla", "physio", "psychologist", "nutritionist", "specialist"] as const;
export type ReferralTarget = (typeof REFERRAL_TARGETS)[number];

/* requested/approved/declined: the doctor's path (in-house review and advice
   to seek heilsugæsla or a specialist). sent/failed/done: a Vera partner
   contacted on the client's behalf — no doctor in between. */
export const REFERRAL_STATUSES = ["requested", "approved", "declined", "done", "sent", "failed"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

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
export const isPartner = (t: string): t is PartnerProfession => (PARTNER_TARGETS as readonly string[]).includes(t);
/** Heilsugæsla / specialist: advice to the client, which a doctor confirms. */
export const isAdvice = (t: string) => t === "heilsugaesla" || t === "specialist";

export const PROFESSION_IS: Record<PartnerProfession, { one: string; service: string }> = {
  physio: { one: "sjúkraþjálfari", service: "sjúkraþjálfun" },
  psychologist: { one: "sálfræðingur", service: "sálfræðiþjónustu" },
  nutritionist: { one: "næringarfræðingur", service: "næringarráðgjöf" },
};

export const TARGET_IS: Record<ReferralTarget, { label: string; blurb: string; color: string }> = {
  lifeline_doctor: { label: "Læknir Lifeline", blurb: "Læknir metur niðurstöðu eða spurningu áður en lengra er haldið", color: "#0F172A" },
  heilsugaesla: { label: "Heilsugæslan", blurb: "Ráðlegging til skjólstæðings um að leita til heilsugæslu. Læknir staðfestir.", color: "#E11D48" },
  physio: { label: "Sjúkraþjálfari (Vera)", blurb: "Samstarfsaðili (Vera heilsusetur) hefur samband við skjólstæðinginn.", color: "#F59E0B" },
  psychologist: { label: "Sálfræðingur (Vera)", blurb: "Samstarfsaðili (Vera heilsusetur) hefur samband við skjólstæðinginn.", color: "#8B5CF6" },
  nutritionist: { label: "Næringarfræðingur (Vera)", blurb: "Samstarfsaðili (Vera heilsusetur) hefur samband við skjólstæðinginn.", color: "#10B981" },
  specialist: { label: "Sérfræðingur", blurb: "Ráðlegging til skjólstæðings um að leita til sérfræðings. Læknir staðfestir.", color: "#0EA5E9" },
};

/** In-house assessment: the doctor's answer is "assessed", not approve/decline. */
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
 * Phrased as findings, not conclusions: "Fastandi blóðsykur yfir viðmiðum"
 * rather than "sykursýki". The doctor names the condition, we do not.
 */
export const COMMON_REASONS: Record<ReferralTarget, string[]> = {
  lifeline_doctor: [
    "Óviss niðurstaða — læknir meti",
    "Gildi á mörkum — þarf að endurtaka?",
    "Einkenni sem skjólstæðingur lýsti í viðtali",
    "Lyf eða saga sem gæti haft áhrif á áætlunina",
    "Má skjólstæðingurinn hefja æfingaáætlunina?",
  ],
  heilsugaesla: [
    "Fastandi blóðsykur yfir viðmiðum",
    "HbA1c yfir viðmiðum",
    "Insúlínviðnám (HOMA-IR yfir mörkum)",
    "Blóðþrýstingur yfir viðmiðum",
    "Blóðfitur yfir viðmiðum",
    "Lifrargildi yfir viðmiðum",
    "Þekkt sykursýki — eftirfylgd",
    "Þekktur háþrýstingur — eftirfylgd",
    "D-vítamín undir viðmiðum",
    "Járnbúskapur — frekari rannsókn",
    "Skjaldkirtill — frekari rannsókn",
  ],
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
  specialist: [
    "Hjartalæknir",
    "Innkirtlalæknir",
    "Meltingarlæknir",
    "Svefnrannsókn",
    "Húðlæknir",
    "Bæklunarlæknir",
  ],
};

/** The SMS the responsible doctor gets. ASCII-safe: Icelandic letters force
 *  UCS-2 and halve the characters per segment (see src/lib/sms.ts). */
export function referralSms(opts: { clientName: string; target: ReferralTarget; reason: string; count: number; url: string }): string {
  const who = TARGET_IS[opts.target].label;
  const more = opts.count > 1 ? ` (+${opts.count - 1} onnur)` : "";
  return `Lifeline: ny tilvisun bidur mats. ${opts.clientName} - ${who}: ${opts.reason}${more}. ${opts.url}`;
}
