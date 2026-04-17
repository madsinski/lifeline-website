import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { generatePassword } from "@/lib/parse-roster";
import { sendEmail, renderInviteEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const memberId: string | undefined = body?.member_id;
  const memberIds: string[] = Array.isArray(body?.member_ids) ? body.member_ids : memberId ? [memberId] : [];
  if (!memberIds.length) return NextResponse.json({ error: "member_id or member_ids required" }, { status: 400 });

  // Load members + verify ownership on each unique company
  const { data: members } = await supabaseAdmin
    .from("company_members")
    .select("id, company_id, full_name, email, invite_token, invited_at, invite_sent_count, completed_at")
    .in("id", memberIds);
  if (!members?.length) return NextResponse.json({ error: "members not found" }, { status: 404 });

  const companyIds = Array.from(new Set(members.map((m) => m.company_id)));
  const { data: companies } = await supabaseAdmin
    .from("companies")
    .select("id, name, contact_person_id")
    .in("id", companyIds);
  const companyMap = new Map((companies || []).map((c) => [c.id, c]));

  // Staff check
  const { data: staff } = await supabaseAdmin.from("staff").select("id").eq("id", user.id).eq("active", true).maybeSingle();
  const isStaffMember = !!staff;

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://lifelinehealth.is";
  const results: Array<{ id: string; email: string; ok: boolean; error?: string }> = [];

  for (const m of members) {
    const c = companyMap.get(m.company_id);
    if (!c) { results.push({ id: m.id, email: m.email, ok: false, error: "company missing" }); continue; }
    if (c.contact_person_id !== user.id && !isStaffMember) {
      results.push({ id: m.id, email: m.email, ok: false, error: "forbidden" }); continue;
    }
    if (m.completed_at) {
      results.push({ id: m.id, email: m.email, ok: false, error: "already completed" }); continue;
    }

    // Regenerate a fresh password on every send
    const password = generatePassword();
    const { error: pwErr } = await supabaseAdmin.rpc("set_member_invite_password", {
      p_member_id: m.id,
      p_password: password,
    });
    if (pwErr) { results.push({ id: m.id, email: m.email, ok: false, error: pwErr.message }); continue; }

    const onboardUrl = `${origin.replace(/\/$/, "")}/business/onboard/${m.invite_token}`;
    const { text, html } = renderInviteEmail({
      companyName: c.name,
      recipientName: m.full_name,
      onboardUrl,
      password,
    });

    const send = await sendEmail({
      to: m.email,
      subject: `Complete your Lifeline Health registration for ${c.name}`,
      text,
      html,
    });
    if (!send.ok) {
      results.push({ id: m.id, email: m.email, ok: false, error: send.error }); continue;
    }

    await supabaseAdmin
      .from("company_members")
      .update({
        invited_at: new Date().toISOString(),
        invite_sent_count: (m.invite_sent_count || 0) + 1,
      })
      .eq("id", m.id);

    results.push({ id: m.id, email: m.email, ok: true });
  }

  return NextResponse.json({
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
