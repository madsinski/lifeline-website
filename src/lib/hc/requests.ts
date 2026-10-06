// What a participant can ask the coach for, in the words they would use.
//
// The five kinds come from the real situations: I have a question, I want to
// talk to someone, I want to be measured again, the programme does not fit,
// and I have hurt myself. Pure and client-safe — the heilsuferð form and the
// workstation queue read the same list, so the two can never offer and expect
// different things.

export const REQUEST_KINDS = ["help", "appointment", "measurement", "program", "injury"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_IS: Record<RequestKind, {
  label: string;
  hint: string;
  /** What the workstation sees in the queue. */
  short: string;
  cls: string;
  dot: string;
  /** Asked of the participant when they pick this. */
  prompt: string;
}> = {
  help: {
    label: "Ég er með spurningu", short: "Spurning",
    hint: "Hvað sem er — æfing, matur, svefn, eitthvað í skýrslunni.",
    prompt: "Um hvað viltu spyrja?",
    cls: "bg-sky-50 text-sky-900 ring-sky-200", dot: "bg-sky-500",
  },
  appointment: {
    label: "Ég vil tala við einhvern", short: "Viðtal",
    hint: "Myndsímtal eða tími á staðnum. Við höfum samband með tíma.",
    prompt: "Hvað hentar þér? Segðu okkur hvenær þú kemst.",
    cls: "bg-violet-50 text-violet-900 ring-violet-200", dot: "bg-violet-500",
  },
  measurement: {
    label: "Ég vil láta mæla mig aftur", short: "Mæling",
    hint: "Líkamssamsetning, styrkur, þrek eða blóðþrýstingur.",
    prompt: "Viltu segja okkur eitthvað um tímasetningu?",
    cls: "bg-emerald-50 text-emerald-900 ring-emerald-200", dot: "bg-emerald-500",
  },
  program: {
    label: "Áætlunin passar ekki", short: "Áætlun",
    hint: "Of mikið, of lítið, eða hentar ekki deginum þínum.",
    prompt: "Hvað er það sem gengur ekki upp?",
    cls: "bg-amber-50 text-amber-900 ring-amber-200", dot: "bg-amber-500",
  },
  injury: {
    label: "Ég meiddi mig", short: "Meiðsli",
    hint: "Við aðlögum æfingarnar og vísum áfram ef þarf.",
    prompt: "Hvar og hvenær fann þú fyrir þessu?",
    cls: "bg-rose-50 text-rose-900 ring-rose-200", dot: "bg-rose-500",
  },
};

/** The measurements someone can ask to have taken again. */
export const MEASUREMENTS = [
  { key: "bodycomp", label: "Líkamssamsetning", hint: "Fitu- og vöðvamassi (Biody)" },
  { key: "strength", label: "Styrkur", hint: "Gripstyrkur og fótstyrkur" },
  { key: "vo2max", label: "Þrek (VO₂max)", hint: "Þolpróf" },
  { key: "bloodpressure", label: "Blóðþrýstingur", hint: "Mælt á staðnum" },
  { key: "blood", label: "Blóðprufa", hint: "Fastandi að morgni" },
] as const;
export type MeasurementKey = (typeof MEASUREMENTS)[number]["key"];

export const MEETING_WAYS = [
  { key: "video", label: "Myndsímtal" },
  { key: "phone", label: "Símtal" },
  { key: "inperson", label: "Hitta á staðnum" },
] as const;

export const STATUS_IS: Record<string, string> = {
  open: "Ósvarað", in_progress: "Í vinnslu", done: "Afgreitt", cancelled: "Hætt við",
};

export const isKind = (x: unknown): x is RequestKind =>
  typeof x === "string" && (REQUEST_KINDS as readonly string[]).includes(x);

/** One line for the queue, built from the structured part. */
export function requestSummary(kind: RequestKind, detail: Record<string, unknown>): string {
  if (kind === "measurement") {
    const picked = Array.isArray(detail.measurements) ? detail.measurements : [];
    const names = picked.map((k) => MEASUREMENTS.find((m) => m.key === k)?.label ?? String(k));
    return names.length ? names.join(", ") : "Mæling";
  }
  if (kind === "appointment") {
    const way = MEETING_WAYS.find((w) => w.key === detail.way)?.label;
    return way ?? "Viðtal";
  }
  if (kind === "program") {
    const p = typeof detail.pillar === "string" ? detail.pillar : null;
    const IS: Record<string, string> = { exercise: "Hreyfing", nutrition: "Næring", sleep: "Svefn", mental: "Andleg líðan" };
    return p ? (IS[p] ?? p) : "Áætlun";
  }
  return REQUEST_IS[kind].short;
}
