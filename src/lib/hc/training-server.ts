// Server side of the adaptive training programme: read and write a journey's
// hc_training_settings row (see src/lib/hc/adaptive-program.ts).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_TRAINING, sanitizeTraining, type TrainingSettings } from "./adaptive-program";

export async function loadTraining(journeyId: string): Promise<TrainingSettings & { saved: boolean }> {
  const { data } = await supabaseAdmin.from("hc_training_settings").select("level, load_step, injuries, started_on").eq("journey_id", journeyId).maybeSingle();
  if (!data) return { ...DEFAULT_TRAINING, saved: false };
  return { ...sanitizeTraining({ level: data.level, load: data.load_step, injuries: data.injuries, started_on: data.started_on }), saved: true };
}

/** Upserts; the first save sets the start date to today unless one is given. */
export async function saveTraining(journeyId: string, clientId: string, body: Record<string, unknown>, by: string): Promise<TrainingSettings & { saved: boolean }> {
  const s = sanitizeTraining(body);
  const prev = await loadTraining(journeyId);
  const started_on = s.started_on ?? (prev.saved ? prev.started_on : null) ?? new Date().toISOString().slice(0, 10);
  const { error } = await supabaseAdmin.from("hc_training_settings").upsert({
    journey_id: journeyId, client_id: clientId, level: s.level, load_step: s.load, injuries: s.injuries,
    started_on, updated_by: by, updated_at: new Date().toISOString(),
  }, { onConflict: "journey_id" });
  if (error) throw new Error(error.message);
  return { ...s, started_on, saved: true };
}
