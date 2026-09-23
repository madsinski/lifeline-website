// "Mest fyrir minnst", as a number.
//
// Lifeline's whole method is most effect for the least time, but until now
// that lived in prose and the model had to infer it. Three dimensions decide
// it, each 1–5 and each higher-is-better so a client can read them without a
// key:
//
//   effect    how much it tends to move the thing it targets
//   ease      how easily it fits into a normal week
//   evidence  how good the evidence is that it does what we say
//
// Effect carries the most weight, because an easy action that changes nothing
// is not worth a slot in a plan. Evidence comes next: we would rather put
// something well-established in front of a client than something promising.
// Ease is last but real — an action nobody keeps up has an effect of zero in
// practice, whatever the trials say.
//
// Deliberately NOT in the database: the weighting is a judgement and should
// be arguable without a migration.
//
// Client-safe: no imports.

export interface Rated {
  effect?: number | null;
  ease?: number | null;
  evidence?: number | null;
  evidence_grade?: string | null;
  /** What the letter rests on, in a sentence. Shown on hover. */
  evidence_note?: string | null;
  minutes_per_week?: number | null;
}

const W = { effect: 0.45, evidence: 0.3, ease: 0.25 };

/**
 * 0–10. Null when the action has not been rated, rather than 0 — an unrated
 * action is unknown, not bad, and sorting must not bury it as though it were.
 */
export function bangScore(m: Rated): number | null {
  const { effect, ease, evidence } = m;
  if (effect == null || ease == null || evidence == null) return null;
  const raw = effect * W.effect + evidence * W.evidence + ease * W.ease;
  return Math.round(raw * 2 * 10) / 10;
}

/** Highest first; unrated actions sit after the rated ones, not below zero. */
export function byScore<T extends Rated>(a: T, b: T): number {
  const x = bangScore(a), y = bangScore(b);
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return y - x;
}

export const SCORE_BANDS = [
  { min: 8.5, label: "Mest fyrir minnst", className: "bg-emerald-100 text-emerald-900" },
  { min: 7, label: "Sterkur kostur", className: "bg-emerald-50 text-emerald-800" },
  { min: 5.5, label: "Góður kostur", className: "bg-slate-100 text-slate-700" },
  { min: 0, label: "Þegar hinu er lokið", className: "bg-slate-50 text-slate-500" },
] as const;

export const scoreBand = (score: number) => SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];

export const DIMENSION_IS = {
  effect: { label: "Áhrif", hint: "Hversu miklu þetta hreyfir það sem það tekur á." },
  ease: { label: "Auðvelt", hint: "Hversu vel þetta passar inn í venjulega viku." },
  evidence: { label: "Rannsóknir", hint: "Hversu góðar rannsóknir styðja þetta." },
} as const;

/** What the letter rests on. Shown as-is; a C is not dressed up as an A. */
export const GRADE_IS: Record<string, { label: string; hint: string; className: string }> = {
  A: { label: "A", hint: "Safngreiningar eða margar samhljóða slembirannsóknir.", className: "bg-emerald-100 text-emerald-900" },
  B: { label: "B", hint: "Slembirannsóknir með takmörkunum, eða sterkar framsýnar rannsóknir.", className: "bg-sky-100 text-sky-900" },
  C: { label: "C", hint: "Smærri rannsóknir, lífeðlisfræðileg rök eða samdóma álit sérfræðinga.", className: "bg-slate-100 text-slate-700" },
};

/** "45 mín. á viku" · "innan við 10 mín." · null when it costs no time. */
export function timeCost(minutes?: number | null): string | null {
  if (minutes == null) return null;
  if (minutes === 0) return "engin viðbótartími";
  if (minutes < 10) return "innan við 10 mín. á viku";
  if (minutes < 60) return `${minutes} mín. á viku`;
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${String(h).replace(".", ",")} klst. á viku`;
}
