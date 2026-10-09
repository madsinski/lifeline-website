// Skýrslan — your own health report, in the app.
//
// The upload itself already exists and is good: POST /api/hc/report reads the
// Grunnheilsa PDF on our own server with allowAi:false, never stores the
// file, keeps only the parsed result encrypted at column level, and refuses
// a report whose kennitala is not the uploader's. This route does not
// duplicate any of that — it tells the surface whether uploading is possible
// and renders what was parsed.
//
// WHY IT CAN BE IMPOSSIBLE, AND WHY THAT IS NOT A BUG
//
// hc_reports.journey_id is NOT NULL, and a journey is the heilsuferð
// container: it carries paid_at and the clinical stages. Worse, stageFor
// (stages.ts:164) counts own_report_at as a report, so a self-upload
// advances the journey to "interview" — and "interview" is in the vinnustöð
// queue filter. Creating a journey on upload would therefore put somebody
// who only wanted to look at their own results into a clinician's worklist
// awaiting an appointment they never booked.
//
// That is the sjúkraskrá/viewer boundary, so this route will not cross it on
// its own. Where a journey already exists the designed flow runs untouched;
// where it does not, the surface says so and nobody is enrolled silently.
// Today that is 3 clients of 126.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, requireUser } from "@/lib/hc/server";
import { loadReport } from "@/lib/hc/report-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const journey = await currentJourney(user.id);
  if (!journey) {
    return NextResponse.json({ canUpload: false, reason: "no-journey", report: null });
  }

  const stored = await loadReport(journey.id, user.id);
  if (!stored) return NextResponse.json({ canUpload: true, report: null });

  // Flagged rows first — a report is read for what is off, not for the
  // forty values that are fine.
  const rank: Record<string, number> = { red: 0, yellow: 1, green: 2 };
  const items = (stored.report.items ?? []).map((it) => ({
    key: it.key,
    title: it.title,
    value: it.value,
    unit: it.unit,
    /**
     * Lifeline's own traffic light, not the report's word. grunnheilsa.ts
     * says why: Medalia's wording and cut-offs vary, so the colour comes
     * from hc_knowledge. `label` is kept beside it as the report's phrasing.
     */
    level: stored.signals[it.key] ?? null,
    reportWord: it.label,
    advice: it.advice ?? [],
    recommendations: (it.recommendations ?? []).map((r) => ({
      component: r.component, text: r.text, priority: r.priority,
    })),
  })).sort((a, b) => (rank[a.level ?? "green"] ?? 3) - (rank[b.level ?? "green"] ?? 3));

  const { data: row } = await supabaseAdmin
    .from("hc_reports")
    .select("report_date, source, created_at")
    .eq("journey_id", journey.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    canUpload: true,
    report: {
      date: (row?.report_date as string) ?? null,
      source: (row?.source as string) ?? null,
      uploadedAt: (row?.created_at as string) ?? null,
      method: stored.method,
      flagged: items.filter((i) => i.level === "red" || i.level === "yellow").length,
      items,
    },
  });
}
