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
import { classifyRecommendation } from "@/lib/hc/recommendation-map";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  // No journey yet simply means nothing uploaded yet: POST /api/hc/report
  // creates one, and a self-upload no longer puts anybody in a clinical
  // queue (stages.ts). So uploading is always offered.
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ canUpload: true, report: null });

  const stored = await loadReport(journey.id, user.id, true);
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
    trend: (it.trend ?? []).map((pt) => ({ date: pt.date, value: pt.value })),
    /**
     * What the row opens into. hc_knowledge already carries all of it and
     * loadReport already returns it keyed by item — the rows simply had no
     * way to open. summary says what the value measures, bands are the
     * reference ranges with their Icelandic labels, improves/worsens are
     * what moves it, components is what a composite score is made of.
     */
    reference: (() => {
      const ref = stored.reference[it.key];
      if (!ref) return null;
      return {
        title: ref.title,
        summary: ref.summary,
        unit: ref.unit,
        higherBetter: ref.higher_better,
        bands: (ref.bands ?? []).map((b) => ({
          label: b.label, tone: b.tone, min: b.min ?? null, max: b.max ?? null,
          sex: b.sex ?? null, note: b.note ?? null,
        })),
        improves: ref.improves ?? [],
        worsens: ref.worsens ?? [],
        components: ref.components ?? [],
      };
    })(),
    recommendations: (it.recommendations ?? []).map((r) => {
      /**
       * Which recommendations are already actionable.
       *
       * classifyRecommendation turns the report's own Ráðleggingar column
       * into a plan module, and separates the lines that must NOT become
       * habits: a "talk to your doctor" line is a referral, not a routine.
       * This is what nobody else in the market has — the clinician's
       * prioritisation arrives with the data — so the surface says which
       * lines it can act on rather than printing all of them alike.
       *
       * The module keys are hc_plan_modules (58 rows, heilsuferð). They do
       * NOT overlap the app's action_library (802 rows, 0 keys in common),
       * so this marks a line as actionable without yet being able to put it
       * on a programme day. Bridging those two vocabularies is the real work
       * behind merging the surfaces.
       */
      const kind = classifyRecommendation({ component: r.component, text: r.text, priority: r.priority });
      return {
        component: r.component, text: r.text, priority: r.priority,
        kind: kind.kind,
        moduleKey: kind.kind === "action" ? kind.moduleKey : null,
      };
    }),
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
