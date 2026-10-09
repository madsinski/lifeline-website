// Resolve a day's actions, the way the app does.
//
// Ported from fhir-health-dashboard/src/services/api.ts:1691
// (getProgramActionsForDay). That function is not a query — it is base rows
// from program_actions_resolved followed by five ordered layers, each reading
// a client_* table. Order matters: an override can move a row that a
// substitution already replaced, and a contraindication must drop a row
// before an override can edit it.
//
//   1. substitutions   client_action_substitutions + client_action_dismissals
//   2. progression     cosmetic notes once a cycle is complete — not ported
//   3. contraindications  drops rows whose tags hit the user's injury set
//   4. overrides       client_action_overrides — move, edit or skip
//   5. additions       client_added_actions — library-backed or custom
//
// day_of_week is MONDAY-FIRST: api.ts:4927 computes (getDay() + 6) % 7, so
// 0 is Monday and 6 is Sunday. Confirmed with Mads on 2026-10-09. A naive
// getDay() shifts every action by one day.

import { supabaseAdmin } from "@/lib/supabase-admin";

/** Monday-first day index for a date, matching the app's convention. */
export const dowOf = (d: Date = new Date()): number => (d.getDay() + 6) % 7;

export interface ResolvedAction {
  actionKey: string;
  label: string;
  pillar: string;
  details: string[];
  dayOfWeek: number;
  timeGroup: string | null;
  modality: string | null;
  durationMin: number | null;
  libKey: string | null;
  sortOrder: number;
  /** True when the row came from client_added_actions rather than a programme. */
  added: boolean;
  done: boolean;
}

interface Row {
  action_key: string; label: string; category: string | null; primary_pillar: string | null;
  details: unknown; day_of_week: number; time_group: string | null; sort_order: number | null;
  lib_key: string | null; modality?: string | null; duration_min?: number | null;
  contraindications?: string[] | null;
}

const asDetails = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Every action for the client's whole week, resolved. The caller filters to a
 * day — the app resolves the full week first because an override can move a
 * row between days, so a day-filtered base set would lose candidates
 * (api.ts:1705-1707 makes the same point).
 */
