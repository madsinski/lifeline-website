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

export function renderWelcomeEmail(params: {
  companyName: string | null;
  recipientName: string;
  welcomeUrl: string;
  loginUrl: string;
}) {
  const { companyName, recipientName, welcomeUrl, loginUrl } = params;
  const viaLine = companyName ? ` via ${companyName}` : "";
  const text = `Hi ${recipientName},

You're registered with Lifeline Health${viaLine}. 🎉

Your next steps:
  1. Activate your body-composition profile
  2. Book your scan at a Lifeline station
  3. Open your patient portal to view clinical records
  4. Download the Lifeline app (coming soon)

Start here: ${welcomeUrl}
Or sign in: ${loginUrl}

— Lifeline Health`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">You&apos;re in, ${escapeHtml(recipientName)} 🎉</h1>
    <p style="margin:0 0 20px;color:#4b5563;">
      Your Lifeline Health account is ready${companyName ? ` — welcomed aboard by <strong>${escapeHtml(companyName)}</strong>` : ""}.
    </p>
    <p style="margin:0 0 12px;color:#4b5563;"><strong>Your next steps</strong></p>
    <ol style="margin:0 0 20px;padding-left:20px;color:#4b5563;line-height:1.6;">
      <li>Activate your body-composition profile</li>
      <li>Book your scan at a Lifeline station</li>
      <li>Open your patient portal</li>
      <li>Download the Lifeline app (coming soon)</li>
    </ol>
    <div style="text-align:center;margin:28px 0;">
      <a href="${welcomeUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;">Start here</a>
    </div>
    <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">Questions? Reply to this email or write to <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.</p>
  </div>
</body></html>`;
  return { text, html };
}

export function renderEventScheduledEmail(params: {
  recipientName: string;
  companyName: string;
  eventDateLabel: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  roomNotes?: string | null;
  bookUrl: string;
}) {
  const { recipientName, companyName, eventDateLabel, startTime, endTime, location, roomNotes, bookUrl } = params;
  const text = `Hi ${recipientName},

${companyName} has scheduled your on-site Lifeline body-composition measurements for ${eventDateLabel}, ${startTime}–${endTime}.
${location ? `Where: ${location}\n` : ""}${roomNotes ? `Room: ${roomNotes}\n` : ""}
Pick your 5-minute slot here: ${bookUrl}

Each slot holds 2 people. Slots fill up fast — please book as soon as you can.

— Lifeline Health`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 10px;font-size:22px;color:#111827;">Your body-composition measurement is scheduled</h1>
    <p style="margin:0 0 16px;color:#4b5563;">Hi ${escapeHtml(recipientName)},</p>
    <p style="margin:0 0 16px;color:#4b5563;"><strong>${escapeHtml(companyName)}</strong> is hosting an on-site Lifeline body-composition day for all employees.</p>
    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:20px 0;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">When</div>
      <div style="font-size:16px;font-weight:600;color:#111827;">${escapeHtml(eventDateLabel)}</div>
      <div style="font-size:14px;color:#4b5563;margin-top:2px;">${escapeHtml(startTime)} – ${escapeHtml(endTime)}</div>
      ${location ? `<div style="font-size:12px;color:#6b7280;margin-top:10px;">Where</div><div style="font-size:14px;color:#111827;">${escapeHtml(location)}</div>` : ""}
      ${roomNotes ? `<div style="font-size:12px;color:#6b7280;margin-top:8px;">${escapeHtml(roomNotes)}</div>` : ""}
    </div>
    <p style="margin:0 0 16px;color:#4b5563;">Each measurement takes 5 minutes. Two people can be measured per slot. <strong>Pick your slot now</strong> — they fill up quickly.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${bookUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;">Pick my slot</a>
    </div>
  </div>
</body></html>`;
  return { text, html };
}

