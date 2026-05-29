import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    company_id,
    event_date,
    start_time,
    end_time,
    location,
    room_notes,
  } = body || {};

  if (!company_id || !event_date || !start_time || !end_time) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
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
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("body_comp_events")
    .insert({
      company_id,
      event_date,
      start_time,
      end_time,
      location: (location || "").trim() || null,
      room_notes: (room_notes || "").trim() || null,
      created_by: user.id,
      approval_status: approvalStatus,
      approved_at: staff ? new Date().toISOString() : null,
      approved_by: staff ? user.id : null,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("[events] insert", insErr);
    return NextResponse.json({ error: "event_create_failed" }, { status: 500 });
  }

  const dateLabel = new Date(event_date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Employees are NOT emailed here — that happens once a staff member
  // approves the day (see /api/admin/business/events/[eventId]/approve).
  // Notify ops that a day needs approval.
  if (approvalStatus === "requested") {
    try {
      await sendEmail({
        to: "contact@lifelinehealth.is",
        subject: `Measurement day needs approval — ${company.name}`,
        text: `${company.name} requested a measurement day on ${dateLabel}, ${String(start_time).slice(0,5)}–${String(end_time).slice(0,5)}${location ? ` at ${location}` : ""}. Approve it in /admin/business → Approvals.`,
        html: `<p><strong>${company.name}</strong> requested a measurement day:</p><ul><li>${dateLabel}</li><li>${String(start_time).slice(0,5)}–${String(end_time).slice(0,5)}</li>${location ? `<li>${location}</li>` : ""}</ul><p>Approve it in <a href="https://www.lifelinehealth.is/admin/business">/admin/business → Approvals</a>.</p>`,
      });
    } catch (e) {
      console.error("[events] ops notify failed", (e as Error).message);
    }
  }

  return NextResponse.json({ ok: true, event_id: inserted.id, approval_status: approvalStatus });
}
