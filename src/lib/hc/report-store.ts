// Fetching a stored Grunnheilsa report and lighting it with our own ranges.
// Server-only (reads hc_knowledge and hc_reports).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { bandForValue, type KnowledgeEntry, type ReportReference } from "./knowledge";
import { actionSignalsForReport, signalsForReport, type Grunnheilsa, type Signal } from "./grunnheilsa";
import { sexOf } from "./sex";

export type { ReportReference };

export interface StoredReport {
  report: Grunnheilsa;
  /** Medalia's verdict per row — what the report view prints. */
  signals: Record<string, Signal | null>;
  /**
   * The same rows, but a row is only as green as its worst flagged component.
   * This is what the plan is built from; see actionSignalForItem.
   */
  actionSignals: Record<string, Signal | null>;
  /** Keyed by report item key, so the view needs no slug logic of its own. */
  reference: Record<string, ReportReference>;
  /** Which sex the bands were read for — a row can say so when it matters. */
  sex: "m" | "f" | null;
  method: "local" | "ai";
  created_at: string;
}

/** The newest report for a journey, with Lifeline's traffic lights applied. */
export async function loadReport(journeyId: string, clientId: string): Promise<StoredReport | null> {
  const [{ data: row }, { data: entries }, { data: profile }] = await Promise.all([
    // Stored encrypted (migration-hc-reports-encrypt.sql); this RPC decrypts.
    supabaseAdmin.rpc("hc_report_latest", { p_journey: journeyId }).maybeSingle<{ payload: unknown; method: string; source: string; created_at: string }>(),
    supabaseAdmin
      .from("hc_knowledge")
      .select("slug, bands, unit, title, summary, higher_better, improves, worsens, components")
      .eq("active", true),
    supabaseAdmin.from("clients_decrypted").select("sex").eq("id", clientId).maybeSingle(),
  ]);
  if (!row?.payload) return null;

  const report = row.payload as Grunnheilsa;
  const sex = sexOf(profile?.sex);
  const bySlug = new Map((entries ?? []).map((e) => [e.slug, e as unknown as KnowledgeEntry]));
  const band = (slug: string, value: number): Signal | null => {
    const entry = bySlug.get(slug);
    if (!entry?.bands?.length) return null;
    // Sex-specific ranges with no sex on file: we do not guess.
    if (!sex && entry.bands.some((b) => b.sex)) return null;
    const b = bandForValue(entry, value, sex);
    if (!b) return null;
    return b.tone === "good" ? "green" : b.tone === "watch" ? "yellow" : "red";
  };

  // The reference entry for every row that has one, keyed by the row so the
  // view does not have to know about slugs at all.
  const reference: Record<string, ReportReference> = {};
  for (const item of report.items) {
    const e = item.slug ? bySlug.get(item.slug) : undefined;
    if (!e) continue;
    reference[item.key] = {
      title: e.title,
      unit: e.unit,
      summary: e.summary,
      bands: e.bands ?? [],
      higher_better: e.higher_better,
      improves: (e as unknown as { improves?: string[] }).improves ?? [],
      worsens: (e as unknown as { worsens?: string[] }).worsens ?? [],
      components: (e as unknown as { components?: string[] }).components ?? [],
    };
  }

  return {
    report,
    signals: signalsForReport(report, band),
    actionSignals: actionSignalsForReport(report, band),
    reference,
    sex,
    method: row.method === "ai" ? "ai" : "local",
    created_at: row.created_at,
  };
}
