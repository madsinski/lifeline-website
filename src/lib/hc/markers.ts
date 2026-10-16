// Which values Lifeline itself measures, and which are Medalia's.
//
// Medalia split (Mads, 2026-10-16): staff no longer type in BLOOD values —
// those are Medalia's, and reach Lifeline only inside the participant's own
// report (or one a nurse imported with their permission). What staff may
// record by hand is what Lifeline's own measurement station measures: body
// composition, BMI, weight, fat and muscle, VO2max, strength and blood
// pressure.
//
// Client-safe: no imports. Slugs are hc_knowledge slugs (category 'body' for
// the station set, 'blood' for the lab set) — see CODE_TO_SLUG in
// report-import.ts for the lab-code mapping.

/** Measured at Lifeline's station. Staff may enter these. */
export const STATION_MARKERS = [
  "thyngd", "bmi", "fitumassi", "vodvamassi", "vo2max",
  "blodthrystingur", "blodthrystingur-nedri",
  // Strength, should the reference book grow entries for it.
  "gripstyrkur", "styrkur",
] as const;

/** Lab values (Medalia's). Staff may NOT enter these. */
export const BLOOD_MARKERS = [
  "insulin", "homa-ir", "hba1c", "fastandi-blodsykur", "heildarkolesterol", "hdl", "ldl",
  "thriglyserid", "apo-b", "alt", "ast", "ggt", "d-vitamin", "ferritin", "tsh", "hscrp",
] as const;

/** Lab codes as an AI read of a printout names them (x:<CODE> markers). */
const BLOOD_CODES = new Set(["INS-F", "HOMA-IR", "HBA1C", "GLU-F", "TC", "HDL-C", "LDL-C", "TG", "APO-B", "ALT", "AST", "GGT", "25OHD", "FERR", "TSH", "HSCRP"]);

export function isBloodMarker(marker: string): boolean {
  if ((BLOOD_MARKERS as readonly string[]).includes(marker)) return true;
  const code = marker.startsWith("x:") ? marker.slice(2).toUpperCase() : null;
  return !!code && BLOOD_CODES.has(code);
}

/**
 * Whether staff may record this marker by hand. `bodySlugs` is the set of
 * hc_knowledge slugs in category 'body', so a station measurement added to
 * the reference book later is accepted without a code change.
 */
export function isStationMarker(marker: string, bodySlugs?: ReadonlySet<string>): boolean {
  if (isBloodMarker(marker)) return false;
  return (STATION_MARKERS as readonly string[]).includes(marker) || !!bodySlugs?.has(marker);
}

export const BLOOD_ENTRY_REFUSED =
  "Blóðgildi eru ekki skráð í Lifeline. Þau koma úr skýrslunni úr sjúklingagáttinni (Medalia).";
export const NOT_STATION_REFUSED =
  "Aðeins mælingar Lifeline (líkamssamsetning, þyngd, BMI, fitu- og vöðvamassi, VO2max, styrkur og blóðþrýstingur) eru skráðar hér.";
