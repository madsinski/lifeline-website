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

export const REFERRAL_TARGETS = ["heilsugaesla", "physio", "psychologist", "nutritionist", "specialist"] as const;
export type ReferralTarget = (typeof REFERRAL_TARGETS)[number];

export const REFERRAL_STATUSES = ["requested", "approved", "declined", "done"] as const;
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
}

export const TARGET_IS: Record<ReferralTarget, { label: string; blurb: string; color: string }> = {
  heilsugaesla: { label: "Heilsugæslan", blurb: "Læknismat, lyf, framhaldsrannsóknir", color: "#E11D48" },
  physio: { label: "Sjúkraþjálfari", blurb: "Verkir og stoðkerfi", color: "#F59E0B" },
  psychologist: { label: "Sálfræðingur", blurb: "Andleg líðan, streita, fíkn", color: "#8B5CF6" },
  nutritionist: { label: "Næringarfræðingur", blurb: "Mataræði og matarhegðun", color: "#10B981" },
  specialist: { label: "Sérfræðingur", blurb: "Beint til viðeigandi sérgreinar", color: "#0EA5E9" },
};

export const STATUS_IS: Record<ReferralStatus, string> = {
  requested: "Bíður læknis",
  approved: "Samþykkt",
  declined: "Ekki þörf",
  done: "Frágengið",
};

/**
 * The reasons that come up again and again, so they are one click.
 *
 * Phrased as findings, not conclusions: "Fastandi blóðsykur yfir viðmiðum"
 * rather than "sykursýki". The doctor names the condition, we do not.
 */
export const COMMON_REASONS: Record<ReferralTarget, string[]> = {
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
