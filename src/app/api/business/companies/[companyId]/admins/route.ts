import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff, findAuthUserByEmail } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

async function canManageCompany(companyId: string, userId: string): Promise<boolean> {
  const { data: c } = await supabaseAdmin
    .from("companies").select("contact_person_id").eq("id", companyId).maybeSingle();
  if (c?.contact_person_id === userId) return true;
  return await isStaff(userId);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canManageCompany(companyId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = (body?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  // M6: rate-limit co-admin invites per company (10/day)
  const { data: allowed } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: `coadmin_invite:${companyId}`,
    p_max: 10,
    p_window: "24:00:00",
  });
  if (allowed === false) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", detail: "Too many co-admin invites in the past 24h." },
      { status: 429 },
    );
  }

  // Find or create the user. New co-admins are created UNCONFIRMED; we email
  // them a magic link via Resend (Supabase's built-in SMTP isn't configured for
  // this project). The magic link both verifies their email and logs them
  // straight in — no separate set-password page needed; they can set a password
  // later from the login page via "Forgot your password?".
  let target = await findAuthUserByEmail(email);
  if (!target) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { account_origin: "business" },
    });
    if (createErr || !created.user) {
      console.error("[co-admin] createUser failed", createErr);
      return NextResponse.json({ error: "co_admin_invite_failed" }, { status: 500 });
    }
    target = created.user;
  }

  const { error } = await supabaseAdmin.from("company_admins").upsert({
    company_id: companyId,
    user_id: target.id,
    added_by: user.id,
  }, { onConflict: "company_id, user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email the colleague a one-click login link via Resend.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { data: companyRow } = await supabaseAdmin
    .from("companies").select("name").eq("id", companyId).maybeSingle();
  const companyName = companyRow?.name || "your company";
  // Email a link to our own verify route (/auth/business-confirm) carrying the
  // magic-link `hashed_token` rather than Supabase's raw `action_link`. The raw
  // action_link relies on the PKCE code-verifier flow, but the verifier is never
  // stored in the recipient's browser (this link is generated server-side), so
  // landing it straight on /business/co-admin-setup leaves them WITHOUT a session
  // — and if the inviter is logged in in the same browser, the page reads the
  // inviter's session instead. business-confirm calls verifyOtp({ token_hash })
  // which establishes the co-admin's session in cookies, then forwards to setup.
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteUrl}/business/co-admin-setup` },
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("[co-admin] generateLink failed", linkErr);
    // The co-admin row exists; tell the UI the email didn't go out.
    return NextResponse.json({ ok: true, user_id: target.id, email, email_sent: false });
  }
  const link =
    `${siteUrl}/auth/business-confirm` +
    `?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}` +
    `&type=magiclink&next=${encodeURIComponent("/business/co-admin-setup")}`;
  const send = await sendEmail({
    to: email,
    subject: `You're a co-admin for ${companyName} — Lifeline Health`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A"><h1 style="font-size:20px;margin:0 0 12px">You've been added as a co-admin</h1><p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px">You can now help manage <strong>${companyName}</strong> on Lifeline Health — register employees, schedule the days, and more. Click below to log in.</p><p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#10B981);color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px">Log in to Lifeline Health</a></p><p style="font-size:12px;line-height:1.6;color:#64748B;margin:0 0 8px">If the button doesn't work, paste this link into your browser:</p><p style="font-size:12px;color:#3B82F6;word-break:break-all;margin:0 0 16px">${link}</p><p style="font-size:12px;color:#94A3B8;margin:0">This link signs you in directly. You can set a password afterwards from the login page via &ldquo;Forgot your password?&rdquo;.</p></div>`,
    text: `You've been added as a co-admin for ${companyName} on Lifeline Health. Log in here: ${link}`,
  });
  if (!send.ok) console.error("[co-admin] invite email failed", send.error);
  return NextResponse.json({ ok: true, user_id: target.id, email, email_sent: send.ok });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canManageCompany(companyId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("company_admins")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
