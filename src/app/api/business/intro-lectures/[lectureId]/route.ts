import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

export const maxDuration = 30;

const LECTURE_MIN = 30;

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Edit / delete a proposed introduction lecture.
//
// Edit policy (mirrors the measurement day): the company contact / co-admins
// may change a lecture's date / time / mode ONLY while it is still 'requested'.
// Once Lifeline approves a time, company-side edits lock and rescheduling is a
// staff action (staff are allowed here at any status).
async function authorize(lectureId: string, userId: string) {
  const { data: lecture } = await supabaseAdmin
    .from("intro_lectures")
    .select("id, company_id, approval_status")
    .eq("id", lectureId)
    .maybeSingle();
  if (!lecture) return { error: "not_found" as const, status: 404 };

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, contact_person_id")
    .eq("id", lecture.company_id)
    .maybeSingle();
  if (!company) return { error: "not_found" as const, status: 404 };

  const staff = await isStaff(userId);
  let allowed = staff || company.contact_person_id === userId;
  if (!allowed) {
    const { data: ca } = await supabaseAdmin
      .from("company_admins")
      .select("user_id")
      .eq("company_id", lecture.company_id)
      .eq("user_id", userId)
      .maybeSingle();
    allowed = !!ca;
  }
  if (!allowed) return { error: "forbidden" as const, status: 403 };

  if (!staff && lecture.approval_status !== "requested") {
    return { error: "locked" as const, status: 409 };
  }
  return { lecture };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> },
) {
  const { lectureId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const az = await authorize(lectureId, user.id);
  if ("error" in az) return NextResponse.json({ error: az.error }, { status: az.status });

  const body = await req.json().catch(() => ({}));
  const { lecture_date, start_time, mode, location, room_notes } = body || {};
  if (!lecture_date || !start_time || !mode) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (mode !== "onsite" && mode !== "video") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const { error: updErr } = await supabaseAdmin
    .from("intro_lectures")
    .update({
      lecture_date,
      start_time,
      end_time: addMinutes(String(start_time).slice(0, 5), LECTURE_MIN),
      mode,
      location: mode === "onsite" ? ((location || "").trim() || null) : null,
      room_notes: mode === "onsite" ? ((room_notes || "").trim() || null) : null,
    })
    .eq("id", lectureId);
  if (updErr) {
    console.error("[intro-lectures] update", updErr);
    return NextResponse.json({ error: "lecture_update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> },
) {
  const { lectureId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const az = await authorize(lectureId, user.id);
  if ("error" in az) return NextResponse.json({ error: az.error }, { status: az.status });

  const { error: delErr } = await supabaseAdmin
    .from("intro_lectures")
    .delete()
    .eq("id", lectureId);
  if (delErr) {
    console.error("[intro-lectures] delete", delErr);
    return NextResponse.json({ error: "lecture_delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
