// Read a health report into an open client's workspace.
//
// POST multipart/form-data: files[] = the Medalia PDF, a lab printout or
// photos of either (max 8, 12 MB each). The files are parsed in memory and
// never stored.
//
// Same reader as the dropzone on the home screen (readReport): a Lifeline
// Grunnheilsa report is parsed here on our own server and nothing leaves the
// building, and anything else stops and asks the nurse before it is sent out.
// This route used to call the model directly, which meant a report we can
// read ourselves went to OpenAI anyway — and the model returns flat values
// only, so the lifestyle scores, the four pillars and the history were lost.
//
// A Grunnheilsa report is written to hc_reports here, because that is what
// the workstation and the client's account both render. The individual values
// still wait for the nurse to tick them (POST /api/vinnustod/results).
//
// Consent (Medalia split, 2026-10-16): the report is the participant's to
// bring. Staff may import it only as assistance, and only when the
// participant has allowed it in the app (hc_journeys.staff_import_consent_at,
// POST /api/hc/journey {action:"allow_staff_import"}). Without it: 403. Every
// staff import is recorded as on the participant's behalf (staff_on_behalf)
// and waits for them to confirm it is theirs before it shows in their app.
//
// Actor: workstation session or Lifeline staff, limited to their locations.

import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { hcAudit, refreshStage } from "@/lib/hc/server";
import type { HcJourney } from "@/lib/hc/types";
import { type ReportFile } from "@/lib/hc/report-import";
import { readReport } from "@/lib/hc/report-local";
import { buildProposal } from "@/lib/hc/propose";
import { STAFF_IMPORT_REFUSED } from "@/lib/hc/consent";

/**
 * Start the plan proposal without making anyone wait for it.
 *
 * The nurse's next few minutes go on reading the report, so the model can
 * think while she does and the proposal is waiting when she reaches the plan.
 * after() runs once the response has been sent but inside the same function
 * invocation, which is what keeps it alive on Vercel — a bare floating
 * promise gets killed when the response closes.
 *
 * Failure here is silent on purpose: the nurse can always press the button.
 */
function proposeInBackground(journeyId: string, actorLabel: string) {
  after(async () => {
    try {
      await buildProposal(journeyId, actorLabel);
    } catch {
      // Nothing to report to — the on-demand path will say what went wrong.
    }
  });
}

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILES = 8;
const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  // select("*") so a missing consent column reads as "no consent" rather
  // than failing the query.
  const { data: journey } = await supabaseAdmin
    .from("hc_journeys")
    .select("*")
    .eq("id", id)
    .maybeSingle<{ id: string; client_id: string; location_id: string | null; staff_import_consent_at?: string | null }>();
  const locs = actorLocationFilter(actor);
  if (!journey || (locs && (!journey.location_id || !locs.includes(journey.location_id)))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!journey.staff_import_consent_at) {
    await hcAudit(actor.label, "report_import_refused_no_consent", id, {});
    return NextResponse.json({ error: STAFF_IMPORT_REFUSED }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const uploaded = form?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
  if (!uploaded.length) return NextResponse.json({ error: "Engin skrá fylgdi." }, { status: 400 });
  if (uploaded.length > MAX_FILES) return NextResponse.json({ error: `Mest ${MAX_FILES} skrár í einu.` }, { status: 400 });

  const files: ReportFile[] = [];
  for (const f of uploaded) {
    const type = (f.type || "").toLowerCase();
    if (!ACCEPTED.includes(type)) return NextResponse.json({ error: `Skráargerð ekki studd: ${f.type || "óþekkt"}` }, { status: 400 });
    if (f.size > MAX_BYTES) return NextResponse.json({ error: `Skráin ${f.name} er of stór (hámark 12 MB).` }, { status: 400 });
    files.push({ data: new Uint8Array(await f.arrayBuffer()), mediaType: type, filename: f.name });
  }

  const allowAi = String(form?.get("allow_ai") ?? "") === "true";
  // Always on the participant's behalf now: they allowed it in the app.
  const onBehalf = true;

  try {
    const read = await readReport(files, { allowAi });

    // Nothing has been sent anywhere and nothing was read: the nurse decides.
    if (read.method === "needs-consent") {
      return NextResponse.json({
        method: read.method,
        report: { date_iso: null },
        values: [],
        warnings: read.warnings,
      });
    }

    // Keep the whole report when we parsed one, so the pillars, the lifestyle
    // scores and the history survive — not just the values with bands.
    if (read.report) {
      await supabaseAdmin.from("hc_reports").insert({
        journey_id: journey.id,
        client_id: journey.client_id,
        report_date: read.reportDate,
        method: read.method.startsWith("ai") ? "ai" : "local",
        payload: read.report,
        imported_by: actor.label,
        source: onBehalf ? "staff_on_behalf" : "staff",
        /**
         * The nurse ASKS; the client answers.
         *
         * on_behalf_consent_at used to be stamped here from the nurse's own
         * answer to "Hvernig kom skýrslan hingað?" — the interested party
         * vouching for their own conduct, under a name implying the client
         * had agreed. Now an on-behalf upload is only requested: the report
         * is held off the client's surfaces until they confirm it is theirs
         * from their own authenticated session, which writes
         * client_approved_at.
         *
         * The consultation does not wait for that. Staff read the report
         * through hc_report_latest regardless, because reading it to do the
         * care IS the care (Art. 9(2)(h)). What waits is the client's copy.
         */
        approval_requested_at: onBehalf ? new Date().toISOString() : null,
        approval_requested_by: onBehalf ? actor.label : null,
        // A report the person did not ask to be entered on their behalf is
        // ordinary clinical work and needs no provenance confirmation.
        client_approved_at: onBehalf ? null : new Date().toISOString(),
      });
      await supabaseAdmin
        .from("hc_journeys")
        .update({ report_imported_at: new Date().toISOString() })
        .eq("id", journey.id)
        .is("report_imported_at", null);
      await hcAudit(actor.label, "report_imported_with_consent", id, { consent_at: journey.staff_import_consent_at });
      // The report being in moves the stage (report → doctor).
      const { data: fresh } = await supabaseAdmin.from("hc_journeys").select("*").eq("id", journey.id).maybeSingle();
      if (fresh) await refreshStage(fresh as HcJourney).catch(() => null);
    
      // The report is in; start thinking about the plan now.
      proposeInBackground(journey.id, actor.label);
    }

    // The audit trail records that a report was read, never its contents.
    await hcAudit(actor.label, "report_imported", id, {
      files: files.length,
      found: read.values.length,
      method: read.method,
      report: !!read.report,
      on_behalf: onBehalf,
    });
    return NextResponse.json({
      method: read.method,
      report: { date_iso: read.reportDate },
      values: read.values,
      warnings: read.warnings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `Lesturinn mistókst: ${message}` }, { status: 502 });
  }
}
