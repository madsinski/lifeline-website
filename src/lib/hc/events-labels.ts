// Journey event names + labels. Client-safe (the workstation UI imports
// this); the server logic lives in events.ts.
//
// Medalia split (2026-10-16): the doctor's interview and releasing the report
// happen in Medalia. Lifeline no longer records a doctor "confirming" the
// report (report_generated) or a Heilsugæsla referral
// (referral_heilsugaesla); both are LEGACY — kept so old audit rows still
// read, but nothing can record them. "interview_*" is Lifeline's own
// Áætlunarsamtal (plan session).

export const JOURNEY_EVENTS = [
  "protocol_activated",
  "blood_test_booked", "blood_test_done", "blood_results_ready",
  "measurements_booked", "measurements_done",
  "doctor_interview_done",
  "interview_booked", "interview_done", "interview_cancelled",
  "followup_booked", "followup_done", "followup_cancelled",
] as const;
export type JourneyEvent = (typeof JOURNEY_EVENTS)[number];

/** Events that used to exist. Display only: isJourneyEvent() rejects them. */
export const LEGACY_JOURNEY_EVENTS = ["report_generated", "referral_heilsugaesla"] as const;
export type LegacyJourneyEvent = (typeof LEGACY_JOURNEY_EVENTS)[number];

export const EVENT_LABELS: Record<JourneyEvent | LegacyJourneyEvent, string> = {
  protocol_activated: "Heilsufarsskoðun virkjuð",
  blood_test_booked: "Blóðprufa bókuð",
  blood_test_done: "Blóðprufa tekin",
  blood_results_ready: "Blóðprufusvör komin",
  measurements_booked: "Mælingar bókaðar",
  measurements_done: "Mælingum lokið",
  doctor_interview_done: "Læknisviðtali lokið (Medalia)",
  interview_booked: "Áætlunarsamtal bókað",
  interview_done: "Áætlunarsamtali lokið",
  interview_cancelled: "Áætlunarsamtal afbókað",
  followup_booked: "Eftirfylgd bókuð",
  followup_done: "Eftirfylgd lokið",
  followup_cancelled: "Eftirfylgd afbókuð",
  // Legacy, display only.
  report_generated: "Skýrsla staðfest (eldra ferli)",
  referral_heilsugaesla: "Vísað á Heilsugæsluna (eldra ferli)",
};

/**
 * Events only a doctor may record. Empty since the Medalia split: the
 * doctor-only events were removed, and doctor_interview_done is a tick any
 * workstation member makes once Medalia shows the interview happened.
 * Kept as an export so existing imports compile.
 */
export const DOCTOR_ONLY: JourneyEvent[] = [];

export function isJourneyEvent(e: unknown): e is JourneyEvent {
  return typeof e === "string" && (JOURNEY_EVENTS as readonly string[]).includes(e);
}
