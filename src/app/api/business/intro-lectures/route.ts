import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

export const maxDuration = 30;

const LECTURE_MIN = 30;

// "HH:MM" + minutes → "HH:MM" (clamped to 23:59).
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// A company proposes a 30-min introduction lecture (on-site or video) before
// the measurement day. Starts as 'requested'; Lifeline staff approve it in
// /admin/business → Approvals. Mirrors the doctor-interview proposal flow.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { company_id, lecture_date, start_time, mode, location, room_notes } = body || {};
  if (!company_id || !lecture_date || !start_time || !mode) {
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

  const end_time = addMinutes(String(start_time).slice(0, 5), LECTURE_MIN);

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("intro_lectures")
    .insert({
      company_id,
      lecture_date,
      start_time,
      end_time,
      mode,
      location: mode === "onsite" ? ((location || "").trim() || null) : null,
      room_notes: mode === "onsite" ? ((room_notes || "").trim() || null) : null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("[intro-lectures] insert", insErr);
    return NextResponse.json({ error: "lecture_create_failed" }, { status: 500 });
  }

  const dateLabel = new Date(lecture_date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  try {
    await sendEmail({
      to: "contact@lifelinehealth.is",
      subject: `Introduction lecture needs approval — ${company.name}`,
      text: `${company.name} proposed a 30-min introduction lecture on ${dateLabel}, ${String(start_time).slice(0, 5)}–${end_time} (${mode === "onsite" ? "on-site" : "video/phone"}). Approve it in /admin/business → Approvals.`,
      html: `<p><strong>${company.name}</strong> proposed a 30-min introduction lecture:</p><ul><li>${dateLabel}</li><li>${String(start_time).slice(0, 5)}–${end_time}</li><li>${mode === "onsite" ? "On-site" : "Video/phone"}</li></ul><p>Approve it in <a href="https://www.lifelinehealth.is/admin/business">/admin/business → Approvals</a>.</p>`,
    });
  } catch (e) {
    console.error("[intro-lectures] ops notify failed", (e as Error).message);
  }

  return NextResponse.json({ ok: true, lecture_id: inserted.id });
}
