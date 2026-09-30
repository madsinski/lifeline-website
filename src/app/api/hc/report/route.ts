// The participant puts their own health report into their heilsuferð.
//
// POST multipart/form-data: files[] = the Lifeline Grunnheilsa PDF from
// Medalia (max 3, 12 MB each).
//
// Read here on our own server only: nothing is sent to a model, and a file we
// cannot read is refused (the nurse can read it with them in the interview).
// The file itself is never stored; the parsed report is, encrypted at column
// level (migration-hc-reports-encrypt.sql), with source 'self'.
//
// The kennitala printed on the report must match the account's, so nobody can
// put someone else's results into their account.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, decryptKennitala, getClientProfile, hcAudit, requireUser } from "@/lib/hc/server";
import { readReport } from "@/lib/hc/report-local";
import type { ReportFile } from "@/lib/hc/report-import";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 3;
const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "Engin heilsuferð fannst." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const uploaded = form?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
  if (!uploaded.length) return NextResponse.json({ error: "Engin skrá fylgdi." }, { status: 400 });
  if (uploaded.length > MAX_FILES) return NextResponse.json({ error: `Mest ${MAX_FILES} skrár í einu.` }, { status: 400 });

  const files: ReportFile[] = [];
  for (const f of uploaded) {
    if ((f.type || "").toLowerCase() !== "application/pdf") return NextResponse.json({ error: "Skýrslan þarf að vera PDF-skjal úr sjúklingagáttinni." }, { status: 400 });
    if (f.size > MAX_BYTES) return NextResponse.json({ error: "Skráin er of stór (hámark 12 MB)." }, { status: 400 });
    files.push({ data: new Uint8Array(await f.arrayBuffer()), mediaType: "application/pdf", filename: f.name });
  }

  const read = await readReport(files, { allowAi: false }).catch(() => null);
  if (!read?.report) {
    await hcAudit(`self:${user.id}`, "report_self_upload_unreadable", journey.id, { files: files.length });
    return NextResponse.json({
      error: "Við gátum ekki lesið þetta skjal. Notaðu PDF-skýrsluna „Grunnheilsa“ úr sjúklingagáttinni, eða taktu hana með í viðtalið.",
    }, { status: 422 });
  }

  // Their own report only.
  const onReport = (read.report.patient?.kennitala ?? "").replace(/\D/g, "");
  const profile = await getClientProfile(user.id);
  const mine = (await decryptKennitala(profile?.kennitala_encrypted ?? null, {
    actorRole: "client", purpose: "self_report_match", subjectId: user.id, req,
  }))?.replace(/\D/g, "") ?? "";
  if (!onReport || !mine || onReport !== mine) {
    await hcAudit(`self:${user.id}`, "report_self_upload_mismatch", journey.id, { has_kt_on_report: !!onReport, has_kt_on_file: !!mine });
    return NextResponse.json({
      error: !mine
        ? "Skráðu kennitöluna þína fyrst (Upplýsingar um þig) svo við getum staðfest að skýrslan sé þín."
        : "Kennitalan á skýrslunni passar ekki við aðganginn þinn.",
    }, { status: 422 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("hc_reports").insert({
    journey_id: journey.id,
    client_id: user.id,
    report_date: read.reportDate,
    method: "local",
    payload: read.report,
    imported_by: `self:${user.id}`,
    source: "self",
  });
  if (error) return NextResponse.json({ error: "Tókst ekki að vista skýrsluna." }, { status: 500 });
  await supabaseAdmin.from("hc_journeys").update({ own_report_at: now }).eq("id", journey.id);
  await hcAudit(`self:${user.id}`, "report_self_upload", journey.id, { items: read.report.items.length, date: read.reportDate });
  return NextResponse.json({ ok: true, report_date: read.reportDate, items: read.report.items.length });
}
