import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

export const maxDuration = 30;

// A company proposes a doctor-interview day + mode (#17). Employees later
// self-book 30-min slots in the patient portal once staff approve and
// generate the slots. Starts as 'requested'.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { company_id, proposed_date, start_time, end_time, mode, room_notes } = body || {};
  if (!company_id || !proposed_date || !start_time || !end_time || !mode) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (mode !== "onsite" && mode !== "video") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const { data: company } = await supabaseAdmin
    .from("companies").select("id, name, contact_person_id").eq("id", company_id).maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isPrimary = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  let isCoAdmin = false;
  if (!isPrimary && !staff) {
    const { data: ca } = await supabaseAdmin
      .from("company_admins").select("user_id").eq("company_id", company_id).eq("user_id", user.id).maybeSingle();
    isCoAdmin = !!ca;
  }
  if (!isPrimary && !staff && !isCoAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("doctor_interview_proposals")
    .insert({
      company_id,
      proposed_date,
      start_time,
      end_time,
      mode,
      room_notes: (room_notes || "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("[doctor-interviews] insert", insErr);
    return NextResponse.json({ error: "proposal_create_failed" }, { status: 500 });
  }

  const dateLabel = new Date(proposed_date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  try {
    await sendEmail({
      to: "contact@lifelinehealth.is",
      subject: `Doctor-interview day needs approval — ${company.name}`,
      text: `${company.name} proposed a doctor-interview day on ${dateLabel}, ${String(start_time).slice(0,5)}–${String(end_time).slice(0,5)} (${mode === "onsite" ? "on-site" : "video/phone"}). Approve it in /admin/business → Approvals to generate the 30-min slots.`,
      html: `<p><strong>${company.name}</strong> proposed a doctor-interview day:</p><ul><li>${dateLabel}</li><li>${String(start_time).slice(0,5)}–${String(end_time).slice(0,5)}</li><li>${mode === "onsite" ? "On-site" : "Video/phone"}</li></ul><p>Approve it in <a href="https://www.lifelinehealth.is/admin/business">/admin/business → Approvals</a> to generate the 30-min slots.</p>`,
    });
  } catch (e) {
    console.error("[doctor-interviews] ops notify failed", (e as Error).message);
  }

  return NextResponse.json({ ok: true, proposal_id: inserted.id });
}
