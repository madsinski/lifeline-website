// Loads a participant's last N days of activity (see ./activity.ts) with the
// service-role client. Server-only. Every query is pinned to one client_id
// (and the habit ticks to that client's journey), so the caller decides who
// may see whom and this cannot widen it.
// Schema: supabase/migration-session-substitutions.sql (substituted,
// prescribed_label on client_session_completions).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { SLOT_IS, type MealSlot } from "./meals";
import type { ActivityEntry } from "./activity";

export function clampDays(v: string | null | undefined, def = 14): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.min(60, Math.floor(n)) : def;
}

const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export async function loadActivity(clientId: string, journeyId: string | null, days = 14): Promise<ActivityEntry[]> {
  const sinceDate = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);

  const [{ data: workouts }, { data: meals }, logsRes, planRes] = await Promise.all([
    supabaseAdmin.from("client_session_completions")
      .select("completed_action_key, prescribed_action_key, prescribed_label, modality, duration_min, intensity_rpe, substituted, completed_at")
      .eq("client_id", clientId).gte("completed_at", `${sinceDate}T00:00:00Z`)
      .order("completed_at", { ascending: false }).limit(300),
    supabaseAdmin.from("meal_log")
      .select("date, action_key, source, description, kcal, protein, logged_at")
      .eq("client_id", clientId).gte("date", sinceDate)
      .order("date", { ascending: false }).limit(300),
    journeyId
      ? supabaseAdmin.from("hc_action_logs").select("action_uid, done_on, created_at")
          .eq("journey_id", journeyId).eq("client_id", clientId).gte("done_on", sinceDate).limit(500)
      : Promise.resolve({ data: [] as { action_uid: string; done_on: string; created_at: string | null }[] }),
    journeyId
      ? supabaseAdmin.from("hc_action_plans_decrypted").select("modules").eq("journey_id", journeyId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const titles = new Map<string, string>();
  for (const m of ((planRes.data as { modules?: { uid?: string; title?: string }[] } | null)?.modules ?? [])) {
    if (m?.uid && m.title) titles.set(m.uid, m.title);
  }

  const out: ActivityEntry[] = [];
  for (const w of workouts ?? []) {
    const label = String(w.completed_action_key ?? "").trim();
    if (!label) continue;
    out.push({
      kind: "workout",
      date: String(w.completed_at).slice(0, 10),
      at: w.completed_at as string,
      label,
      modality: (w.modality as string) ?? null,
      minutes: num(w.duration_min),
      rpe: num(w.intensity_rpe),
      substituted: !!w.substituted,
      replaced: w.substituted ? ((w.prescribed_label as string | null) || null) : null,
    });
  }
  for (const m of meals ?? []) {
    const slot = (m.action_key as string) ?? null;
    const described = m.source === "described";
    out.push({
      kind: "meal",
      date: String(m.date),
      at: (m.logged_at as string) ?? null,
      label: String(m.description ?? "").trim() || (slot && SLOT_IS[slot as MealSlot]) || "Máltíð",
      slot: slot && SLOT_IS[slot as MealSlot] ? SLOT_IS[slot as MealSlot] : null,
      described,
      kcal: num(m.kcal) != null ? Math.round(num(m.kcal)!) : null,
      protein: num(m.protein) != null ? Math.round(num(m.protein)!) : null,
    });
  }
  for (const l of (logsRes.data ?? []) as { action_uid: string; done_on: string; created_at: string | null }[]) {
    out.push({
      kind: "habit",
      date: l.done_on,
      at: l.created_at ?? null,
      label: titles.get(l.action_uid) ?? "Venja",
    });
  }
  return out.sort((a, b) => (a.date === b.date ? (a.at ?? "").localeCompare(b.at ?? "") : a.date < b.date ? 1 : -1));
}
