// Server side of the participant's programme settings: the adaptive
// programme's level/load/injuries (src/lib/hc/adaptive-program.ts) and their
// own arrangement of any programme — days, HIIT split, swapped exercises and
// meal picks (src/lib/hc/personalise.ts). One hc_training_settings row per journey.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_TRAINING, sanitizeTraining, type TrainingSettings } from "./adaptive-program";
import { DEFAULT_PERSONAL, sanitizePersonal, type Personal, type SwapSnapshot } from "./personalise";

const COLS = "level, load_step, injuries, started_on, program_key, days, hiit_split, swaps, meal_picks";

type Row = { level: string; load_step: number; injuries: string[]; started_on: string | null; program_key: string | null; days: Record<string, number> | null; hiit_split: boolean | null; swaps: Record<string, SwapSnapshot> | null; meal_picks: Record<string, string> | null };

function personalOf(r: Row | null): Personal {
  if (!r) return DEFAULT_PERSONAL;
  return { program_key: r.program_key, days: r.days ?? {}, hiit_split: !!r.hiit_split, swaps: r.swaps ?? {}, meal_picks: r.meal_picks ?? {} };
}

export async function loadTraining(journeyId: string): Promise<TrainingSettings & { saved: boolean }> {
  return (await loadPlanPrefs(journeyId)).settings;
}

export async function loadPlanPrefs(journeyId: string): Promise<{ settings: TrainingSettings & { saved: boolean }; personal: Personal }> {
  const { data } = await supabaseAdmin.from("hc_training_settings").select(COLS).eq("journey_id", journeyId).maybeSingle<Row>();
  if (!data) return { settings: { ...DEFAULT_TRAINING, saved: false }, personal: DEFAULT_PERSONAL };
  return {
    settings: { ...sanitizeTraining({ level: data.level, load: data.load_step, injuries: data.injuries, started_on: data.started_on }), saved: true },
    personal: personalOf(data),
  };
}

/** Library rows → the snapshot a plan keeps (Icelandic where translated). */
async function snapshots(ids: string[]): Promise<Map<string, SwapSnapshot>> {
  if (!ids.length) return new Map();
  const { data } = await supabaseAdmin.from("exercises")
    .select("id, name, name_is, illustration_url, video_url, primary_muscles, equipment, instructions, instructions_is")
    .in("id", ids);
  return new Map((data || []).map((x) => [x.id as string, {
    exercise_id: x.id, name: x.name_is || x.name, image: x.illustration_url ?? null, video: x.video_url ?? null,
    muscles: x.primary_muscles ?? [], equipment: x.equipment ?? null,
    cues: ((x.instructions_is?.length ? x.instructions_is : x.instructions) ?? []).slice(0, 6),
  } satisfies SwapSnapshot]));
}

/**
 * Upserts. Only what the body carries changes: adaptive fields when level/
 * load/injuries are sent, personal fields when days/swaps/… are sent. The
 * first save sets the start date to today unless one is given.
 */
export async function saveTraining(journeyId: string, clientId: string, body: Record<string, unknown>, by: string): Promise<{ settings: TrainingSettings & { saved: boolean }; personal: Personal }> {
  const prev = await loadPlanPrefs(journeyId);
  const row: Record<string, unknown> = { journey_id: journeyId, client_id: clientId, updated_by: by, updated_at: new Date().toISOString() };

  const adaptive = "level" in body || "load" in body || "injuries" in body || "started_on" in body;
  const s = adaptive ? sanitizeTraining({ ...prev.settings, ...body }) : prev.settings;
  const started_on = s.started_on ?? (prev.settings.saved ? prev.settings.started_on : null) ?? new Date().toISOString().slice(0, 10);
  Object.assign(row, { level: s.level, load_step: s.load, injuries: s.injuries, started_on });

  const p = sanitizePersonal(body);
  const personal: Personal = { ...prev.personal };
  if ("program_key" in body) personal.program_key = p.program_key;
  // A different programme starts clean.
  if (personal.program_key !== prev.personal.program_key) Object.assign(personal, { days: {}, swaps: {}, hiit_split: false });
  if ("days" in body) personal.days = p.days;
  if ("hiit_split" in body) personal.hiit_split = p.hiit_split;
  if ("meal_picks" in body) personal.meal_picks = p.meal_picks;
  if ("swaps" in body) {
    const want = Object.entries(p.swapIds).filter((e): e is [string, string] => !!e[1]);
    const fresh = await snapshots([...new Set(want.map(([, id]) => id).filter((id) => !Object.values(prev.personal.swaps).some((x) => x.exercise_id === id)))]);
    const known = new Map(Object.values(prev.personal.swaps).map((x) => [x.exercise_id, x]));
    personal.swaps = Object.fromEntries(want.map(([k, id]) => [k, known.get(id) ?? fresh.get(id)]).filter((e): e is [string, SwapSnapshot] => !!e[1]));
  }
  Object.assign(row, personal);

  const { error } = await supabaseAdmin.from("hc_training_settings").upsert(row, { onConflict: "journey_id" });
  if (error) throw new Error(error.message);
  return { settings: { ...s, started_on, saved: true }, personal };
}
