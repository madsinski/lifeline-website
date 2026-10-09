// How long a parsed report stays, and how that is decided.
//
// The policy, in one place so it can be changed by argument rather than by
// hunting through routes.
//
// The PDF is never stored. What persists is the parsed result, encrypted —
// still health data, still subject to Art. 5(1)(e). Lifeline is a viewer,
// not a sjúkraskrá, so lög 55/2009's retention duty does not apply and
// storage limitation actually bites.
//
// Rather than a timer, the person is asked. That is only honest because the
// original stays in Medalia: removing Lifeline's copy loses nothing they
// cannot import again. Say so in the prompt, or people click "keep" out of
// fear and the review becomes theatre that always returns "keep".
//
// Silence does not mean keep. A review where no answer means "hold it for
// ever" limits nothing. It also must not mean instant deletion, so there is
// a reminder and a grace period, and then the copy goes — recoverable in one
// step from Medalia.

/** Ask once a year, on the rhythm the journey already has. */
export const REVIEW_AFTER_DAYS = 365;

/** Then a reminder, then the copy goes. */
export const REMIND_AFTER_DAYS = 30;
export const REMOVE_AFTER_DAYS = 60;

/**
 * Real use counts as an answer.
 *
 * Necessity is demonstrated by using the thing. Somebody whose plan is built
 * on a report, who ticks actions off it every week, should not be asked
 * whether they still want it — that is a nag, and nags are what train people
 * to dismiss prompts without reading them.
 */
export const ACTIVE_WITHIN_DAYS = 180;

export type RetentionState = "fresh" | "asked" | "reminded" | "due-removal";

export function retentionState(
  r: { retention_confirmed_at: string | null; retention_asked_at: string | null; retention_reminded_at: string | null },
  now = Date.now(),
): RetentionState {
  const days = (iso: string | null) => (iso ? (now - Date.parse(iso)) / 86_400_000 : Infinity);

  // Asked already, and waiting.
  if (r.retention_asked_at && !(days(r.retention_asked_at) < days(r.retention_confirmed_at))) {
    const since = days(r.retention_asked_at);
    if (since >= REMOVE_AFTER_DAYS) return "due-removal";
    if (since >= REMIND_AFTER_DAYS) return "reminded";
    return "asked";
  }
  return days(r.retention_confirmed_at) >= REVIEW_AFTER_DAYS ? "asked" : "fresh";
}
