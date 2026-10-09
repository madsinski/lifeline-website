// The client confirms a report a member of staff entered for them.
//
// GET  → the pending report, if there is one, described plainly enough that
//        somebody can tell what they are agreeing to.
// POST → confirm it, or decline it.
//
// This is confirmation of PROVENANCE, not Art. 9(2)(a) consent. The lawful
// basis for processing is 9(2)(h) — care by a health professional — and by
// the time a nurse is uploading a report in a coaching session that
// relationship exists. Labelling this consent would import a withdrawal
// right that cannot honestly be honoured for a report the plan rests on.
// What it records is that the person was there and asked for it.
//
// It carries weight because it happens in the client's OWN authenticated
// session. The same tap on the nurse's screen would be the nurse clicking
// twice.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ pending: null });

  const { data } = await supabaseAdmin
    .from("hc_reports")
    .select("id, report_date, imported_by, approval_requested_at, approval_requested_by, created_at")
    .eq("journey_id", journey.id)
    .is("client_approved_at", null)
    .not("approval_requested_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    pending: data
      ? {
          id: data.id as string,
          reportDate: (data.report_date as string) ?? null,
          requestedBy: (data.approval_requested_by as string) ?? (data.imported_by as string) ?? null,
          requestedAt: data.approval_requested_at as string,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const decision = body?.decision === "decline" ? "decline" : "approve";
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "no journey" }, { status: 404 });

  // Scoped to this person's own journey: an id alone must never be enough to
  // approve somebody else's report.
  const { data: row } = await supabaseAdmin
    .from("hc_reports")
    .select("id, report_date, approval_requested_by")
    .eq("id", id)
    .eq("journey_id", journey.id)
    .eq("client_id", user.id)
    .is("client_approved_at", null)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not-pending" }, { status: 404 });

  if (decision === "decline") {
    // Declining removes the client's copy. The clinical record of the
    // consultation is not this row, and staff keep their own access; what
    // the person is declining is having it rendered back to them here.
    await supabaseAdmin.from("hc_reports").delete().eq("id", row.id);
    await hcAudit(`self:${user.id}`, "report_provenance_declined", journey.id, {
      report_date: row.report_date, requested_by: row.approval_requested_by,
    });
    return NextResponse.json({ ok: true, decision: "decline" });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("hc_reports")
    .update({ client_approved_at: now, on_behalf_consent_at: now })
    .eq("id", row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The proof. Actor is the person's own user id, so the trail shows who
  // confirmed, when, and which report — not that somebody ticked a box.
  await hcAudit(`self:${user.id}`, "report_provenance_confirmed", journey.id, {
    report_id: row.id, report_date: row.report_date, requested_by: row.approval_requested_by, at: now,
  });

  return NextResponse.json({ ok: true, decision: "approve" });
}
