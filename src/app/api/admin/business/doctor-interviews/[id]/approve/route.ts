import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export const maxDuration = 30;

// Staff approve/reject a company's doctor-interview proposal (#17). On
// approval, generate 30-min doctor_slots across the proposed window,
// reserved for the company, in the chosen mode. Employees then self-book
// via the existing book_doctor_slot RPC in the patient portal.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const user = auth;

  const body = await req.json().catch(() => ({}));
  const action = body?.action === "reject" ? "reject" : "approve";
  const note = (body?.note || "").trim() || null;

  const { data: proposal } = await supabaseAdmin
    .from("doctor_interview_proposals")
    .select("id, company_id, proposed_date, start_time, end_time, mode, room_notes, approval_status")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabaseAdmin
    .from("doctor_interview_proposals")
    .update({
      approval_status: action === "approve" ? "approved" : "rejected",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      admin_note: note,
    })
    .eq("id", id);

  if (action !== "approve") {
    return NextResponse.json({ ok: true, approval_status: "rejected" });
  }

  // ─── Generate 30-min slots across [start_time, end_time) ────
  const SLOT_MIN = 30;
  const startMs = new Date(`${proposal.proposed_date}T${proposal.start_time}`).getTime();
  const endMs = new Date(`${proposal.proposed_date}T${proposal.end_time}`).getTime();
  if (!(endMs > startMs)) {
    return NextResponse.json({ error: "invalid_window" }, { status: 400 });
  }
  // doctor_slots.mode is video|phone|in_person; proposal mode is onsite|video.
  const slotMode = proposal.mode === "onsite" ? "in_person" : "video";
  const inserts: Array<Record<string, unknown>> = [];
  for (let t = startMs; t + SLOT_MIN * 60_000 <= endMs; t += SLOT_MIN * 60_000) {
    inserts.push({
      slot_at: new Date(t).toISOString(),
      duration_minutes: SLOT_MIN,
      mode: slotMode,
      location: slotMode === "in_person" ? (proposal.room_notes || null) : null,
      company_id: proposal.company_id, // reserved for this company only
    });
  }
  if (inserts.length === 0) {
    return NextResponse.json({ error: "no_slots_in_window" }, { status: 400 });
  }
  const { error: slotErr } = await supabaseAdmin.from("doctor_slots").insert(inserts);
  if (slotErr) {
    console.error("[doctor-interviews] slot gen failed", slotErr);
    return NextResponse.json({ error: "slot_generation_failed", detail: slotErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, approval_status: "approved", slots_created: inserts.length });
}
