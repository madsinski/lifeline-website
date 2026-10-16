// What a participant can ask the coach for, in the words they would use.
//
// The five kinds come from the real situations: I have a question, I want to
// talk to someone, I want to be measured again, the programme does not fit,
// and I have hurt myself. Pure and client-safe — the heilsuferð form and the
// workstation queue read the same list, so the two can never offer and expect
// different things.

export const REQUEST_KINDS = ["help", "medical", "appointment", "measurement", "program", "injury"] as const;
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
    /* No longer "eitthvað í skýrslunni". Questions about results belong to
       the medical kind below, which points to the doctor in Medalia: a coach reading a
       blood test back to somebody is practising medicine, and the old hint
       invited exactly that. */
    hint: "Æfingar, matur, svefn eða áætlunin þín.",
    prompt: "Um hvað viltu spyrja?",
    cls: "bg-sky-50 text-sky-900 ring-sky-200", dot: "bg-sky-500",
  },
  /* Anything clinical. Separated from "spurning" so it can be routed to a
     doctor rather than to the coach — the coach does not interpret
     measurements, blood tests, symptoms or medication, and the form should
     not quietly accept questions it cannot answer. */
  medical: {
    label: "Ég vil ræða heilsufar eða niðurstöður", short: "Læknir",
    hint: "Blóðprufa, mælingar, einkenni eða lyf. Þjálfarinn vísar þér á lækni í sjúklingagáttinni.",
    prompt: "Hvað viltu að læknirinn viti fyrir fram?",
    cls: "bg-sky-50 text-sky-900 ring-sky-200", dot: "bg-sky-600",
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


/**
 * One question after the situation, no more.
 *
 * The form asked what the situation was and then handed over a blank box,
 * so what arrived was "hæ, ég er í vandræðum með æfingarnar" and the coach
 * spent the first reply asking which part. One multiple choice closes most
 * of that gap, and a second would start to feel like a form.
 *
 * Kinds already carrying their own structured follow-up — measurement picks
 * a list, appointment picks a way, program picks a pillar — are absent here
 * on purpose: they ask their own question already.
 */
export const TOPICS: Partial<Record<RequestKind, { q: string; options: { key: string; label: string }[] }>> = {
  help: {
    q: "Um hvað snýst spurningin?",
    options: [
      { key: "exercise", label: "Æfingar" },
      { key: "nutrition", label: "Næring" },
      { key: "sleep", label: "Svefn" },
      { key: "mental", label: "Andleg líðan" },
      { key: "practical", label: "Aðgangur, tímar eða reikningar" },
      { key: "other", label: "Annað" },
    ],
  },
  medical: {
    q: "Hvað viltu ræða?",
    options: [
      { key: "blood", label: "Niðurstöður úr blóðprufu" },
      { key: "measures", label: "Niðurstöður úr mælingum" },
      { key: "symptom", label: "Einkenni eða verkir" },
      { key: "meds", label: "Lyf" },
      { key: "other", label: "Annað heilsufarslegt" },
    ],
  },
  injury: {
    q: "Hvað á við?",
    options: [
      { key: "new", label: "Nýtt — gerðist nýlega" },
      { key: "old", label: "Gamalt sem er að taka sig upp" },
      { key: "worse", label: "Versnar við æfingar" },
      { key: "severe", label: "Mikill verkur eða ég kemst illa um" },
    ],
  },
};

/**
 * Whether this request should be put in front of a doctor rather than a
 * coach, and the reason to show the person.
 *
 * Deliberately generous: anything clinical, and an injury that is severe or
 * getting worse. Being sent to a doctor you did not need costs a cancelled
 * booking; the other error costs more.
 */
export function needsDoctor(kind: RequestKind, topic?: string | null): string | null {
  if (kind === "medical") {
    return topic === "blood" || topic === "measures"
      ? "Þjálfarinn les ekki úr blóðprufum eða mælingum. Læknir fer yfir niðurstöðurnar með þér í sjúklingagáttinni (Medalia)."
      : "Þetta á heima hjá lækni frekar en þjálfara.";
  }
  if (kind === "injury" && (topic === "severe" || topic === "worse")) {
    return "Láttu lækni líta á þetta áður en þú heldur áfram með æfingarnar.";
  }
  return null;
}

/**
 * The ready-made way to answer each kind, in the workstation.
 *
 * `action` is the thing that actually resolves the request (book the
 * measurement, book a call, change the plan); the templates are the
 * reply the participant reads afterwards. A coach can edit any template
 * before sending — they are a starting point, not a form letter.
 */
/** "referral" is kept in the type for old callers; no kind uses it any more. */
export type RequestAction = "book-measurement" | "book-video" | "referral" | "plan";

export const REQUEST_RESPONSES: Record<RequestKind, {
  action?: { key: RequestAction; label: string };
  templates: { label: string; text: string }[];
}> = {
  help: {
    templates: [
      { label: "Svarað í samtalinu", text: "Takk fyrir spurninguna! Ég svaraði þér í samtalinu í appinu." },
      { label: "Svar kemur", text: "Takk fyrir spurninguna. Ég skoða þetta og svara þér á næsta þjónustudegi." },
    ],
  },
  /* No action since the Medalia split (2026-10-16): Lifeline has no doctor
     path any more, and the referral sheet is Vera partners only. Clinical
     questions go to the doctor in Medalia; the reply says where. */
  medical: {
    templates: [
      { label: "Til læknis í Medalia", text: "Takk fyrir. Spurningar um niðurstöður, einkenni eða lyf á best að ræða við lækni. Þú getur sent lækninum skilaboð eða bókað læknisviðtal í sjúklingagáttinni (Medalia)." },
      { label: "Heilsugæslan", text: "Takk fyrir. Þetta er best að ræða við heimilislækni á heilsugæslunni þinni, sem getur skoðað þig og fylgt því eftir." },
      { label: "Bráð einkenni", text: "Ef einkennin eru bráð eða versna skaltu hringja í 112 eða hafa samband við heilsugæsluna." },
    ],
  },
  appointment: {
    action: { key: "book-video", label: "Bóka viðtal" },
    templates: [
      { label: "Viðtal bókað", text: "Viðtalið er bókað. Þú sérð tímann í heilsuferðinni og færð áminningu." },
      { label: "Hvenær hentar?", text: "Takk! Hvaða dagar og tímar henta þér best?" },
    ],
  },
  measurement: {
    action: { key: "book-measurement", label: "Bóka mælingu" },
    templates: [
      { label: "Mæling bókuð", text: "Mælingin er bókuð. Þú sérð tímann í heilsuferðinni og færð áminningu." },
      { label: "Hvenær hentar?", text: "Takk! Hvaða dagar henta þér best fyrir mælingu?" },
    ],
  },
  program: {
    action: { key: "plan", label: "Opna áætlunina" },
    templates: [
      { label: "Áætlun aðlöguð", text: "Takk fyrir að láta vita. Ég hef aðlagað áætlunina. Kíktu á hana í appinu." },
      { label: "Nánari upplýsingar", text: "Takk fyrir að láta vita. Hvað myndi henta betur, til dæmis færri æfingar eða aðrir dagar?" },
    ],
  },
  injury: {
    action: { key: "plan", label: "Aðlaga æfingar" },
    templates: [
      { label: "Æfingar aðlagaðar", text: "Leitt að heyra. Ég hef aðlagað æfingarnar svo þú hlífir svæðinu. Ef verkurinn versnar eða lagast ekki á nokkrum dögum skaltu leita til heilsugæslunnar." },
      { label: "Nánari lýsing", text: "Leitt að heyra. Geturðu lýst betur hvar verkurinn er og hvort hann versnar við hreyfingu?" },
    ],
  },
};
