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
// Actor: workstation session or Lifeline staff, limited to their locations.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { hcAudit } from "@/lib/hc/server";
import { type ReportFile } from "@/lib/hc/report-import";
import { readReport } from "@/lib/hc/report-local";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILES = 8;
const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const { data: journey } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, location_id")
    .eq("id", id)
    .maybeSingle();
  const locs = actorLocationFilter(actor);
  if (!journey || (locs && (!journey.location_id || !locs.includes(journey.location_id)))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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
      });
      await supabaseAdmin
        .from("hc_journeys")
        .update({ report_generated_at: new Date().toISOString() })
        .eq("id", journey.id)
        .is("report_generated_at", null);
    }

    // The audit trail records that a report was read, never its contents.
    await hcAudit(actor.label, "report_imported", id, {
      files: files.length,
      found: read.values.length,
      method: read.method,
      report: !!read.report,
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
