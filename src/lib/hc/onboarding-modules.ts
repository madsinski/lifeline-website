// The pieces an onboarding journey can be built from.
//
// Everything named here already exists somewhere in the product — a
// slideshow component, a consent form, a question, a lecture row, a booking
// screen. What did not exist was a list of them, an order, or any way to
// change that order without editing a React component. So this is a
// registry: each kind points at content or a screen that is already built,
// and a flow is a sequence of them with their settings.
//
// Two rules it is built around:
//
//   A module declares what it NEEDS and what it WRITES. A flow that asks for
//   measurements before the person has paid, or shows a plan before anything
//   has been answered, is a flow that will dead-end somebody — so the
//   composer can check the order instead of discovering it in production.
//
//   Nothing here holds copy. Copy lives where it already lives: lectures in
//   hc_lectures, consent text in public-pages-content, the questions in
//   start-flow. A registry that duplicated the text would be a second place
//   for it to go stale.

export type ModuleKind =
  | "welcome"
  | "pillars"
  | "limits"
  | "recommend"
  | "lecture"
  | "consent"
  | "profile"
  | "question"
  | "track"
  | "package"
  | "measurements"
  | "install"
  | "notifications"
  | "summary";

/** What a step can depend on, and what it produces. Used to order-check. */
export type Capability =
  | "account"      // a signed-in user
  | "pillars"      // the four self-assessments
  | "limits"       // injuries and limitations declared
  | "consent"      // terms accepted
  | "profile"      // name, contact, date of birth, sex
  | "answers"      // the goal/activity/age questions
  | "track"        // health check vs coaching chosen
  | "payment";     // an order exists

export interface ModuleDef {
  kind: ModuleKind;
  label: string;
  /** What the admin is told it does. */
  blurb: string;
  /** Must already be true when this step runs. */
  needs: Capability[];
  /** True once it has run. */
  gives: Capability[];
  /** Whether a flow may contain more than one. */
  repeatable: boolean;
  /** Which config fields the composer should offer. */
  config?: ("lectureSlug" | "questionKey" | "title" | "body" | "skippable")[];
}

export const MODULES: ModuleDef[] = [
  {
    kind: "welcome", label: "Kynning",
    blurb: "Myndasyrpan sem kynnir Lifeline. Hægt að stytta eða sleppa.",
    needs: ["account"], gives: [], repeatable: false, config: ["title", "skippable"],
  },
  {
    kind: "consent", label: "Skilmálar og samþykki",
    blurb: "Notkunarskilmálar og persónuverndarstefna. Skylda áður en heilsufarsupplýsingar eru vistaðar.",
    needs: ["account"], gives: ["consent"], repeatable: false,
  },
  {
    kind: "question", label: "Spurning",
    blurb: "Ein spurning með svarmöguleikum — markmið, hreyfing eða aldur. Svörin stýra tillögunni.",
    needs: ["account"], gives: ["answers"], repeatable: true, config: ["questionKey", "skippable"],
  },
  {
    /* From the RN app's step 2. Four sliders is the fastest way to a
       starting level that is not a guess, and the adaptive programme
       already reads levels — it was computing them from measurements the
       coaching track never takes. */
    kind: "pillars", label: "Sjálfsmat á stoðunum",
    blurb: "Svefn, næring, hreyfing og andleg líðan — hvar viðkomandi telur sig standa. Gefur upphafsstig.",
    needs: ["account"], gives: ["pillars"], repeatable: false, config: ["skippable"],
  },
  {
    /* The one module that is not optional on an exercise track. Prescribing
       squats to somebody with a knee they did not get to mention is the
       failure this prevents, and it has to come BEFORE anything that
       produces a programme. */
    kind: "limits", label: "Meiðsli og takmarkanir",
    blurb: "Verkir, meiðsli, þungun eða annað sem breytir æfingum. Kemur á undan áætlun.",
    needs: ["account"], gives: ["limits"], repeatable: false,
  },
  {
    /* Shows the programme the answers produce, before it is applied.
       Requires the limitations: a recommendation made without them is one
       that has to be withdrawn. */
    kind: "recommend", label: "Tillaga að prógrammi",
    blurb: "Prógrammið sem svörin gefa, til samþykktar. Þarf stoðamat og takmarkanir á undan.",
    needs: ["answers", "pillars", "limits"], gives: [], repeatable: false, config: ["title"],
  },
  {
    kind: "summary", label: "Tillaga",
    blurb: "Það sem svörin gefa: fjöldi æfinga, áhersla og upphafspunktur.",
    needs: ["answers"], gives: [], repeatable: false, config: ["title"],
  },
  {
    kind: "track", label: "Velja leið",
    blurb: "Heilsufarsskoðun eða þjálfun í appinu. Setur entry á ferðina.",
    needs: ["account"], gives: ["track"], repeatable: false,
  },
  {
    kind: "profile", label: "Upplýsingar",
    blurb: "Nafn, sími, fæðingardagur og kyn. Kyn þarf til að viðmiðin séu rétt.",
    needs: ["account", "consent"], gives: ["profile"], repeatable: false, config: ["skippable"],
  },
  {
    kind: "lecture", label: "Fræðsla",
    blurb: "Fyrirlestur úr safninu — myndband, glærur eða grein.",
    needs: ["account"], gives: [], repeatable: true, config: ["lectureSlug", "skippable"],
  },
  {
    kind: "package", label: "Pakki og greiðsla",
    blurb: "Velja pakka og greiða. Á aðeins við þegar leiðin er heilsufarsskoðun.",
    needs: ["track"], gives: ["payment"], repeatable: false,
  },
  {
    kind: "measurements", label: "Bóka mælingar",
    blurb: "Tímabókun fyrir mælingar og blóðprufu í Medalia.",
    needs: ["track", "payment"], gives: [], repeatable: false,
  },
  {
    kind: "install", label: "Setja upp appið",
    blurb: "Leiðbeiningar um að bæta appinu á heimaskjáinn.",
    needs: ["account"], gives: [], repeatable: false, config: ["skippable"],
  },
  {
    kind: "notifications", label: "Tilkynningar",
    blurb: "Biðja um leyfi fyrir áminningum. Best eftir að eitthvað er komið til að minna á.",
    needs: ["account"], gives: [], repeatable: false, config: ["skippable"],
  },
];

