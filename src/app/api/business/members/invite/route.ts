import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { generatePassword } from "@/lib/parse-roster";
import { sendEmail, renderInviteEmail } from "@/lib/email";

export const maxDuration = 60;

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
    .select("id, name, contact_person_id, agreement_signed_at")
    .in("id", companyIds);
  const companyMap = new Map((companies || []).map((c) => [c.id, c]));

  // Staff check (admin/coach can bypass the agreement gate below for
  // QA / recovery flows).
  const { data: staff } = await supabaseAdmin.from("staff").select("id").eq("id", user.id).eq("active", true).maybeSingle();
  const isStaffMember = !!staff;

  // Pre-check: every targeted company must have signed the platform
  // agreement before invites go out. Refuse the whole batch (rather
  // than partial-send) so the admin gets a clear error and can sign
  // first.
  if (!isStaffMember) {
    const unsigned = (companies || []).filter((c) => !c.agreement_signed_at);
    if (unsigned.length > 0) {
      return NextResponse.json({
        error: "agreement_not_signed",
        detail: `Sign the platform agreement for ${unsigned.map((c) => c.name).join(", ")} before sending invites.`,
        companies: unsigned.map((c) => ({ id: c.id, name: c.name })),
      }, { status: 409 });
    }
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://lifelinehealth.is";
  type InviteResult = { id: string; email: string; ok: boolean; error?: string };
  type Member = NonNullable<typeof members>[number];

  async function sendOne(m: Member): Promise<InviteResult> {
    const c = companyMap.get(m.company_id);
    if (!c) return { id: m.id, email: m.email, ok: false, error: "company missing" };
    if (c.contact_person_id !== user!.id && !isStaffMember) {
      return { id: m.id, email: m.email, ok: false, error: "forbidden" };
    }
    if (m.completed_at) return { id: m.id, email: m.email, ok: false, error: "already completed" };

    const password = generatePassword();
    const { error: pwErr } = await supabaseAdmin.rpc("set_member_invite_password", {
      p_member_id: m.id,
      p_password: password,
    });
    if (pwErr) return { id: m.id, email: m.email, ok: false, error: pwErr.message };

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
    if (!send.ok) return { id: m.id, email: m.email, ok: false, error: send.error };

    // Refresh token expiration on every (re)send — 30-day window. The
    // verify endpoint rejects expired tokens before any password attempt
    // so leaked / forwarded invites can no longer be used to enumerate
    // kennitala indefinitely.
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("company_members")
      .update({
        invited_at: new Date().toISOString(),
        invite_token_expires_at: expiresAt,
        invite_sent_count: (m.invite_sent_count || 0) + 1,
      })
      .eq("id", m.id);

    return { id: m.id, email: m.email, ok: true };
  }

  // Resend free tier: ~2 req/s. Keep concurrency modest.
  const CONCURRENCY = 5;
  const results: InviteResult[] = [];
  for (let i = 0; i < members.length; i += CONCURRENCY) {
    const slice = members.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(slice.map(sendOne))));
  }

  return NextResponse.json({
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
