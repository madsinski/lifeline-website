// Lifeline is the single shop (Mads, 2026-10-16). Client-safe: no server imports.
//
// Every product is sold here. After payment the client gets the matching
// Medalia 100% code from that product's pool (src/lib/hc/code-pool.ts):
//
//   heilsufarsskodun  health_check      59.900  the bundle
//   maeling           measurement        8.900  booked on a Lifeline station slot
//   blodprufa         blood_test        17.900  no booking: ordered in Medalia
//   laeknisvidtal     doctor_interview  19.900  booked here on the doctor's day
//
// The prices themselves live in hc_packages.price_isk; the numbers below are
// fallbacks for the marketing page when the database cannot be read.
// Schema: supabase/migration-single-shop.sql.

export const BUNDLE_KEY = "heilsufarsskodun";

/** The three parts of the health check sold on their own. */
export const STANDALONE_KINDS = ["measurement", "blood_test", "doctor_interview"] as const;
export type StandaloneKind = (typeof STANDALONE_KINDS)[number];
export const isStandaloneKind = (k: unknown): k is StandaloneKind =>
  typeof k === "string" && (STANDALONE_KINDS as readonly string[]).includes(k);

/** What is sold on the Þjónusta page and the marketing page, in this order. */
export const SHOP_KINDS = ["health_check", ...STANDALONE_KINDS] as const;

/** Order kinds that entitle the client to book one doctor-day slot. */
export const DOCTOR_BOOKABLE_KINDS = ["doctor_interview", "health_check", "reevaluation"] as const;
export const canBookDoctor = (kind: string) => (DOCTOR_BOOKABLE_KINDS as readonly string[]).includes(kind);
/** Order kinds that entitle the client to book one station slot here. */
export const canBookStation = (kind: string) => kind === "measurement";

export const SHOP_FALLBACK_PRICES: Record<(typeof SHOP_KINDS)[number], number> = {
  health_check: 59900,
  measurement: 8900,
  blood_test: 17900,
  doctor_interview: 19900,
};

/** Short Icelandic names, for lists and the code-pool admin. */
export const KIND_IS: Record<string, string> = {
  health_check: "Heilsufarsskoðun",
  reevaluation: "Endurmat",
  followup_3m: "Eftirfylgd",
  extra_followup: "Auka eftirfylgd",
  measurement: "Mæling",
  blood_test: "Blóðprufa",
  doctor_interview: "Læknisviðtal",
};

/** Kinds a Medalia code batch can be imported for (admin → Virkjunarkóðar). */
export const CODE_POOL_KINDS = [
  "health_check", "reevaluation", "followup_3m", "extra_followup",
  "measurement", "blood_test", "doctor_interview",
] as const;

/** What the bundle holds beyond the three parts sold on their own. */
export const BUNDLE_EXTRAS = [
  "Spurningalisti um svefn, hreyfingu, næringu og andlega líðan",
  "Grunnheilsuskýrsla staðfest af lækni",
  "Áætlunarsamtal við hjúkrunarfræðing (aðeins í pakkanum)",
  "Persónuleg áætlun til þriggja mánaða",
];

/** The bundle's parts, priced as if bought one by one. */
export function bundleBreakdown(prices: Partial<Record<string, number>>) {
  const p = (k: StandaloneKind) => prices[k] ?? SHOP_FALLBACK_PRICES[k];
  const parts = [
    { kind: "measurement" as const, label: "Mæling", price: p("measurement") },
    { kind: "blood_test" as const, label: "Blóðprufa", price: p("blood_test") },
    { kind: "doctor_interview" as const, label: "Læknisviðtal", price: p("doctor_interview") },
  ];
  return { parts, separateTotal: parts.reduce((n, x) => n + x.price, 0) };
}

/** What happens after purchase, per product. Shown on the page and in the email. */
export const AFTER_PURCHASE: Record<string, string> = {
  health_check: "Þú virkjar kóðann í sjúklingagáttinni og heilsuferðin leiðir þig áfram: mæling, blóðprufa, skýrsla, læknisviðtal og áætlunarsamtal.",
  measurement: "Þú bókar mælingartíma á Lifeline-stöð hér í appinu.",
  blood_test: "Blóðprufan er pöntuð í sjúklingagáttinni þegar þú hefur virkjað kóðann. Mættu fastandi á rannsóknarstofu.",
  doctor_interview: "Þú bókar viðtalið hér á læknadegi vikunnar. Það er haldið og skráð í sjúklingagáttinni.",
};

// ── The doctor's day ────────────────────────────────────────────────────

export interface DoctorConfig {
  /** 0 = sunnudagur … 6 = laugardagur. Iceland keeps UTC all year. */
  doctor_weekday: number;
  /** Length of one doctor slot, minutes, when staff open a range. */
  slot_minutes: number;
}

/**
 * Fallbacks, used only where hc_packages.quota on 'laeknisvidtal' is missing.
 *
 * doctor_weekday 3 (miðvikudagur) = the nurse's service day placeholder in
 * coaching-config.ts. Mads has not named the doctor's day yet; set it with
 * one UPDATE on hc_packages.quota, not here.
 */
export const DOCTOR_PACKAGE_KEY = "laeknisvidtal";
export const DOCTOR_DEFAULTS: DoctorConfig = { doctor_weekday: 3, slot_minutes: 30 };

export function readDoctorConfig(raw: unknown): DoctorConfig {
  const q = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d;
  return {
    doctor_weekday: int(q.doctor_weekday, 0, 6, DOCTOR_DEFAULTS.doctor_weekday),
    slot_minutes: int(q.slot_minutes, 10, 120, DOCTOR_DEFAULTS.slot_minutes),
  };
}