export function renderBloodTestDaysEmail(params: {
  recipientName: string;
  companyName: string;
  dayLabels: string[];
  portalUrl: string;
}) {
  const { recipientName, companyName, dayLabels, portalUrl } = params;
  const days = dayLabels.join(", ");
  const text = `Hi ${recipientName},

${companyName} has approved the following days for you to take your blood test at Sameind, between 08:00 and 12:00:

  ${days}

You can leave work during those hours to go in. You'll receive the booking link via the patient portal.

Open your patient portal: ${portalUrl}

— Lifeline Health`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 10px;font-size:22px;color:#111827;">Blood-test days are now approved</h1>
    <p style="margin:0 0 16px;color:#4b5563;">Hi ${escapeHtml(recipientName)},</p>
    <p style="margin:0 0 16px;color:#4b5563;"><strong>${escapeHtml(companyName)}</strong> has authorised these days for your blood test at Sameind, between <strong>08:00 and 12:00</strong>:</p>
    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:20px 0;font-size:15px;color:#111827;line-height:1.7;">${escapeHtml(days)}</div>
    <p style="margin:0 0 16px;color:#4b5563;">You can leave work during those hours to go in. You'll get the booking details via the patient portal.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;">Open patient portal</a>
    </div>
  </div>
</body></html>`;
  return { text, html };
}

export function renderEventReminderEmail(params: {
  recipientName: string;
  companyName: string;
  eventDateLabel: string;
  slotTime: string;
  location?: string | null;
  roomNotes?: string | null;
}) {
  const { recipientName, companyName, eventDateLabel, slotTime, location, roomNotes } = params;
  const text = `Hi ${recipientName},

Friendly reminder — your Lifeline body-composition measurement is tomorrow (${eventDateLabel}) at ${slotTime}.

${location ? `Where: ${location}\n` : ""}${roomNotes ? `Room: ${roomNotes}\n` : ""}
What to expect:
  - The measurement takes 5 minutes
  - Wear light clothing (no watches or metal jewellery)
  - Avoid heavy meals and alcohol in the 4 hours before

See you tomorrow!

— Lifeline Health`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 10px;font-size:22px;color:#111827;">Your measurement is tomorrow</h1>
    <p style="margin:0 0 16px;color:#4b5563;">Hi ${escapeHtml(recipientName)},</p>
    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:20px 0;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">When</div>
      <div style="font-size:16px;font-weight:600;color:#111827;">${escapeHtml(eventDateLabel)} · ${escapeHtml(slotTime)}</div>
      ${location ? `<div style="font-size:12px;color:#6b7280;margin-top:10px;">Where</div><div style="font-size:14px;color:#111827;">${escapeHtml(location)}</div>` : ""}
      ${roomNotes ? `<div style="font-size:12px;color:#6b7280;margin-top:8px;">${escapeHtml(roomNotes)}</div>` : ""}
    </div>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px;margin:20px 0;font-size:13px;color:#92400e;">
      <div style="font-weight:600;margin-bottom:4px;">A few tips</div>
      <ul style="margin:0;padding-left:18px;line-height:1.7;">
        <li>Wear light clothing (no watches or metal jewellery)</li>
        <li>Avoid heavy meals and alcohol in the 4 hours before</li>
        <li>The measurement takes 5 minutes</li>
      </ul>
    </div>
    <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">Can't make it? Reply to this email or cancel your slot in the Lifeline portal.</p>
  </div>
</body></html>`;
  return { text, html };
}

export function renderFinalizeStaffEmail(params: {
  companyName: string;
  contactEmail: string;
  memberCount: number;
  eventCount: number;
  bloodDayCount: number;
  adminUrl: string;
}) {
  const { companyName, contactEmail, memberCount, eventCount, bloodDayCount, adminUrl } = params;
  const text = `${companyName} has finalized their Lifeline Health B2B registration.

Contact: ${contactEmail}
Roster: ${memberCount} employees
Body-comp events: ${eventCount}
Blood-test days: ${bloodDayCount}

Open the company in admin: ${adminUrl}`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 10px;font-size:22px;color:#111827;">${escapeHtml(companyName)} is ready</h1>
    <p style="margin:0 0 16px;color:#4b5563;">Their contact person (${escapeHtml(contactEmail)}) has finalized the B2B setup.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:6px 0;color:#4b5563;">Roster</td><td style="padding:6px 0;text-align:right;font-weight:600;">${memberCount}</td></tr>
      <tr><td style="padding:6px 0;color:#4b5563;">Body-comp events scheduled</td><td style="padding:6px 0;text-align:right;font-weight:600;">${eventCount}</td></tr>
      <tr><td style="padding:6px 0;color:#4b5563;">Blood-test days picked</td><td style="padding:6px 0;text-align:right;font-weight:600;">${bloodDayCount}</td></tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${adminUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;">Open in admin</a>
    </div>
  </div>
</body></html>`;
  return { text, html };
}

export function renderFinalizeContactEmail(params: {
  recipientName: string;
  companyName: string;
  portalUrl: string;
}) {
  const { recipientName, companyName, portalUrl } = params;
  const text = `Hi ${recipientName},

Your Lifeline Health registration for ${companyName} is complete. Our admin team has been notified — your part is done for now.

You can still manage the roster, body-composition day, and blood-test days from the Lifeline business dashboard: ${portalUrl}

We'll take it from here. See you on measurement day.

— Lifeline Health`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 10px;font-size:22px;color:#111827;">Registration complete 🎉</h1>
    <p style="margin:0 0 16px;color:#4b5563;">Hi ${escapeHtml(recipientName)},</p>
    <p style="margin:0 0 16px;color:#4b5563;">Your Lifeline Health registration for <strong>${escapeHtml(companyName)}</strong> is complete. Our admin team has been notified — your part is done for now.</p>
    <p style="margin:0 0 16px;color:#4b5563;">You can still manage the roster, body-composition day, and blood-test days from the business dashboard whenever you need to.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;">Open dashboard</a>
    </div>
  </div>
</body></html>`;
  return { text, html };
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
