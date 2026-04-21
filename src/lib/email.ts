const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.INVITE_FROM_EMAIL || "Lifeline Health <onboarding@lifelinehealth.is>";

export interface EmailAttachment {
  filename: string;
  content: string;      // base64
  contentType?: string; // defaults to application/octet-stream
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — logging invite instead");
    console.log("[email] TO:", opts.to, "SUBJECT:", opts.subject);
    console.log("[email] TEXT:", opts.text || opts.html);
    if (opts.attachments?.length) console.log("[email] ATTACHMENTS:", opts.attachments.map((a) => a.filename).join(", "));
    return { ok: true, id: "dev-log" };
  }
  try {
    const payload: Record<string, unknown> = {
      from: FROM_ADDRESS,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    };
    if (opts.cc) payload.cc = Array.isArray(opts.cc) ? opts.cc : [opts.cc];
    if (opts.bcc) payload.bcc = Array.isArray(opts.bcc) ? opts.bcc : [opts.bcc];
    if (opts.attachments?.length) {
      payload.attachments = opts.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.contentType || "application/octet-stream",
      }));
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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

Your health assessment has four steps, all run on-site at ${companyName || "your workplace"}:

  1. Book a 5-minute body-composition slot at the on-site measurement day your employer scheduled.
  2. Book a blood-test day — head to a Sameind clinic on one of the authorised days (walk-in 08:00–12:00, no appointment needed).
  3. A Lifeline doctor reviews your results and creates your personal health plan.
  4. View your results and plan in your Lifeline portal and in Medalia (our secure medical record system).

All your health data stays confidential — ${companyName ? `${companyName}` : "your employer"} never sees individual results.

Start here: ${welcomeUrl}
Or sign in later: ${loginUrl}

— Lifeline Health`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">You&apos;re in, ${escapeHtml(recipientName)} 🎉</h1>
    <p style="margin:0 0 20px;color:#4b5563;">
      Your Lifeline Health account is ready${companyName ? ` — welcomed aboard by <strong>${escapeHtml(companyName)}</strong>` : ""}.
    </p>
    <p style="margin:0 0 12px;color:#4b5563;"><strong>Your four steps</strong></p>
    <ol style="margin:0 0 20px;padding-left:20px;color:#4b5563;line-height:1.7;">
      <li><strong>Book your body-composition slot.</strong> Your employer scheduled an on-site measurement day. Pick a 5-minute time that works for you.</li>
      <li><strong>Book a blood-test day.</strong> Choose one of the days your employer authorised for a walk-in at Sameind (08:00–12:00).</li>
      <li><strong>Doctor review.</strong> A Lifeline doctor reviews your results and creates your personal health plan.</li>
      <li><strong>See your results.</strong> View them in your Lifeline portal and in <strong>Medalia</strong>, our secure medical record system.</li>
    </ol>
    <p style="margin:0 0 20px;color:#4b5563;font-size:13px;background:#F0FDF4;border:1px solid #BBF7D0;padding:10px 14px;border-radius:8px;">
      🔒 All health data stays confidential. ${companyName ? escapeHtml(companyName) : "Your employer"} never sees individual results — only whether you've completed the assessment.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${welcomeUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;">Start here</a>
    </div>
    <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">Questions? Reply to this email or write to <a href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.</p>
  </div>
</body></html>`;
  return { text, html };
}

