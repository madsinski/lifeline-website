// Journey event names + labels. Client-safe (the workstation UI imports
// this); the server logic lives in events.ts.

export const JOURNEY_EVENTS = [
  "protocol_activated",
  "blood_test_booked", "blood_test_done", "blood_results_ready",
  "measurements_booked", "measurements_done",
  "report_generated",
  "interview_booked", "interview_done",
  "referral_heilsugaesla",
  "followup_booked", "followup_done",
] as const;
export type JourneyEvent = (typeof JOURNEY_EVENTS)[number];

export const EVENT_LABELS: Record<JourneyEvent, string> = {
  protocol_activated: "Heilsufarsskoðun virkjuð",
  blood_test_booked: "Blóðprufa bókuð",
  blood_test_done: "Blóðprufa tekin",
  blood_results_ready: "Blóðprufusvör komin",
  measurements_booked: "Mælingar bókaðar",
  measurements_done: "Mælingum lokið",
  report_generated: "Skýrsla staðfest",
  interview_booked: "Viðtal bókað",
  interview_done: "Viðtali lokið",
  referral_heilsugaesla: "Vísað á Heilsugæsluna",
  followup_booked: "Eftirfylgd bókuð",
  followup_done: "Eftirfylgd lokið",
};

/** Events only a doctor may record. */
export const DOCTOR_ONLY: JourneyEvent[] = ["report_generated", "referral_heilsugaesla"];

export function isJourneyEvent(e: unknown): e is JourneyEvent {
  return typeof e === "string" && (JOURNEY_EVENTS as readonly string[]).includes(e);
}
