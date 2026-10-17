// The guided setup at /app/uppsetning: its steps, in order, and how far
// somebody has got. Client-safe; the server route (/api/hc/setup) and the
// screens share it so they agree on the keys.
//
// Nothing here is a gate. Every step can be skipped, and a step counts as
// done either because the person finished it in the setup or because the
// thing already exists (an address on file, a plan, a report).

export const SETUP_STEPS = ["heimilisfang", "skyrsla", "aaetlun", "hreyfing", "app", "tilkynningar"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export const isSetupStep = (s: unknown): s is SetupStep => (SETUP_STEPS as readonly unknown[]).includes(s);

export const SETUP_TITLES: Record<SetupStep, string> = {
  heimilisfang: "Heimilisfang",
  skyrsla: "Skýrsla úr heilsufarsskoðun",
  aaetlun: "Áætlunin þín",
  hreyfing: "Hreyfing og það sem þarf að varast",
  app: "Appið á heimaskjáinn",
  tilkynningar: "Áminningar",
};

export type StepStatus = "done" | "skipped";

export interface SetupProgress {
  steps: Partial<Record<SetupStep, { status: StepStatus; at: string }>>;
  /** Small answers later steps reuse — never health data. */
  data: { days?: number[]; hour?: number | null; scenario?: string | null };
  current: SetupStep | null;
  started_at: string | null;
  dismissed_at: string | null;
  completed_at: string | null;
}

export interface SetupContext {
  entry: string | null;
  has_journey: boolean;
  has_plan: boolean;
  has_report: boolean;
  terms_accepted: boolean;
  training_saved: boolean;
  address: string | null;
  /** An address read from the person's own uploaded report, if it had one. */
  report_address: string | null;
  portal_url: string;
  nudges_on: boolean;
}

export const EMPTY_PROGRESS: SetupProgress = {
  steps: {}, data: {}, current: null, started_at: null, dismissed_at: null, completed_at: null,
};

/** Done because it already exists, whatever the setup recorded. */
export function doneByFact(step: SetupStep, c: SetupContext): boolean {
  switch (step) {
    case "heimilisfang": return !!c.address && /,\s*\d{3}\s/.test(c.address);
    case "skyrsla": return c.has_report;
    case "aaetlun": return c.has_plan;
    case "hreyfing": return c.training_saved;
    case "tilkynningar": return c.nudges_on;
    default: return false;
  }
}

/** Each step's state: done, skipped, or still open. */
export function stepState(step: SetupStep, p: SetupProgress, c: SetupContext): "done" | "skipped" | "open" {
  if (doneByFact(step, c) || p.steps[step]?.status === "done") return "done";
  if (p.steps[step]?.status === "skipped") return "skipped";
  return "open";
}

/** How many of the six are behind them (done or deliberately skipped). */
export function setupCount(p: SetupProgress, c: SetupContext): { handled: number; total: number } {
  const handled = SETUP_STEPS.filter((s) => stepState(s, p, c) !== "open").length;
  return { handled, total: SETUP_STEPS.length };
}

/** Where "Halda áfram" should land: the saved step if still open, else the first open one. */
export function resumeStep(p: SetupProgress, c: SetupContext): SetupStep {
  if (p.current && stepState(p.current, p, c) === "open") return p.current;
  return SETUP_STEPS.find((s) => stepState(s, p, c) === "open") ?? SETUP_STEPS[0];
}
