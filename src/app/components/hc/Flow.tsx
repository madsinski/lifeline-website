// The shape of one step in a client's journey.
//
// This used to hold the vertical accordion the workstation was built around:
// each step a row, the outstanding one open, the rest collapsed to a line.
// The journey is a horizontal StatusStrip now with a single panel under it,
// so the accordion and the Drawer that went with it are gone and only the
// shape survives — buildSteps in the workstation still speaks it.
//
// Types only: no component, so this is not a client module.

import type { ReactNode } from "react";

/** done = behind us · current = your move · waiting = someone else's move · upcoming = not yet */
export type StepState = "done" | "current" | "waiting" | "upcoming";

export interface FlowStep {
  key: string;
  title: string;
  icon: ReactNode;
  state: StepState;
  /** One line: what is true right now. */
  status: string;
  body: ReactNode;
  /** Hide the step entirely (e.g. follow-up before there is a plan). */
  hidden?: boolean;
}