// Outreach: B2B introduction to an existing (B2C) client, nudging them to
// bring Lifeline into their workplace as an employee benefit. Subject and
// body are plain so staff can further edit in the modal before sending.
export function renderB2bIntroEmail(params: {
  recipientName: string;
  signupUrl: string;        // /business/signup funnel
  infoUrl: string;          // /business landing
  senderName?: string;      // e.g. "Mads"
}) {
  const { recipientName, signupUrl, infoUrl, senderName } = params;
  const firstName = (recipientName || "there").split(" ")[0] || "there";
  const signoff = senderName || "The Lifeline team";

  const text = `Hi ${firstName},

You're using Lifeline personally — we thought you'd want to know that we also run a workplace version.

LIFELINE HEALTH FOR BUSINESS

What every employee gets:
  ✓ On-site measurements — blood pressure and body composition in 5-minute slots
  ✓ Targeted blood panel — at partner lab during work hours (walk-in)
  ✓ Doctor-reviewed report — one page, three numbers that matter, a clear plan
  ✓ 1-on-1 doctor consultation — personal review + action plan
  ✓ Coaching app (optional) — daily actions, health coach, community

How it works:
  1. Kick-off call — we scope your programme and timing
  2. Upload roster — employees get a 2-minute consent-first signup
  3. Measurement day — our nurse visits on-site
  4. Blood test at partner lab
  5. Report + doctor consultation → personal action plan

From kick-off to action plan in weeks, not quarters.

Why it works:
  • Built by physicians — every report reviewed by a doctor
  • Only what moves the needle — targeted markers, not 50-page panels
  • Priced per employee — only for what you use

Privacy: Employers see only anonymised group trends — never individual health data. Licensed by Embætti landlæknis, records in Medalia (FHIR-certified). GDPR-compliant.

Start a company workspace (2 min, no payment required):
  ${signupUrl}

Full programme overview:
  ${infoUrl}

Questions? Hit reply — we read everything.

— ${signoff}
Lifeline Health ehf.`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">

    <!-- Hero -->
    <div style="background:linear-gradient(135deg,#1F2937,#065F46);padding:32px 32px 28px;color:white;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">LIFELINE HEALTH FOR BUSINESS</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;">Invest in your people.<br>Become a health-forward company.</h1>
      <p style="margin:0;font-size:14px;opacity:0.85;line-height:1.6;">Hi ${escapeHtml(firstName)} — you're using Lifeline personally. We also run a workplace version that brings medical-grade health assessments directly to your team.</p>
    </div>

    <div style="padding:28px 32px;">

      <!-- What employees get -->
      <p style="margin:0 0 12px;color:#111827;font-weight:700;font-size:16px;">What every employee gets</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;">
        <tr><td style="padding:8px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:8px 0;color:#374151;font-size:14px;line-height:1.5;"><strong>On-site measurements</strong> — blood pressure and body composition in 5-minute slots. Our nurse comes to your office.</td></tr>
        <tr><td style="padding:8px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:8px 0;color:#374151;font-size:14px;line-height:1.5;"><strong>Targeted blood panel</strong> — at partner lab during work hours. Walk-in, no appointment needed.</td></tr>
        <tr><td style="padding:8px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:8px 0;color:#374151;font-size:14px;line-height:1.5;"><strong>Doctor-reviewed report</strong> — one page, three numbers that matter, a clear plan. No jargon, no 20-page PDFs.</td></tr>
        <tr><td style="padding:8px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:8px 0;color:#374151;font-size:14px;line-height:1.5;"><strong>1-on-1 doctor consultation</strong> — personal review to set an evidence-based action plan.</td></tr>
        <tr><td style="padding:8px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:8px 0;color:#374151;font-size:14px;line-height:1.5;"><strong>Coaching app</strong> (optional) — daily actions, health coach, community, and macro tracking.</td></tr>
      </table>

      <!-- How it works -->
      <p style="margin:0 0 12px;color:#111827;font-weight:700;font-size:16px;">How it works</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;">
        <tr><td style="padding:6px 0;vertical-align:top;width:24px;color:#6B7280;font-size:13px;font-weight:700;">1.</td><td style="padding:6px 0;color:#4B5563;font-size:14px;">Kick-off call — we scope your programme, headcount, and timing</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;width:24px;color:#6B7280;font-size:13px;font-weight:700;">2.</td><td style="padding:6px 0;color:#4B5563;font-size:14px;">Upload your roster — employees get a 2-minute consent-first signup</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;width:24px;color:#6B7280;font-size:13px;font-weight:700;">3.</td><td style="padding:6px 0;color:#4B5563;font-size:14px;">Measurement day — our nurse visits on-site, 5 min per person</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;width:24px;color:#6B7280;font-size:13px;font-weight:700;">4.</td><td style="padding:6px 0;color:#4B5563;font-size:14px;">Blood test at partner lab — walk-in, no appointment</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;width:24px;color:#6B7280;font-size:13px;font-weight:700;">5.</td><td style="padding:6px 0;color:#4B5563;font-size:14px;">Report + doctor consultation → personal action plan</td></tr>
      </table>
      <p style="margin:0 0 24px;color:#6B7280;font-size:13px;font-style:italic;">From kick-off to action plan in weeks, not quarters.</p>

      <!-- Why it works -->
      <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 10px;color:#111827;font-weight:700;font-size:14px;">Why it works</p>
        <p style="margin:0 0 6px;color:#4B5563;font-size:13px;line-height:1.6;">• <strong>Built by physicians</strong> — every report is reviewed by a doctor, not generated by an algorithm.</p>
        <p style="margin:0 0 6px;color:#4B5563;font-size:13px;line-height:1.6;">• <strong>Only what moves the needle</strong> — targeted markers that respond to lifestyle, not 50-page panels nobody reads.</p>
        <p style="margin:0;color:#4B5563;font-size:13px;line-height:1.6;">• <strong>Priced per employee</strong> — only for what you use. No bulk-package upsell.</p>
      </div>

      <!-- Privacy -->
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;padding:14px 16px;border-radius:10px;margin:0 0 28px;color:#065F46;font-size:13px;line-height:1.6;">
        🔒 <strong>Privacy first.</strong> Employers see only anonymised group trends (masked where fewer than 5 responses) — never individual health data. Licensed by Embætti landlæknis, records stored in Medalia (FHIR-certified sjúkraskrá). GDPR-compliant.
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${signupUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Start a company workspace</a>
      </div>
      <p style="text-align:center;margin:0 0 24px;color:#6b7280;font-size:13px;">
        Takes about two minutes — no payment required.<br>
        <a href="${infoUrl}" style="color:#3B82F6;text-decoration:underline;">See the full programme overview →</a>
      </p>

      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Questions? Reply to this email — we read everything.</p>
      <p style="margin:0;color:#9CA3AF;font-size:12px;">— ${escapeHtml(signoff)} · Lifeline Health ehf. · kt. 590925-1440</p>
    </div>
  </div>
</body></html>`;
  return { text, html, subject: `Lifeline for ${firstName}'s workplace — 2-minute intro` };
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

${companyName} has approved the following days for you to take your blood test at any Sameind station:

  ${days}

Walk in on any of those days during the station's opening hours. The full list of stations — with addresses and hours — is on your Lifeline account Home.

Open your patient portal: ${portalUrl}

— Lifeline Health`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 10px;font-size:22px;color:#111827;">Blood-test days are now approved</h1>
    <p style="margin:0 0 16px;color:#4b5563;">Hi ${escapeHtml(recipientName)},</p>
    <p style="margin:0 0 16px;color:#4b5563;"><strong>${escapeHtml(companyName)}</strong> has authorised these days for your blood test at any Sameind station:</p>
    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:20px 0;font-size:15px;color:#111827;line-height:1.7;">${escapeHtml(days)}</div>
    <p style="margin:0 0 16px;color:#4b5563;">Walk in on any of those days during the station's opening hours. The full list of stations — with addresses and hours — is on your Lifeline account Home.</p>
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

export function renderInvoiceContactEmail(params: {
  recipientName: string;
  companyName: string;
  quantity: number;
  unitPrice: number;
  amountTotal: number;
  invoiceNumber?: string | null;
  pdfUrl?: string | null;
}) {
  const { recipientName, companyName, quantity, unitPrice, amountTotal, invoiceNumber, pdfUrl } = params;
  const money = (n: number) => `${n.toLocaleString("is-IS")} kr.`;
  const lineItem = `Lifeline Health Assessment · ${quantity} × ${money(unitPrice)}`;
  const refLine = invoiceNumber ? `Invoice no. ${invoiceNumber}` : "";
  const text = `Hi ${recipientName},

A Lifeline Health invoice has been issued to ${companyName}.

${refLine}
${lineItem}
Total incl. VAT: ${money(amountTotal)}

The invoice is delivered through PayDay's electronic invoicing system to the company's kennitala — your accounting system should receive it automatically.
${pdfUrl ? `\nPDF copy: ${pdfUrl}\n` : ""}
If anything looks off, reply to this email and we'll help.

— Lifeline Health`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <h1 style="margin:0 0 10px;font-size:22px;color:#111827;">Your Lifeline invoice is on its way</h1>
    <p style="margin:0 0 16px;color:#4b5563;">Hi ${escapeHtml(recipientName)},</p>
    <p style="margin:0 0 16px;color:#4b5563;">We've issued an invoice to <strong>${escapeHtml(companyName)}</strong>. It's delivered through PayDay's electronic invoicing system to the company's kennitala, so your accounting software should receive it automatically.</p>
    <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin:20px 0;font-size:14px;color:#111827;line-height:1.7;">
      ${invoiceNumber ? `<div><strong>Invoice no.</strong> ${escapeHtml(invoiceNumber)}</div>` : ""}
      <div>${escapeHtml(lineItem)}</div>
      <div><strong>Total incl. VAT:</strong> ${money(amountTotal)}</div>
    </div>
    ${pdfUrl ? `<div style="text-align:center;margin:24px 0;"><a href="${pdfUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;">View PDF</a></div>` : ""}
    <p style="margin:0;color:#6b7280;font-size:13px;">If anything looks off, reply to this email and we'll help.</p>
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

// ─── Renewal / Check-in Invitation ──────────────────────────────────────────

export function renderRenewalEmail(params: {
  recipientName: string;
  companyName: string;
  lastRoundDate: string;    // e.g. "October 2025"
  lastRoundEmployees: number;
  renewalUrl: string;       // link to start renewal
  dashboardUrl: string;
}) {
  const { recipientName, companyName, lastRoundDate, lastRoundEmployees, renewalUrl, dashboardUrl } = params;
  const firstName = (recipientName || "there").split(" ")[0] || "there";

  const text = `Hi ${firstName},

It's been a while since ${companyName}'s last Lifeline health round (${lastRoundDate}, ${lastRoundEmployees} employees).

Time for a check-in? A follow-up assessment tracks what changed, adjusts each employee's plan, and gives you updated group insights.

What a check-in round includes:
  ✓ On-site measurements (blood pressure + body composition)
  ✓ Targeted blood panel
  ✓ Progress report comparing baseline to current
  ✓ Updated health score and refreshed action plan
  ✓ Brief doctor review for flagged changes

The process is the same as last time — you schedule dates, employees show up, we handle the rest. Most companies complete a round in 2-3 weeks.

Start your next round:
  ${renewalUrl}

View your company dashboard:
  ${dashboardUrl}

Questions? Reply to this email.

— The Lifeline team
Lifeline Health ehf.`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">

    <div style="background:linear-gradient(135deg,#1F2937,#065F46);padding:32px;color:white;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">TIME FOR A CHECK-IN</p>
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Track what changed.<br>Adjust the plan.</h1>
      <p style="margin:0;font-size:14px;opacity:0.85;line-height:1.6;">Hi ${escapeHtml(firstName)} — ${escapeHtml(companyName)}'s last health round was in ${escapeHtml(lastRoundDate)} (${lastRoundEmployees} employees). A check-in round measures progress and refreshes every action plan.</p>
    </div>

    <div style="padding:28px 32px;">
      <p style="margin:0 0 12px;color:#111827;font-weight:700;font-size:16px;">What's in a check-in round</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;">
        <tr><td style="padding:6px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:6px 0;color:#374151;font-size:14px;line-height:1.5;">On-site measurements — blood pressure + body composition</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:6px 0;color:#374151;font-size:14px;line-height:1.5;">Targeted blood panel at partner lab</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:6px 0;color:#374151;font-size:14px;line-height:1.5;"><strong>Progress report</strong> — baseline vs. current comparison</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:6px 0;color:#374151;font-size:14px;line-height:1.5;">Updated health score + refreshed action plan</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;width:28px;color:#10B981;font-size:16px;">✓</td><td style="padding:6px 0;color:#374151;font-size:14px;line-height:1.5;">Doctor review for any flagged changes</td></tr>
      </table>

      <div style="background:#F9FAFB;border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 4px;color:#111827;font-weight:700;font-size:14px;">Same easy process</p>
        <p style="margin:0;color:#4B5563;font-size:13px;line-height:1.6;">You schedule the dates, employees show up, we handle the rest. Most companies complete a check-in round in 2-3 weeks.</p>
      </div>

      <div style="text-align:center;margin:0 0 24px;">
        <a href="${renewalUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6,#10b981);color:white;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Start your next round</a>
      </div>
      <p style="text-align:center;margin:0 0 24px;color:#6b7280;font-size:13px;">
        <a href="${dashboardUrl}" style="color:#3B82F6;text-decoration:underline;">View your company dashboard →</a>
      </p>

      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
      <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Questions? Reply to this email.</p>
      <p style="margin:0;color:#9CA3AF;font-size:12px;">— The Lifeline team · Lifeline Health ehf.</p>
    </div>
  </div>
</body></html>`;

  return { text, html, subject: `${companyName} — time for a health check-in` };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
