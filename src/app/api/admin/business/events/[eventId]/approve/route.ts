import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { sendEmail, renderEventScheduledEmail } from "@/lib/email";

export const maxDuration = 60;

// Staff approve/reject a company-proposed measurement day (#16). On
// approval the employee invitations are broadcast (this is the point at
// which the day is confirmed, so it shouldn't happen at creation time).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    const status = auth === "unauthorized" ? 401 : auth === "mfa_required" ? 403 : 403;
    return NextResponse.json({ error: auth }, { status });
  }
  const user = auth;

  const body = await req.json().catch(() => ({}));
  const action = body?.action === "reject" ? "reject" : "approve";
  const note = (body?.note || "").trim() || null;

  const { data: event } = await supabaseAdmin
    .from("body_comp_events")
    .select("id, company_id, event_date, start_time, end_time, location, room_notes, approval_status")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabaseAdmin
    .from("body_comp_events")
    .update({
      approval_status: action === "approve" ? "approved" : "rejected",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      admin_note: note,
    })
    .eq("id", eventId);

  if (action !== "approve") {
    return NextResponse.json({ ok: true, approval_status: "rejected" });
  }

  // ─── Approved: broadcast to onboarded employees ─────────────
  const { data: company } = await supabaseAdmin
    .from("companies").select("name").eq("id", event.company_id).maybeSingle();
  const { data: members } = await supabaseAdmin
    .from("company_members")
    .select("full_name, email, completed_at")
    .eq("company_id", event.company_id)
    .not("completed_at", "is", null);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.lifelinehealth.is";
  const bookUrl = `${origin.replace(/\/$/, "")}/account/login?next=${encodeURIComponent("/account/welcome")}`;
  const dateLabel = new Date(event.event_date + "T00:00:00").toLocaleDateString("en-GB", {
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
        companyName: company?.name || "your company",
        eventDateLabel: dateLabel,
        startTime: String(event.start_time).slice(0, 5),
        endTime: String(event.end_time).slice(0, 5),
        location: event.location,
        roomNotes: event.room_notes,
        bookUrl,
      });
      const r = await sendEmail({
        to: m.email,
        subject: `Your Lifeline measurement at ${company?.name || "work"} — pick a time`,
        text, html,
      });
      if (r.ok) sent++; else failed++;
    }));
  }

  return NextResponse.json({ ok: true, approval_status: "approved", recipients: list.length, sent, failed });
}