export async function resolveWeek(clientId: string, today: string): Promise<ResolvedAction[]> {
  // The client's programmes, and the week they are on.
  const { data: cps } = await supabaseAdmin
    .from("client_programs")
    .select("program_key, week_number")
    .eq("client_id", clientId);
  if (!cps?.length) return [];

  const { data: progs } = await supabaseAdmin
    .from("programs")
    .select("id, key")
    .in("key", cps.map((c) => c.program_key));
  const idByKey = new Map((progs ?? []).map((p) => [p.key as string, p.id as string]));

  // Base rows: each programme at its own week.
  let rows: Row[] = [];
  for (const cp of cps) {
    const pid = idByKey.get(cp.program_key);
    if (!pid) continue;
    const { data } = await supabaseAdmin
      .from("program_actions_resolved")
      .select("action_key, label, category, primary_pillar, details, day_of_week, time_group, sort_order, lib_key, intensity")
      .eq("program_id", pid)
      .eq("week_range", cp.week_number ?? 1)
      .order("sort_order", { ascending: true });
    rows = rows.concat((data ?? []) as Row[]);
  }

  const [{ data: subs }, { data: dismissals }, { data: overrides }, { data: additions }] = await Promise.all([
    supabaseAdmin.from("client_action_substitutions").select("lib_key, replacement_lib_key").eq("client_id", clientId),
    supabaseAdmin.from("client_action_dismissals").select("lib_key").eq("client_id", clientId),
    supabaseAdmin
      .from("client_action_overrides")
      .select("lib_key, original_dow, new_dow, custom_title, custom_details, custom_pillar, custom_duration_min, is_skipped, effective_from, effective_to")
      .eq("client_id", clientId)
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`),
    supabaseAdmin
      .from("client_added_actions")
      .select("id, target_dow, time_group, lib_key, custom_title, custom_details, custom_pillar, custom_modality, custom_duration_min, effective_from, effective_to")
      .eq("client_id", clientId)
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`),
  ]);

  // ── 1. Substitutions and dismissals ──────────────────────────────────
  const dismissed = new Set((dismissals ?? []).map((d) => d.lib_key as string));
  const subByKey = new Map((subs ?? []).map((s) => [s.lib_key as string, s.replacement_lib_key as string]));
  rows = rows.filter((r) => !r.lib_key || !dismissed.has(r.lib_key));

  // A substituted row is replaced by its library entry.
  const subTargets = rows.map((r) => (r.lib_key ? subByKey.get(r.lib_key) : null)).filter((k): k is string => !!k);

  // ── Library lookups: substitutions and library-backed additions ──────
  const libKeys = Array.from(new Set([
    ...subTargets,
    ...(additions ?? []).map((a) => a.lib_key).filter((k): k is string => !!k),
  ]));
  const libByKey = new Map<string, Record<string, unknown>>();
  if (libKeys.length) {
    const { data: lib } = await supabaseAdmin
      .from("action_library")
      .select("lib_key, label, primary_pillar, details, modality, duration_min, contraindications")
      .in("lib_key", libKeys);
    for (const l of lib ?? []) libByKey.set(l.lib_key as string, l);
  }

  rows = rows.map((r) => {
    const rep = r.lib_key ? subByKey.get(r.lib_key) : null;
    const lib = rep ? libByKey.get(rep) : null;
    if (!lib) return r;
    return {
      ...r,
      lib_key: rep ?? null,
      label: (lib.label as string) ?? r.label,
      primary_pillar: (lib.primary_pillar as string) ?? r.primary_pillar,
      details: lib.details ?? r.details,
      modality: (lib.modality as string) ?? null,
      duration_min: (lib.duration_min as number) ?? null,
      contraindications: (lib.contraindications as string[]) ?? null,
    };
  });

  // ── 3. Contraindications ─────────────────────────────────────────────
  // Safety-relevant, so it runs even though the injury set is usually empty.
  const contra = await userContraindications(clientId);
  if (contra.size) {
    rows = rows.filter((r) => !(r.contraindications ?? []).some((t) => contra.has(t)));
  }

  // ── 4. Overrides ─────────────────────────────────────────────────────
  const ovByKey = new Map<string, Record<string, unknown>>();
  for (const o of overrides ?? []) ovByKey.set(`${o.lib_key}|${o.original_dow}`, o);

  const out: ResolvedAction[] = [];
  for (const r of rows) {
    const ov = r.lib_key ? ovByKey.get(`${r.lib_key}|${r.day_of_week}`) : undefined;
    if (ov?.is_skipped) continue;
    const custom = ov?.custom_title as string | undefined;
    out.push({
      // An edited row gets its own key so its completion is tracked
      // separately from the template row — api.ts:1556 does the same.
      actionKey: custom ? `custom:${r.lib_key}:${r.day_of_week}` : r.action_key,
      label: custom ?? r.label,
      pillar: (ov?.custom_pillar as string) ?? r.primary_pillar ?? r.category ?? "exercise",
      details: custom ? asDetails(ov?.custom_details) : asDetails(r.details),
      dayOfWeek: (ov?.new_dow as number | null) ?? r.day_of_week,
      timeGroup: r.time_group,
      modality: r.modality ?? null,
      durationMin: (ov?.custom_duration_min as number) ?? r.duration_min ?? null,
      libKey: r.lib_key,
      sortOrder: r.sort_order ?? 0,
      added: false,
      done: false,
    });
  }

  // ── 5. Additions ─────────────────────────────────────────────────────
  for (const a of additions ?? []) {
    const lib = a.lib_key ? libByKey.get(a.lib_key) : null;
    const pillar = (a.custom_pillar as string) ?? (lib?.primary_pillar as string) ?? "exercise";
    out.push({
      actionKey: `added:${a.id}`,
      label: (a.custom_title as string) ?? (lib?.label as string) ?? "Aukaverkefni",
      pillar,
      details: a.custom_title ? asDetails(a.custom_details) : asDetails(lib?.details),
      dayOfWeek: a.target_dow as number,
      timeGroup: (a.time_group as string) ?? null,
      modality: (a.custom_modality as string) ?? (lib?.modality as string) ?? null,
      durationMin: (a.custom_duration_min as number) ?? (lib?.duration_min as number) ?? null,
      libKey: (a.lib_key as string) ?? null,
      sortOrder: 999,
      added: true,
      done: false,
    });
  }

  return out;
}

/**
 * The user's contraindication tags.
 *
 * The app reads these from the client's injury/limitation profile. Until that
 * shape is confirmed in this repo it returns empty, which is the safe
 * direction for a *filter* — nothing is hidden that should be shown. It is
 * the unsafe direction for contraindications themselves, so this must be
 * wired before the surface is used by anyone with a recorded injury.
 */
async function userContraindications(clientId: string): Promise<Set<string>> {
  void clientId;
  return new Set<string>();
}

/** Mark which of the day's actions are already done. */
export async function withCompletions(
  clientId: string, date: string, actions: ResolvedAction[],
): Promise<ResolvedAction[]> {
  const { data } = await supabaseAdmin
    .from("action_completions")
    .select("action_key, status")
    .eq("client_id", clientId)
    .eq("date", date);
  const done = new Set((data ?? []).filter((r) => r.status === "done").map((r) => r.action_key as string));
  return actions.map((a) => ({ ...a, done: done.has(a.actionKey) }));
}
