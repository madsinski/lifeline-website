// Fetching a stored Grunnheilsa report and lighting it with our own ranges.
// Server-only (reads hc_knowledge and hc_reports).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { bandForValue, type KnowledgeEntry } from "./knowledge";
import { signalsForReport, type Grunnheilsa, type Signal } from "./grunnheilsa";
import { sexOf } from "./sex";

export interface StoredReport {
  report: Grunnheilsa;
  signals: Record<string, Signal | null>;
  method: "local" | "ai";
  created_at: string;
}

/** The newest report for a journey, with Lifeline's traffic lights applied. */
export async function loadReport(journeyId: string, clientId: string): Promise<StoredReport | null> {
  const [{ data: row }, { data: entries }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from("hc_reports")
      .select("payload, method, created_at")
      .eq("journey_id", journeyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from("hc_knowledge").select("slug, bands, unit, title").eq("active", true),
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

  return {
    report,
    signals: signalsForReport(report, band),
    method: row.method === "ai" ? "ai" : "local",
    created_at: row.created_at,
  };
}
