import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findAuthUserByEmail } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

// Branded confirmation email. We send the link ourselves via Resend (the
// channel used for all transactional mail) rather than relying on Supabase's
// built-in SMTP, which isn't configured for this project.
function confirmationEmailHtml(link: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
    <h1 style="font-size:20px;margin:0 0 12px">Confirm your email</h1>
    <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px">
      Thanks for starting your company setup with Lifeline Health. Please confirm this
      email address to continue — you won't be able to create your company or invite
      employees until it's verified.
    </p>
    <p style="margin:0 0 24px">
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#10B981);color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px">
        Confirm email &amp; continue
      </a>
    </p>
    <p style="font-size:12px;line-height:1.6;color:#64748B;margin:0 0 8px">
      If the button doesn't work, paste this link into your browser:
    </p>
    <p style="font-size:12px;line-height:1.6;color:#3B82F6;word-break:break-all;margin:0 0 24px">${link}</p>
    <p style="font-size:12px;color:#94A3B8;margin:0">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (body?.email || "").trim().toLowerCase();
  const password: string | undefined = body?.password;
  const fullName = (body?.full_name || "").trim();
  // resend === true → the account already exists but is unconfirmed; just
  // re-issue the confirmation link (no password needed).
  const resend = body?.resend === true;

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const existing = await findAuthUserByEmail(email);

  let userId: string;
  if (existing) {
    // Already confirmed → this is a real duplicate; tell them to sign in.
    if (existing.email_confirmed_at) {
      return NextResponse.json({
        error: "email_already_registered",
        detail: "This email already has a Lifeline account. Please sign in instead.",
      }, { status: 409 });
    }
    // Exists but unconfirmed → fall through and (re)send the confirmation link.
    userId = existing.id;
  } else {
    // New account — require a real password.
    if (!password || password.length < 12) {
      return NextResponse.json({ error: "password must be at least 12 characters" }, { status: 400 });
    }
    // Create the user UNCONFIRMED. The email-confirmation gate (#13) depends
    // on email_confirmed_at staying null until the link below is clicked.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      // account_origin tags this as a B2B contact so the consumer /account
      // surface can route them to /business instead of the patient welcome
      // flow if they abandon company registration.
      user_metadata: { full_name: fullName || email.split("@")[0], account_origin: "business" },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: "signup_failed" }, { status: 500 });
    }
    userId = data.user.id;

    // Ensure a clients row exists (idempotent)
    await supabaseAdmin.from("clients_decrypted").upsert(
      {
        id: userId,
        email,
        full_name: fullName || email.split("@")[0],
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  }

  // Generate a confirmation link and email it via Resend. A magic link both
  // verifies the email (sets email_confirmed_at) and signs the user in when
  // clicked, landing them back in the onboarding flow.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteUrl}/business/signup` },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error("[b2b signup] generateLink failed", linkErr);
    return NextResponse.json({ error: "confirmation_link_failed" }, { status: 500 });
  }

  const send = await sendEmail({
    to: email,
    subject: "Confirm your email — Lifeline Health",
    html: confirmationEmailHtml(linkData.properties.action_link),
    text: `Confirm your email to continue setting up your company on Lifeline Health:\n\n${linkData.properties.action_link}`,
  });
  if (!send.ok) {
    console.error("[b2b signup] confirmation email failed", send.error);
    return NextResponse.json({ error: "email_send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: userId, confirmation_required: true });
}
