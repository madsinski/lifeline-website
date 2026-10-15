import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findAuthUserByEmail } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

// Branded confirmation email. We send the link ourselves via Resend (the
// channel used for all transactional mail) rather than relying on Supabase's
// built-in SMTP, which isn't configured for this project.
function confirmationEmailHtml(link: string): string {
  return `
  <div lang="is" style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
    <h1 style="font-size:20px;margin:0 0 12px">Staðfestu netfangið þitt</h1>
    <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px">
      Takk fyrir að hefja skráningu fyrirtækisins hjá Lifeline Health. Staðfestu netfangið
      til að halda áfram — ekki er hægt að skrá fyrirtækið eða bjóða starfsfólki fyrr en
      netfangið hefur verið staðfest.
    </p>
    <p style="margin:0 0 24px">
      <a href="${link}" style="display:inline-block;background:#047857;color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px">
        Staðfesta netfang og halda áfram
      </a>
    </p>
    <p style="font-size:12px;line-height:1.6;color:#64748B;margin:0 0 8px">
      Ef hnappurinn virkar ekki geturðu afritað þennan hlekk í vafrann:
    </p>
    <p style="font-size:12px;line-height:1.6;color:#047857;word-break:break-all;margin:0 0 24px">${link}</p>
    <p style="font-size:12px;color:#94A3B8;margin:0">
      Ef þú baðst ekki um þetta máttu hunsa póstinn.
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
        detail: "Netfangið er þegar með Lifeline-aðgang. Skráðu þig inn í staðinn.",
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

  // Generate a magic-link token and email a link to our own verify route
  // (/auth/business-confirm). We deliberately email the `hashed_token` rather
  // than Supabase's raw `action_link`: the action_link relies on the PKCE
  // code-verifier flow, but the verifier is never stored in the recipient's
  // browser (this link is generated server-side), so the raw link lands them on
  // the page WITHOUT a session and bounces them to login. Our verify route
  // calls verifyOtp({ token_hash, type }) client-side, which both confirms the
  // email (sets email_confirmed_at) and establishes the session in cookies — so
  // the user arrives at onboarding already signed in.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteUrl}/business/signup` },
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("[b2b signup] generateLink failed", linkErr);
    return NextResponse.json({ error: "confirmation_link_failed" }, { status: 500 });
  }

  const confirmLink =
    `${siteUrl}/auth/business-confirm` +
    `?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}` +
    `&type=magiclink&next=${encodeURIComponent("/business/signup")}`;

  const send = await sendEmail({
    to: email,
    subject: "Staðfestu netfangið — Lifeline Health",
    html: confirmationEmailHtml(confirmLink),
    text: `Staðfestu netfangið til að halda áfram að skrá fyrirtækið hjá Lifeline Health:\n\n${confirmLink}`,
  });
  if (!send.ok) {
    console.error("[b2b signup] confirmation email failed", send.error);
    return NextResponse.json({ error: "email_send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: userId, confirmation_required: true });
}
