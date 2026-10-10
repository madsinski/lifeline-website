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

/*
 * The two things a participant books with their coach from Þjálfari → Bóka.
 *
 * Separate from ApptKind on purpose. Those three live in columns on
 * hc_journeys and are the nurse's own diary; these live in hc_bookings, are
 * booked by the participant, and carry a list of what is being measured. The
 * calendar shows both because the coach's day contains both, but a booking
 * is not reschedulable through the journey-event endpoint, so the two must
 * stay tellable apart.
 */
export const BOOK_KINDS = ["video", "measurement"] as const;
export type BookKind = (typeof BOOK_KINDS)[number];

export const BOOK_IS: Record<BookKind, { label: string; short: string; color: string; tint: string }> = {
  video: { label: "Myndsímtal", short: "Mynd", color: "#0E7490", tint: "#ECFEFF" },
  measurement: { label: "Mæling", short: "Mæling", color: "#7E22CE", tint: "#FAF5FF" },
};

/** What a measurement booking can contain, with the minutes each takes. */
export const MEASURE_IS: Record<string, { label: string; minutes: number }> = {
  bodycomp: { label: "Líkamssamsetning", minutes: 5 },
  bloodpressure: { label: "Blóðþrýstingur", minutes: 10 },
  strength: { label: "Styrktarmæling", minutes: 20 },
  vo2max: { label: "Þrekpróf", minutes: 30 },
};

/** "Líkamssamsetning + blóðþrýstingur", for a calendar tooltip. */
export function measureLabel(items: string[] | null | undefined): string {
  const l = (items ?? []).map((k) => MEASURE_IS[k]?.label ?? k);
  if (!l.length) return BOOK_IS.measurement.label;
  return l[0] + l.slice(1).map((x) => ` + ${x.toLowerCase()}`).join("");
}

/**
 * What to know before a measurement, per measurement.
 *
 * Every one of these is about the number coming out right rather than about
 * health: a body-composition reading moves with a big meal, blood pressure
 * with the coffee on the way over. Saying so beforehand is the difference
 * between a measurement and a measurement you have to repeat.
 */
export const MEASURE_PREP: Record<string, string[]> = {
  bodycomp: [
    "Komdu í léttum fötum — skórnir og sokkarnir fara af.",
    "Sleppa stórri máltíð og harðri æfingu síðustu tvo tímana.",
    "Drekktu vatn eins og venjulega; þurrkur breytir tölunni.",
  ],
  bloodpressure: [
    "Ekkert kaffi eða nikótín síðustu hálftímann.",
    "Við sitjum í fimm mínútur áður en mælt er.",
    "Laus ermi eða stutterma — það þarf að komast að upphandleggnum.",
  ],
  strength: [
    "Föt sem þú getur hreyft þig í og skór með gripi.",
    "Ekki taka þunga æfingu sama daginn.",
  ],
  vo2max: [
    "Æfingaföt, skór og handklæði.",
    "Léttur matur svona tveimur tímum áður — ekki fastandi.",
    "Taktu með vatnsbrúsa.",
  ],
};
