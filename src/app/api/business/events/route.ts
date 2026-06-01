import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

interface DayInput {
  event_date: string;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { company_id, location, room_notes } = body || {};

  // Back-compat: accept either a `days` array (multi-day) or a single
  // event_date/start_time/end_time at the top level (the old shape).
  const rawDays: DayInput[] = Array.isArray(body?.days) && body.days.length
    ? body.days
    : (body?.event_date
        ? [{ event_date: body.event_date, start_time: body.start_time, end_time: body.end_time, break_start: body.break_start, break_end: body.break_end }]
        : []);

  if (!company_id || rawDays.length === 0) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  for (const d of rawDays) {
    if (!d.event_date || !d.start_time || !d.end_time) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (String(d.start_time) >= String(d.end_time)) {
      return NextResponse.json({ error: "bad_window" }, { status: 400 });
    }
    if (d.break_start && d.break_end) {
      if (String(d.break_start) >= String(d.break_end)) {
        return NextResponse.json({ error: "bad_break" }, { status: 400 });
      }
      if (String(d.break_start) < String(d.start_time) || String(d.break_end) > String(d.end_time)) {
        return NextResponse.json({ error: "break_outside" }, { status: 400 });
      }
    }
  }

  // Authz: primary / co-admin / staff
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, contact_person_id")
    .eq("id", company_id)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const isPrimary = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  let isCoAdmin = false;
  if (!isPrimary && !staff) {
    const { data: ca } = await supabaseAdmin
      .from("company_admins")
      .select("user_id")
      .eq("company_id", company_id)
      .eq("user_id", user.id)
      .maybeSingle();
    isCoAdmin = !!ca;
  }
  if (!isPrimary && !staff && !isCoAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Staff-created days are auto-approved; company-proposed days start as
  // 'requested' and wait for Lifeline approval before employees are
  // invited (#16).
  const approvalStatus = staff ? "approved" : "requested";
  const nowIso = new Date().toISOString();
  const rows = rawDays.map((d) => ({
    company_id,
    event_date: d.event_date,
    start_time: d.start_time,
    end_time: d.end_time,
    break_start: d.break_start || null,
    break_end: d.break_end || null,
    location: (location || "").trim() || null,
    room_notes: (room_notes || "").trim() || null,
    created_by: user.id,
    approval_status: approvalStatus,
    approved_at: staff ? nowIso : null,
    approved_by: staff ? user.id : null,
  }));

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("body_comp_events")
    .insert(rows)
    .select("id");
  if (insErr || !inserted) {
    console.error("[events] insert", insErr);
    return NextResponse.json({ error: "event_create_failed" }, { status: 500 });
  }

  const fmtDay = (d: DayInput) => {
    const label = new Date(d.event_date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const breakTxt = d.break_start && d.break_end
      ? ` (lunch ${String(d.break_start).slice(0, 5)}–${String(d.break_end).slice(0, 5)})`
      : "";
    return `${label}, ${String(d.start_time).slice(0, 5)}–${String(d.end_time).slice(0, 5)}${breakTxt}`;
  };

  // Employees are NOT emailed here — that happens once a staff member
  // approves the day (see /api/admin/business/events/[eventId]/approve).
  // Notify ops that day(s) need approval.
  if (approvalStatus === "requested") {
    try {
      const lines = rawDays.map(fmtDay);
      await sendEmail({
        to: "contact@lifelinehealth.is",
        subject: `Measurement day${rawDays.length > 1 ? "s" : ""} need approval — ${company.name}`,
        text: `${company.name} requested ${rawDays.length} measurement day(s):\n${lines.map((l) => `• ${l}`).join("\n")}${location ? `\nAt ${location}` : ""}\nApprove in /admin/business → Approvals.`,
        html: `<p><strong>${company.name}</strong> requested ${rawDays.length} measurement day(s):</p><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>${location ? `<p>${location}</p>` : ""}<p>Approve in <a href="https://www.lifelinehealth.is/admin/business">/admin/business → Approvals</a>.</p>`,
      });
    } catch (e) {
      console.error("[events] ops notify failed", (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    event_ids: inserted.map((r) => r.id),
    count: inserted.length,
    approval_status: approvalStatus,
  });
}
