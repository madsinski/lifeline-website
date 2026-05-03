import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail, renderB2bIntroEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SendPayload {
  recipient_ids: string[];
  subject?: string;            // optional override; default template used otherwise
  sender_name?: string;        // e.g. "Mads"
  dry_run?: boolean;           // if true, don't actually send, just return preview counts
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const staff = await isStaff(user.id);
  if (!staff) return NextResponse.json({ error: "forbidden_staff_only" }, { status: 403 });

  const body: SendPayload = await req.json().catch(() => ({} as SendPayload));
  const ids = Array.isArray(body.recipient_ids) ? body.recipient_ids.filter(Boolean) : [];
  if (!ids.length) return NextResponse.json({ error: "no_recipients" }, { status: 400 });
  if (ids.length > 500) return NextResponse.json({ error: "max_500_per_batch" }, { status: 400 });

  // Look up recipient info. Only send to clients who haven't opted out of marketing.
  const { data: rows, error: rErr } = await supabaseAdmin
    .from("clients_decrypted")
    .select("id, email, full_name, marketing_opt_out")
    .in("id", ids);
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL
    || req.headers.get("origin")
    || "https://lifelinehealth.is";
  const signupUrl = `${origin.replace(/\/$/, "")}/business/signup?ref=outreach`;
  const infoUrl = `${origin.replace(/\/$/, "")}/business?ref=outreach`;

  const eligible = (rows ?? []).filter((c) => c.email && !c.marketing_opt_out);
  const skipped_opted_out = (rows ?? []).filter((c) => c.marketing_opt_out).length;
  const skipped_no_email = (rows ?? []).filter((c) => !c.email).length;

  if (body.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      would_send: eligible.length,
      skipped_opted_out,
      skipped_no_email,
    });
  }

  let sent = 0;
  const failures: Array<{ email: string; error: string }> = [];
  for (const c of eligible) {
    const { subject, html, text } = renderB2bIntroEmail({
      recipientName: c.full_name || c.email,
      signupUrl,
      infoUrl,
      senderName: body.sender_name,
    });
    const finalSubject = body.subject?.trim() || subject;
    const res = await sendEmail({
      to: c.email,
      subject: finalSubject,
      html,
      text,
    });
    if (res.ok) sent++;
    else failures.push({ email: c.email, error: res.error || "unknown" });
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped_opted_out,
    skipped_no_email,
    failures,
  });
}
