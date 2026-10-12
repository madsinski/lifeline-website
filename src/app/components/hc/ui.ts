// Shared class names for the health-check journey (heilsuferð + vinnustöð),
// built on the --hc-* tokens in globals.css. One button, one card, one tab
// style, so the participant's pages and the nurse's workstation look like
// the same product. Client-safe, no React.

const base = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-hc-element px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand disabled:cursor-not-allowed disabled:opacity-40";

export const hcBtn = {
  base,
  primary: `${base} bg-hc-brand text-white hover:bg-hc-brand-dark`,
  dark: `${base} bg-hc-ink text-white hover:bg-slate-700`,
  secondary: `${base} border border-slate-300 bg-hc-surface text-slate-700 hover:bg-slate-50`,
  ghost: `${base} text-slate-600 hover:bg-slate-100`,
};

/**
 * One card, three weights. Everything on these pages uses one of them.
 *
 * The page is #F8FAFC and a card is white, so the edge is doing all the
 * work of separating them. It used to be ring-slate-100 (#F1F5F9), which
 * against that background is a 2% difference — effectively invisible, which
 * is why the new cards read as floating text rather than as cards.
 *
 * slate-200 with a real shadow is still quiet. The restraint is deliberate:
 * these pages are mostly cards, and if every one of them asserts itself
 * then none of them does. Colour is reserved for the two weights below and
 * for state (a flag, a warning, a done tick) — everything else is the slate
 * scale.
 */
export const hcCard = {
  /** The default. Quiet, but visibly an edge. */
  base: "rounded-hc-card bg-hc-surface shadow-hc-card ring-1 ring-slate-200",
  /** One step up, for the card on a screen that should be read first. */
  raised: "rounded-hc-card bg-hc-surface shadow-hc-raised ring-1 ring-slate-200",
  /** Hero block: dark emerald gradient. The only card that shouts. */
  hero: "rounded-hc-hero bg-gradient-to-br from-hc-hero-from to-hc-hero-to text-white shadow-hc-raised",
  /** Needs an answer — a pending approval, a warning. Brand edge, no fill. */
  accent: "rounded-hc-card bg-hc-surface shadow-hc-card ring-1 ring-slate-200 border-l-4 border-l-hc-brand",
};

/** Page backgrounds: one colour for the workstation, a light wash for the participant. */
export const hcPage = {
  staff: "min-h-screen bg-hc-page",
  participant: "min-h-screen bg-gradient-to-b from-hc-page via-white to-hc-brand-surface",
};

/** Segmented tabs (workstation nav, the participant's nav, plan tabs). */
export const hcTabs = {
  /*
   * No overflow-x-auto: it let the bar scroll sideways rather than fit,
   * which hides the last tabs behind a drag nobody thinks to try.
   *
   * But not fitting is worse than scrolling. The workstation's five tabs
   * run to 509px, so on any phone "Fræðsla og þjálfun" hung off the right
   * edge and body's overflow-x:auto turned the whole page into a sideways
   * scroll — measured at 430, 390 and 360. flex-wrap keeps the rule that
   * nothing is hidden and drops the overflow: a bar that cannot fit on one
   * line becomes two, which is visible and needs no gesture.
   */
  bar: "flex flex-wrap rounded-hc-element bg-hc-surface p-1 ring-1 ring-slate-200",
  tab: (active: boolean) =>
    `min-w-0 flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-hc-ink text-white" : "text-slate-600 hover:bg-slate-50"}`,
};

/** Kicker above a heading ("NÆSTI TÍMI"). */
/*
 * The shared kicker.
 *
 * tracking adds its space *after* the last character too, so a kicker that
 * exactly fills its column overflows by one letter-space — which is how
 * "HEILSUFERÐIN ÞÍN · VESTMANNAEYJAR" pushed the ferðin page 4px wide at
 * 320px, and body's overflow-x:auto turned 4px into a scrollable page.
 *
 * 0.08em is the value the Æfingar and Næring headings already settled on
 * for the same reason, so this brings the shared one into line rather than
 * patching one caller. Still unmistakably a kicker; it just stops reserving
 * space to the right of a letter that has nothing after it.
 */
export const hcKicker = "text-xs font-bold uppercase tracking-[0.08em]";