export const moduleDef = (k: ModuleKind) => MODULES.find((m) => m.kind === k);

/** One step in a composed flow. */
export interface FlowStep {
  id: string;
  kind: ModuleKind;
  lectureSlug?: string | null;
  questionKey?: "goal" | "move" | "age" | null;
  title?: string | null;
  body?: string | null;
  skippable?: boolean;
}

/**
 * What is wrong with this order, in the admin's words.
 *
 * Returns one message per broken step rather than a boolean: "the flow is
 * invalid" tells somebody to go hunting, and the thing they would find is
 * exactly what this already knows.
 */
export function flowProblems(steps: FlowStep[]): { id: string; message: string }[] {
  const out: { id: string; message: string }[] = [];
  const have = new Set<Capability>(["account"]); // signing in is the premise
  const seen = new Map<ModuleKind, number>();

  for (const s of steps) {
    const def = moduleDef(s.kind);
    if (!def) { out.push({ id: s.id, message: "Óþekkt eining." }); continue; }

    const missing = def.needs.filter((n) => !have.has(n));
    if (missing.length) {
      const names = missing.map((m) => ({
        account: "innskráningu", consent: "samþykki", profile: "upplýsingar",
        answers: "svör við spurningum", track: "val á leið", payment: "greiðslu",
        pillars: "sjálfsmat á stoðunum", limits: "upplýsingar um meiðsli",
      } as Record<Capability, string>)[m]);
      out.push({ id: s.id, message: `Vantar ${names.join(" og ")} á undan.` });
    }

    const n = (seen.get(s.kind) ?? 0) + 1;
    seen.set(s.kind, n);
    if (n > 1 && !def.repeatable) {
      out.push({ id: s.id, message: `${def.label} má aðeins vera einu sinni.` });
    }
    if (s.kind === "lecture" && !s.lectureSlug) {
      out.push({ id: s.id, message: "Veldu fyrirlestur." });
    }
    if (s.kind === "question" && !s.questionKey) {
      out.push({ id: s.id, message: "Veldu spurningu." });
    }

    for (const g of def.gives) have.add(g);
  }
  return out;
}

/** The sequence shipped today, as a starting point rather than a blank page. */
export const DEFAULT_FLOW: Omit<FlowStep, "id">[] = [
  { kind: "consent" },
  { kind: "question", questionKey: "goal" },
  { kind: "question", questionKey: "move" },
  { kind: "question", questionKey: "age" },
  { kind: "pillars" },
  { kind: "limits" },
  { kind: "summary" },
  { kind: "track" },
  { kind: "profile", skippable: true },
  { kind: "install", skippable: true },
];
