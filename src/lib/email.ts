const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.INVITE_FROM_EMAIL || "Lifeline Health <onboarding@lifelinehealth.is>";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — logging invite instead");
    console.log("[email] TO:", opts.to, "SUBJECT:", opts.subject);
    console.log("[email] TEXT:", opts.text || opts.html);
    return { ok: true, id: "dev-log" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error?.message || JSON.stringify(json) };
    return { ok: true, id: json.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function renderInviteEmail(params: {
  companyName: string;
  recipientName: string;
  onboardUrl: string;
  password: string;
}) {
  const { companyName, recipientName, onboardUrl, password } = params;
  const text = `Hi ${recipientName},

${companyName} has invited you to onboard with Lifeline Health.

To complete your registration, open the link below and enter the password.

Link: ${onboardUrl}
Password: ${password}

The password is case-sensitive. If you didn't expect this email, you can ignore it.

— Lifeline Health`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Welcome to Lifeline Health</h1>
    <p style="margin:0 0 20px;color:#4b5563;">Hi ${escapeHtml(recipientName)},</p>
    <p style="margin:0 0 20px;color:#4b5563;"><strong>${escapeHtml(companyName)}</strong> has invited you to register with Lifeline Health.</p>
    <p style="margin:0 0 16px;color:#4b5563;">To complete your registration, click the button below and enter your password.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${onboardUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;">Start onboarding</a>
    </div>
    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:20px 0;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">Your password</div>
      <div style="font-family:ui-monospace,monospace;font-size:22px;letter-spacing:0.1em;color:#111827;">${escapeHtml(password)}</div>
    </div>
    <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">If you didn't expect this email, you can ignore it. The link expires in 30 days.</p>
  </div>
</body></html>`;
  return { text, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
