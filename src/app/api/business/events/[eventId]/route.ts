import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

export const maxDuration = 60;

// Edit / delete a company-proposed measurement day.
//
// Edit policy (chosen 2026-06-01): the company contact / co-admins may
// change a day's date, time and lunch break ONLY while it is still
// 'requested'. Once Lifeline approves it, employees are invited and start
// booking 5-minute slots, so company-side edits lock — rescheduling an
// approved day is a staff action (staff are allowed here at any status,
// and own any booking cleanup via the admin tools). Because employees are
// invited only on approval, a 'requested' day provably has no bookings,
// so editing it is always safe with no slot migration.

async function authorize(eventId: string, userId: string) {
  const { data: event } = await supabaseAdmin
    .from("body_comp_events")
    .select("id, company_id, start_time, end_time, approval_status")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { error: "not_found" as const, status: 404 };

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, contact_person_id")
    .eq("id", event.company_id)
    .maybeSingle();
  if (!company) return { error: "not_found" as const, status: 404 };

  const staff = await isStaff(userId);
  let allowed = staff || company.contact_person_id === userId;
  if (!allowed) {
    const { data: ca } = await supabaseAdmin
      .from("company_admins")
      .select("user_id")
      .eq("company_id", event.company_id)
      .eq("user_id", userId)
      .maybeSingle();
    allowed = !!ca;
  }
  if (!allowed) return { error: "forbidden" as const, status: 403 };

  // Non-staff can only touch a day that hasn't been approved yet.
  if (!staff && event.approval_status !== "requested") {
    return { error: "locked" as const, status: 409 };
  }
  return { event };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const az = await authorize(eventId, user.id);
  if ("error" in az) return NextResponse.json({ error: az.error }, { status: az.status });

  const body = await req.json().catch(() => ({}));
  const { event_date, start_time, end_time, break_start, break_end, location, room_notes } = body || {};

  if (!event_date || !start_time || !end_time) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (String(start_time) >= String(end_time)) {
    return NextResponse.json({ error: "bad_window" }, { status: 400 });
  }
  const hasBreak = !!(break_start && break_end);
  if (hasBreak) {
    if (String(break_start) >= String(break_end)) {
      return NextResponse.json({ error: "bad_break" }, { status: 400 });
    }
    if (String(break_start) < String(start_time) || String(break_end) > String(end_time)) {
      return NextResponse.json({ error: "break_outside" }, { status: 400 });
    }
  }

  const { error: updErr } = await supabaseAdmin
    .from("body_comp_events")
    .update({
      event_date,
      start_time,
      end_time,
      break_start: hasBreak ? break_start : null,
      break_end: hasBreak ? break_end : null,
      location: (location || "").trim() || null,
      room_notes: (room_notes || "").trim() || null,
    })
    .eq("id", eventId);
  if (updErr) {
    console.error("[events] update", updErr);
    return NextResponse.json({ error: "event_update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const az = await authorize(eventId, user.id);
  if ("error" in az) return NextResponse.json({ error: az.error }, { status: az.status });

  const { error: delErr } = await supabaseAdmin
    .from("body_comp_events")
    .delete()
    .eq("id", eventId);
  if (delErr) {
    console.error("[events] delete", delErr);
    return NextResponse.json({ error: "event_delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
