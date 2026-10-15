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
  | "setup"
  | "summary"
  | "training";

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
  /**
   * Only meaningful for the coaching audience.
   *
   * The health assessment is a medical service — measurements, bloods and a
   * doctor's report, in Medalia. Nothing here produces a clinical finding,
   * and asking somebody who already has that report to self-assess would be
   * offering them a worse version of it. The composer warns when one of
   * these lands in a check-track flow rather than refusing it, because a
   * mixed flow is a judgement call and not an error.
   */
  coachingOnly?: boolean;
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
    blurb: "Ein spurning með svarmöguleikum — markmið, hreyfing eða aldur. Svörin ráða upphafssniðinu.",
    needs: ["account"], gives: ["answers"], repeatable: true, config: ["questionKey", "skippable"],
    coachingOnly: true,
  },
  {
    /* Not a diagnosis and not a substitute for one.
       The health assessment is a medical service: measurements, bloods, a
       doctor's reading, all of it in Medalia. Somebody who holds that report
       must not then be asked to rate their own health — it would be offering
       a worse version of what they already have. This asks the coaching
       audience which areas they want to work on, so the starting template
       has somewhere to start. */
    kind: "pillars", label: "Sjálfsmat á heilsunni",
    blurb: "Hvaða svið viltu vinna með — svefn, næring, hreyfing eða andleg líðan. Ræður upphafssniðinu. Á við þjálfun, ekki heilsufarsskoðun.",
    needs: ["account"], gives: ["pillars"], repeatable: false, config: ["skippable"],
    coachingOnly: true,
  },
  {
    /* The one module that is not optional on an exercise track. Prescribing
       squats to somebody with a knee they did not get to mention is the
       failure this prevents, and it has to come BEFORE anything that
       produces a programme. */
    kind: "limits", label: "Meiðsli og takmarkanir",
    blurb: "Verkir, meiðsli, þungun eða annað sem breytir æfingum. Kemur á undan áætlun. Á við þjálfun.",
    needs: ["account"], gives: ["limits"], repeatable: false,
    coachingOnly: true,
  },
  {
    /* The coaching track's one real decision, on one screen: how much they
       move now and what the body needs spared. It writes
       hc_training_settings — the training source of truth — directly, so
       what is asked here is what the programme is built from. Before this,
       the move and limits answers sat in hc_onboarding_progress where
       nothing ever read them. The player adds it for the coaching tracks
       when a flow leaves it out, so it can never be lost by a republish. */
    kind: "training", label: "Hreyfing og það sem þarf að varast",
    blurb: "Hve mikið viðkomandi hreyfir sig og hvað þarf að hlífa. Vistast beint í æfingastillingarnar. Á við þjálfun.",
    needs: ["account"], gives: ["limits"], repeatable: false,
    coachingOnly: true,
  },
  {
    /* Shows the programme the answers produce, before it is applied.
       Requires the limitations: a recommendation made without them is one
       that has to be withdrawn. */
    kind: "recommend", label: "Upphafssnið",
    blurb: "Gróft snið út frá svörunum, sem viðkomandi stillir svo sjálf/ur. Þarf sjálfsmat og takmarkanir á undan. Á við þjálfun.",
    needs: ["answers", "pillars", "limits"], gives: [], repeatable: false, config: ["title"],
    coachingOnly: true,
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
    /* The four-step walkthrough from /app/adgangur: coach, calendar,
       accountability partner, reminders. It exists either way — the
       settings page shows the same controls open and in place — but as a
       guided walk it belongs to somebody's first week, which is here. */
    kind: "setup", label: "Uppsetning, skref fyrir skref",
    blurb: "Þjálfari, dagatal, ábyrgðarfélagi og áminningar — fjögur atriði, eitt í einu. Sömu stillingar og eru á aðgangssíðunni.",
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
export function flowProblems(steps: FlowStep[], audience?: string): { id: string; message: string }[] {
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

    /* The assessment is a medical service and its report comes from a
       doctor. A question that produces a starting template has nothing to
       add to somebody who already holds one. */
    if (audience === "check" && def.coachingOnly) {
      out.push({ id: s.id, message: `${def.label} á við þjálfun — ekki þá sem eru með heilsufarsskýrslu.` });
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

/**
 * Kinds the player no longer shows, whatever a published flow says.
 *
 * Each was either asked somewhere else first (the route and the three
 * questions on /byrja, the terms at signup), promised something nothing
 * applied (pillars, summary, recommend), or was a link out of onboarding
 * into a screen that sent the person straight back into it (package,
 * measurements, profile). They stay in the registry so old flows still
 * validate; the player simply walks past them.
 */
export const RETIRED_KINDS: ModuleKind[] = [
  "welcome", "pillars", "recommend", "summary", "track", "profile",
  "package", "measurements", "setup", "notifications",
  // Asked on the training screen instead, where the answer is used.
  "limits",
];

/** What the player knows about the person, to decide what still applies. */
export interface FlowContext {
  /** The journey's track: coaching-only ("coach"/"app") or the health check. */
  entry: "check" | "coach" | "app" | null;
  /** Terms already accepted (at signup or earlier). */
  termsAccepted: boolean;
  /** Answers on file, including those carried over from /byrja. */
  answers: Record<string, unknown>;
  /** hc_training_settings already exists for this journey. */
  trainingSaved: boolean;
}

export const isCoachingEntry = (e: FlowContext["entry"]) => e === "coach" || e === "app";

/**
 * Whether one step of a published flow still has anything to ask.
 *
 * The flow in the database is whatever an admin last published, and it may
 * predate /byrja. Rather than trusting it to be short, the player asks this
 * of every step and skips what is already answered — so a long flow
 * degrades to a short one instead of asking the same thing twice.
 */
export function stepApplies(s: FlowStep, ctx: FlowContext): boolean {
  if (RETIRED_KINDS.includes(s.kind)) return false;
  const coaching = isCoachingEntry(ctx.entry);
  if (moduleDef(s.kind)?.coachingOnly && !coaching) return false;
  if (s.kind === "consent") return !ctx.termsAccepted;
  if (s.kind === "training") return coaching && !ctx.trainingSaved;
  if (s.kind === "question") {
    if (!s.questionKey) return false;
    if (ctx.answers[s.questionKey]) return false;
    // The training screen asks this itself, next to the limits.
    if (s.questionKey === "move") return false;
    return true;
  }
  return true;
}

/** The sequence shipped today, as a starting point rather than a blank page.
 *  Short on purpose: the route, goal, activity and age are asked on /byrja
 *  and the terms at signup, so all that is left for the coaching track is
 *  the training screen, and the app on the home screen for everyone. */
export const DEFAULT_FLOW: Omit<FlowStep, "id">[] = [
  { kind: "consent" },
  { kind: "question", questionKey: "goal" },
  { kind: "training" },
  { kind: "install", skippable: true },
];
