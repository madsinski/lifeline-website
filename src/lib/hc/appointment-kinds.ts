// The three appointments a nurse holds.
//
// The blood draw is booked at Heilsugæslan and sits on their calendar, not
// hers, so it is deliberately not one of these.
//
// Client-safe: no imports.

export const APPT_KINDS = ["measure", "interview", "followup"] as const;
export type ApptKind = (typeof APPT_KINDS)[number];

export const APPT_MINUTES: Record<ApptKind, number> = { measure: 30, interview: 45, followup: 30 };

export const APPT_IS: Record<ApptKind, { label: string; short: string; color: string; tint: string }> = {
  measure: { label: "Mælingar", short: "Mæl", color: "#4F46E5", tint: "#EEF2FF" },
  interview: { label: "Viðtal", short: "Viðtal", color: "#047857", tint: "#ECFDF5" },
  followup: { label: "Eftirfylgdarviðtal", short: "Eftirfylgd", color: "#B45309", tint: "#FFFBEB" },
};

/** The journey event that books each one. */
export const APPT_EVENT: Record<ApptKind, string> = {
  measure: "measurements_booked",
  interview: "interview_booked",
  followup: "followup_booked",
};
