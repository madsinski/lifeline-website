import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail, renderEventScheduledEmail } from "@/lib/email";

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
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("[events] insert", insErr);
    return NextResponse.json({ error: "event_create_failed" }, { status: 500 });
  }

  // Broadcast to every employee of the company who has completed onboarding
  const { data: members } = await supabaseAdmin
    .from("company_members")
    .select("id, full_name, email, completed_at")
    .eq("company_id", company_id)
    .not("completed_at", "is", null);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://lifelinehealth.is";
  const bookUrl = `${origin.replace(/\/$/, "")}/account/login?next=${encodeURIComponent("/account/welcome")}`;
  const dateLabel = new Date(event_date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  let sent = 0, failed = 0;
  const CONCURRENCY = 5;
  const list = (members || []) as Array<{ full_name: string; email: string }>;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const slice = list.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map(async (m) => {
      const { text, html } = renderEventScheduledEmail({
        recipientName: (m.full_name || "").split(" ")[0] || "there",
        companyName: company.name,
        eventDateLabel: dateLabel,
        startTime: String(start_time).slice(0, 5),
        endTime: String(end_time).slice(0, 5),
        location,
        roomNotes: room_notes,
        bookUrl,
      });
      const r = await sendEmail({
        to: m.email,
        subject: `Your Lifeline measurement at ${company.name} — pick a time`,
        text, html,
      });
      if (r.ok) sent++; else failed++;
    }));
  }

  return NextResponse.json({ ok: true, event_id: inserted.id, recipients: list.length, sent, failed });
}
