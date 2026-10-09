// "Viltu halda skýrslunni þinni?"
//
// GET  → whether there is a review outstanding, and since when.
// POST → keep (resets the year) or remove (deletes Lifeline's copy).
//
// Removing is not losing: the original is in Medalia and can be imported
// again. The prompt says so, which is what keeps the answer honest.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";
import { retentionState } from "@/lib/hc/retention";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ review: null });

  const { data } = await supabaseAdmin
    .from("hc_reports")
    .select("id, report_date, created_at, retention_asked_at, retention_reminded_at, retention_confirmed_at")
    .eq("journey_id", journey.id)
    .not("client_approved_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return NextResponse.json({ review: null });

  const state = retentionState(data);
  // Only an outstanding ask is shown. "fresh" is the normal case.
  if (state === "fresh") return NextResponse.json({ review: null });

  return NextResponse.json({
    review: {
      id: data.id as string,
      reportDate: (data.report_date as string) ?? null,
      heldSince: (data.retention_confirmed_at as string) ?? (data.created_at as string),
      state,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const decision = body?.decision === "remove" ? "remove" : "keep";
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "no journey" }, { status: 404 });

  // Scoped to their own journey: an id alone must not reach anyone else's.
  const { data: row } = await supabaseAdmin
    .from("hc_reports")
    .select("id, report_date")
    .eq("id", id)
    .eq("journey_id", journey.id)
    .eq("client_id", user.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 });

  if (decision === "remove") {
    await supabaseAdmin.from("hc_reports").delete().eq("id", row.id);
    await hcAudit(`self:${user.id}`, "report_removed_by_client", journey.id, {
      report_date: row.report_date, reason: "retention_review",
    });
    return NextResponse.json({ ok: true, decision: "remove" });
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("hc_reports")
    .update({ retention_confirmed_at: now, retention_asked_at: null, retention_reminded_at: null })
    .eq("id", row.id);
  await hcAudit(`self:${user.id}`, "report_retention_confirmed", journey.id, {
    report_date: row.report_date, next_review_in_days: 365,
  });
  return NextResponse.json({ ok: true, decision: "keep" });
}
