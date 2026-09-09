// Union (stéttarfélag) grant registry for the booking flow.
//
// Icelandic sjúkrasjóðir reimburse members for parts of a health assessment,
// but every fund sets its own rules and the member normally has to pay in
// full, keep the receipt and apply themselves. The Vestmannaeyjar pilot
// replaces that with direct settlement: we subtract the grant at checkout,
// the member pays the remainder, and we invoice the fund monthly.
//
// See docs/eyjamodelid.html for the pilot plan and docs/styrkjavelin.html for
// the wider strategy.
//
// IMPORTANT — `live` is the money switch. A fund only produces a real
// discount once `live: true`, which must not happen before a signed
// beingreiðslusamningur is in place. Until then `grantIsk` is the *proposed*
// amount we are negotiating for, and the booking flow records the member's
// declared union without discounting anything. That declared-union data is
// deliberately useful on its own: it tells us which funds our customers
// actually concentrate in, which is what should drive the negotiation order.

import type { PackageKey } from "./assessment-packages";

export type GrantSettlement =
  | "direct"          // we invoice the fund; member pays the net amount
  | "reimbursement";  // member pays in full and claims it back themselves

export interface UnionFund {
  code: string;
  name: string;
  region: string;
  settlement: GrantSettlement;
  /** Only `true` once a signed agreement exists. Gates the actual discount. */
  live: boolean;
  /** Grant per member per `periodMonths`. Proposed amount while `live` is false. */
  grantIsk: number;
  eligiblePackages: PackageKey[];
  periodMonths: number;
  /** Membership seniority requirement, shown to the member in Icelandic. */
  seniority: string;
  sourceUrl: string;
  /** ISO date the rules above were last checked against the fund's own page. */
  verifiedAt: string;
}

/**
 * Vestmannaeyjar pilot cohort. These five funds all have their board on the
 * island, which is why they can approve direct settlement at all — the
 * national funds (VR, FIT, VM) set their rules in Reykjavík and are handled
 * through the reimbursement path instead.
 *
 * 25.000 kr. is not an arbitrary ask: it is already Drífandi's own ceiling in
 * six of its nine published grant categories, so it is a number their board
 * recognises.
 */
export const UNION_FUNDS: UnionFund[] = [
  {
    code: "drifandi",
    name: "Drífandi stéttarfélag",
    region: "Vestmannaeyjar",
    settlement: "direct",
    live: false,
    grantIsk: 25_000,
    eligiblePackages: ["foundational", "checkin"],
    periodMonths: 12,
    seniority: "Greitt félagsgjald í sex af síðustu tólf mánuðum.",
    sourceUrl: "https://www.drifandi.is/sjukrasjodur/",
    verifiedAt: "2026-08-21",
  },
  {
    code: "jotunn",
    name: "Sjómannafélagið Jötunn",
    region: "Vestmannaeyjar",
    settlement: "direct",
    live: false,
    grantIsk: 25_000,
    eligiblePackages: ["foundational", "checkin"],
    periodMonths: 12,
    seniority: "Greitt til sjóðsins síðustu tólf mánuði.",
    sourceUrl: "https://sjomannafelag.is/index.php/sjukrasjodur/",
    verifiedAt: "2026-08-21",
  },
  {
    code: "stf-vestmannaeyja",
    name: "Starfsmannafélag Vestmannaeyja",
    region: "Vestmannaeyjar",
    settlement: "direct",
    live: false,
    grantIsk: 25_000,
    eligiblePackages: ["foundational", "checkin"],
    periodMonths: 12,
    seniority: "Sjá reglur félagsins.",
    sourceUrl: "https://www.samband.is/starfsmannafelag-vesmannaeyja",
    verifiedAt: "2026-08-21",
  },
  {
    code: "verdandi",
    name: "Skipstjóra- og stýrimannafélagið Verðandi",
    region: "Vestmannaeyjar",
    settlement: "direct",
    live: false,
    grantIsk: 25_000,
    eligiblePackages: ["foundational", "checkin"],
    periodMonths: 12,
    seniority: "Sjá reglur félagsins.",
    sourceUrl: "https://ssverdandi.is/",
    verifiedAt: "2026-08-21",
  },
  {
    code: "verkstjorafelag-ve",
    name: "Verkstjórafélag Vestmannaeyja",
    region: "Vestmannaeyjar",
    settlement: "direct",
    live: false,
    grantIsk: 25_000,
    eligiblePackages: ["foundational", "checkin"],
    periodMonths: 12,
    seniority: "Sjá reglur félagsins.",
    sourceUrl: "https://lsv.is/um-sjodinn/adildarfelog-lsv/",
    verifiedAt: "2026-08-21",
  },
];

/** Sentinel stored on the claim when the member is in a fund we don't cover yet. */
export const OTHER_UNION_CODE = "other";

export function findUnionFund(code: string | null | undefined): UnionFund | null {
  if (!code) return null;
  return UNION_FUNDS.find((f) => f.code === code) ?? null;
}

/**
 * What we may actually subtract at checkout. Returns 0 for anything that
 * isn't a signed, package-eligible fund — so an un-negotiated fund can never
 * hand out money by accident, and the grant can never exceed the price.
 */
export function grantForBooking(
  fund: UnionFund | null,
  packageKey: PackageKey | null,
  priceIsk: number,
): number {
  if (!fund || !packageKey) return 0;
  if (!fund.live) return 0;
  if (fund.settlement !== "direct") return 0;
  if (!fund.eligiblePackages.includes(packageKey)) return 0;
  if (priceIsk <= 0) return 0;
  return Math.min(fund.grantIsk, priceIsk);
}

/** Bump when the consent wording below changes materially. */
export const UNION_GRANT_CONSENT_VERSION = "1.0";

/**
 * One sentence, one checkbox. The whole point of the pilot is that the
 * member does nothing, so a multi-screen consent flow would defeat it.
 * Note what is deliberately absent: no assessment results ever reach the
 * fund, only what it needs to pay.
 */
export function unionGrantConsentText(fundName: string): string {
  return (
    `Ég staðfesti að ég er félagi í ${fundName} og heimila Lifeline Health ehf. ` +
    "að staðfesta aðild mína og innheimta styrkhlutann beint hjá sjúkrasjóði félagsins. " +
    "Sjóðurinn fær nafn, kennitölu, dagsetningu og lýsingu þjónustunnar — engar niðurstöður úr heilsufarsmatinu."
  );
}

/** Shown when the member picks a fund we haven't signed with yet. */
export function pendingFundNote(fundName: string): string {
  return (
    `Beingreiðsla er ekki komin í gildi hjá ${fundName} enn sem komið er. ` +
    "Þú greiðir fullt verð núna og færð kvittun sem uppfyllir kröfur sjóðsins, " +
    "svo þú getir sótt um endurgreiðslu sjálf/ur. Við skráum félagið þitt svo við " +
    "vitum hvar við eigum að semja næst."
  );
}
