// What a participant's reminder says, from their plan, ticks and settings.
// Pure: the cron (src/app/api/cron/hc-nudges) gathers the data and sends.

import { adherence, type ActionLog, type ActionPref } from "./adherence";
import { adaptExercise, isAdaptive, type TrainingSettings } from "./adaptive-program";
import type { ActionPlan } from "./types";

export type NudgeMode = "daily" | "behind" | "weekly";
export interface NudgeMessage { title: string; body: string }

const WD = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} og ${xs.at(-1)}`);

/** null = nothing worth sending (e.g. "behind" but they ticked recently). */
export function nudgeMessage(opts: {
  mode: NudgeMode;
  plan: Pick<ActionPlan, "modules" | "exercise" | "start_date">;
  logs: ActionLog[];
  prefs: ActionPref[];
  training: TrainingSettings | null;
  today: string;          // YYYY-MM-DD (Iceland = UTC)
  weekday: number;        // 0 = Sunday
}): NudgeMessage | null {
  const hidden = new Set(opts.prefs.filter((p) => p.hidden).map((p) => p.action_uid));
  const live = opts.plan.modules.filter((m) => !hidden.has(m.uid));
  if (!live.length) return null;
  const doneToday = new Set(opts.logs.filter((l) => l.done_on === opts.today).map((l) => l.action_uid));
  const yesterday = new Date(Date.parse(opts.today) - 86400_000).toISOString().slice(0, 10);

  if (opts.mode === "behind") {
    const recent = opts.logs.some((l) => l.done_on === opts.today || l.done_on === yesterday);
    if (recent) return null;
    return {
      title: "Eitt atriði í dag er nóg",
      body: `Ekkert hefur verið merkt í tvo daga. Það er eðlilegt að detta úr takti. Byrjaðu á einu: ${live[0].title}.`,
    };
  }

  if (opts.mode === "weekly") {
    if (opts.weekday !== 0) return null;
    const a = adherence(live, opts.logs, opts.prefs, 7, new Date(`${opts.today}T12:00:00Z`));
    return {
      title: "Vikan þín",
      body: `${a.done} merkingar af ${a.target} í vikunni (${a.percent}%).${a.streak > 1 ? ` ${a.streak} dagar í röð.` : ""} Ný vika byrjar á morgun.`,
    };
  }

  // daily
  const open = live.filter((m) => !doneToday.has(m.uid)).map((m) => m.title);
  const ex = opts.plan.exercise
    ? (isAdaptive(opts.plan.exercise.key) && opts.training ? adaptExercise(opts.plan.exercise, opts.training, opts.plan.start_date) : opts.plan.exercise)
    : null;
  const session = ex?.sessions.find((s) => s.day.toLowerCase().startsWith(WD[opts.weekday]));
  if (!open.length && !session) return null;
  const parts = [
    open.length
      ? `${open.length} atriði: ${open.length > 3 ? `${open.slice(0, 3).join(", ")} og fleira` : list(open)}.`
      : "Allt merkt í dag. Vel gert.",
    session ? `Æfing dagsins: ${session.title}${session.minutes ? ` (um ${session.minutes} mín.)` : ""}.` : null,
  ].filter(Boolean);
  return { title: "Í dag hjá þér", body: parts.join(" ") };
}
