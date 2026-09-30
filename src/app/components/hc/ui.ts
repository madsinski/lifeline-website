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

export const hcCard = {
  /** Content card: white, hairline, soft shadow. */
  base: "rounded-hc-card bg-hc-surface shadow-hc-card ring-1 ring-slate-100",
  /** Hero block: dark emerald gradient. */
  hero: "rounded-hc-hero bg-gradient-to-br from-hc-hero-from to-hc-hero-to text-white shadow-hc-raised",
};

/** Page backgrounds: one colour for the workstation, a light wash for the participant. */
export const hcPage = {
  staff: "min-h-screen bg-hc-page",
  participant: "min-h-screen bg-gradient-to-b from-hc-page via-white to-hc-brand-surface",
};

/** Segmented tabs (workstation nav, the participant's nav, plan tabs). */
export const hcTabs = {
  bar: "flex overflow-x-auto rounded-hc-element bg-hc-surface p-1 ring-1 ring-slate-200",
  tab: (active: boolean) =>
    `flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-hc-ink text-white" : "text-slate-600 hover:bg-slate-50"}`,
};

/** Kicker above a heading ("NÆSTI TÍMI"). */
export const hcKicker = "text-xs font-bold uppercase tracking-[0.15em]";
