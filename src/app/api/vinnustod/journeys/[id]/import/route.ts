// Read a health report into the workstation.
//
// POST multipart/form-data: files[] = the Medalia PDF, a lab printout or
// photos of either (max 8, 12 MB each). The files are parsed in memory and
// never stored — only the extracted values come back for the nurse to review.
// Nothing is written until the nurse confirms (POST /api/vinnustod/results).
//
// Actor: workstation session or Lifeline staff, limited to their locations.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { hcAudit } from "@/lib/hc/server";
import { mapValues, parseReport, type ReportFile } from "@/lib/hc/report-import";

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
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI-lestur er ekki uppsettur." }, { status: 503 });

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

  try {
    const parsed = await parseReport(files);
    const values = mapValues(parsed);
    // The audit trail records that a report was read, never its contents.
    await hcAudit(actor.label, "report_imported", id, {
      files: files.length,
      found: values.length,
      source: parsed.report.source,
    });
    return NextResponse.json({
      report: parsed.report,
      values,
      warnings: parsed.warnings ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `Lesturinn mistókst: ${message}` }, { status: 502 });
  }
}
