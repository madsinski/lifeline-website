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

// Outreach: first-contact B2B introduction. Goes to cold / warm leads who
// are not yet Lifeline users. Subject and body are plain so staff can
// further edit in the modal before sending.
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

We'd like to introduce Lifeline Health — a medical-grade preventive-health programme that comes to your workplace.

Most workplace health benefits are noise. Bulk 50-marker blood panels nobody reads. Online questionnaires no clinician ever sees. Or shallow perks that have nothing to do with whether your people are actually healthier a year from now.

Lifeline is the opposite. An Icelandic medical team, licensed by Embætti landlæknis, builds a real clinical picture of each employee — then writes a detailed, doctor-reviewed action plan each person can actually follow.

WHAT THIS MEANS FOR YOU
  • Low admin — Upload a roster once. We handle scheduling, comms, reminders, follow-up. Your dashboard shows participation status only.
  • High participation — On-site, during work hours, 5 min per person. Consent-first 2-minute signup.
  • Safe when flagged — Abnormal results trigger doctor follow-up and a clear referral pathway to heilsugæsla or sérfræðilæknar. Employees aren't left alone, and neither are you.
  • Privacy you can prove — GDPR + lög nr. 90/2018. DPA signed digitally at setup. You see only anonymised group trends (masked below 5). Records in Medalia (FHIR-certified sjúkraskrá, lög nr. 55/2009).
  • Medicine, not a wellness app — Landlæknir-licensed practice. Real doctors, nurses, coaches. Every report reviewed by a doctor.
  • Transparent and flexible — Pay per employee. No bulk minimums, no hidden fees. Cancel anytime.

WHAT EVERY EMPLOYEE GETS
  01  Clinical questionnaire — lifestyle, family history, symptoms — reviewed by a doctor
  02  On-site measurements — blood pressure, body composition (Biody), 5 min per person
  03  Targeted blood panel — at a Sameind clinic during work hours, walk-in
  04  Detailed medical report and action plan — scoring across medical and behavioural aspects of the four pillars of health (sleep, exercise, nutrition, mental wellbeing) plus metabolic blood tests and body measurements. The action plan translates it into concrete, achievable tasks.
  05  1-on-1 doctor consultation — personal review of the report and action plan
  06  Coaching app (optional) — daily actions, dedicated health coach, personalised programs across the four pillars, macro tracking, wearable integration, weigh-ins, education, community, accountability partner

HOW IT WORKS
  1. Kick-off call — we scope programme, headcount, and timing (30 min)
  2. Upload roster — employees get a 2-minute consent-first signup
  3. Measurement day — our nurse visits on-site
  4. Blood test at Sameind
  5. Detailed report + doctor consultation → personal action plan

From kick-off to employee action plans in weeks, not quarters.

Start a company workspace (2 min, no payment required):
  ${signupUrl}

Full programme overview:
  ${infoUrl}

Happy to answer anything — just hit reply.

— ${signoff}
Lifeline Health ehf. · kt. 590925-1440`;

  // Derive logo URL from the signup URL's origin so it works across
  // preview / prod domains without hardcoding.
  let logoUrl = "https://www.lifelinehealth.is/lifeline-logo.png";
  try { logoUrl = new URL(signupUrl).origin + "/lifeline-logo.png"; } catch {}

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;margin:0;">
  <div style="max-width:640px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">

    <!-- Branded header -->
    <div style="background:white;padding:22px 32px;text-align:center;border-bottom:1px solid #F1F5F9;">
      <a href="${infoUrl}" style="display:inline-block;text-decoration:none;">
        <img src="${logoUrl}" alt="Lifeline Health" width="140" style="display:block;height:auto;max-width:140px;" />
      </a>
    </div>

    <!-- Hero -->
    <div style="background:linear-gradient(135deg,#0F172A,#065F46);padding:40px 32px 36px;color:white;position:relative;">
      <p style="margin:0 0 10px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;opacity:0.7;font-weight:600;color:#A7F3D0;">Lifeline Health for Business</p>
      <h1 style="margin:0 0 14px;font-size:28px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;">Real preventive health,<br/>delivered at the workplace.</h1>
      <p style="margin:0;font-size:15px;opacity:0.9;line-height:1.55;max-width:520px;">Hi ${escapeHtml(firstName)} — a quick introduction to an Icelandic medical programme that builds a proper clinical picture of every employee, then delivers a detailed doctor-reviewed report and a personal action plan.</p>
    </div>

    <!-- Stat strip -->
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
      <tr>
        <td style="padding:18px 8px;text-align:center;border-right:1px solid #E2E8F0;">
          <div style="font-size:22px;font-weight:700;color:#10B981;letter-spacing:-0.01em;">5 min</div>
          <div style="font-size:10.5px;color:#64748B;text-transform:uppercase;letter-spacing:1.2px;margin-top:2px;">per employee<br/>on-site</div>
        </td>
        <td style="padding:18px 8px;text-align:center;border-right:1px solid #E2E8F0;">
          <div style="font-size:22px;font-weight:700;color:#10B981;letter-spacing:-0.01em;">Doctor-led</div>
          <div style="font-size:10.5px;color:#64748B;text-transform:uppercase;letter-spacing:1.2px;margin-top:2px;">every report<br/>reviewed</div>
        </td>
        <td style="padding:18px 8px;text-align:center;border-right:1px solid #E2E8F0;">
          <div style="font-size:22px;font-weight:700;color:#10B981;letter-spacing:-0.01em;">1-on-1</div>
          <div style="font-size:10.5px;color:#64748B;text-transform:uppercase;letter-spacing:1.2px;margin-top:2px;">doctor<br/>consultation</div>
        </td>
        <td style="padding:18px 8px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#10B981;letter-spacing:-0.01em;">100%</div>
          <div style="font-size:10.5px;color:#64748B;text-transform:uppercase;letter-spacing:1.2px;margin-top:2px;">confidential<br/>records</div>
        </td>
      </tr>
    </table>

    <div style="padding:32px 32px 16px;">

      <!-- Intro framing -->
      <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.65;">
        Most workplace health benefits are noise — bulk 50-marker panels no one reads, anonymous questionnaires no clinician ever sees, or perks that don't touch actual health.
      </p>
      <p style="margin:0 0 28px;color:#334155;font-size:15px;line-height:1.65;">
        Lifeline is the opposite. A practising medical team builds a real clinical picture of each employee, then writes a detailed, doctor-reviewed action plan each person can actually follow.
      </p>

      <!-- What this means for you — answers HR's actual concerns, upfront -->
      <p style="margin:0 0 6px;color:#0F172A;font-weight:700;font-size:17px;letter-spacing:-0.01em;">What this means for you</p>
      <p style="margin:0 0 14px;color:#64748B;font-size:13px;">The practical things HR decision-makers usually ask.</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:28px;">
        ${[
          {
            t: "Low admin for your team",
            d: "Upload a roster once — we handle scheduling, comms, reminders, and follow-up. Your dashboard shows participation status only. No spreadsheets, no email threads.",
          },
          {
            t: "Employees actually turn up",
            d: "On-site during work hours, 5 minutes per person, no travel. Consent-first signup in 2 minutes. Designed so participation isn't a chore.",
          },
          {
            t: "Safe when something's flagged",
            d: "Abnormal results trigger doctor follow-up and a clear referral pathway to heilsugæsla or sérfræðilæknar. Employees aren't left alone with a scary number — and neither are you.",
          },
          {
            t: "Privacy you can prove",
            d: "GDPR + lög nr. 90/2018. Data-processing agreement signed digitally at setup. You see only anonymised group trends (masked below 5 responses). Records in Medalia — FHIR-certified sjúkraskrá (lög nr. 55/2009).",
          },
          {
            t: "Medicine, not a wellness app",
            d: "Practising under a Landlæknir licence. Real medical doctors, nurses and health coaches — every report reviewed by a doctor, not generated by an algorithm.",
          },
          {
            t: "Transparent and flexible",
            d: "Pay per employee, no bulk minimums, no hidden fees. Cancel anytime. You keep your aggregate insights if you leave.",
          },
        ].map((s) => `
        <tr>
          <td style="padding:6px 0;vertical-align:top;">
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F8FAFC;border:1px solid #E2E8F0;border-left:3px solid #10B981;border-radius:8px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-weight:700;color:#0F172A;font-size:13.5px;margin-bottom:4px;">${s.t}</div>
                  <div style="color:#475569;font-size:12.5px;line-height:1.6;">${s.d}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`).join("")}
      </table>

      <!-- What every employee gets — monochrome brand cards with numbered badges -->
      <p style="margin:0 0 14px;color:#0F172A;font-weight:700;font-size:17px;letter-spacing:-0.01em;">What every employee gets</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:28px;">
        ${[
          { n: "01", t: "Clinical questionnaire", d: "Lifestyle, family history, symptoms — structured and reviewed by a Lifeline doctor." },
          { n: "02", t: "On-site measurements", d: "Blood pressure and body composition (Biody) — 5 minutes per person, our nurse visits your office." },
          { n: "03", t: "Targeted blood panel", d: "At a Sameind clinic during work hours. Walk-in, no appointment required." },
          { n: "04", t: "Detailed medical report and action plan", d: "We score medical and behavioural aspects of the four pillars of health — sleep, exercise, nutrition, mental wellbeing — plus metabolic blood tests and body measurements. A real, understandable picture of where each person's health stands and which areas need attention. The action plan translates that into concrete, achievable tasks." },
          { n: "05", t: "1-on-1 doctor consultation", d: "Personal review of the report with a Lifeline doctor. Questions answered, next steps confirmed." },
          { n: "06", t: "Coaching app <span style=\"color:#64748B;font-weight:500;font-size:11.5px;\">(optional)</span>", d: "Daily actions, a dedicated health coach, personalised programs across the four pillars, macro tracking, wearable integration, weigh-ins and trends, short education courses, community and an accountability partner — the whole health and lifestyle app in one place, turning the plan into daily habits." },
        ].map((s) => `
        <tr>
          <td style="padding:8px 0;vertical-align:top;">
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:white;border:1px solid #E2E8F0;border-radius:12px;">
              <tr>
                <td style="width:56px;padding:16px 0 16px 18px;vertical-align:top;">
                  <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3B82F6,#10B981);color:white;text-align:center;font-weight:700;font-size:12.5px;letter-spacing:0.5px;line-height:36px;">${s.n}</div>
                </td>
                <td style="padding:16px 18px 16px 10px;vertical-align:top;">
                  <div style="font-weight:700;color:#0F172A;font-size:14px;margin-bottom:3px;">${s.t}</div>
                  <div style="color:#475569;font-size:12.5px;line-height:1.55;">${s.d}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`).join("")}
      </table>

      <!-- How it works — timeline -->
      <p style="margin:0 0 14px;color:#0F172A;font-weight:700;font-size:17px;letter-spacing:-0.01em;">How it works</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:12px;">
        ${[
          { n: "1", t: "Kick-off call", d: "30 min. We scope programme, headcount, timing." },
          { n: "2", t: "Upload your roster", d: "Employees get a 2-minute consent-first signup." },
          { n: "3", t: "Measurement day", d: "Our nurse visits on-site." },
          { n: "4", t: "Blood test at partner lab", d: "Walk-in during work hours." },
          { n: "5", t: "Report + doctor consultation", d: "Personal action plan delivered." },
        ].map((s, i, arr) => `
        <tr>
          <td style="padding:0;vertical-align:top;width:40px;">
            <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#3B82F6,#10B981);color:white;text-align:center;line-height:30px;font-weight:700;font-size:13px;">${s.n}</div>
            ${i < arr.length - 1 ? '<div style="width:2px;height:28px;background:#E2E8F0;margin:2px auto 0;"></div>' : ''}
          </td>
          <td style="padding:2px 0 ${i < arr.length - 1 ? '18px' : '0'} 14px;vertical-align:top;">
            <div style="font-weight:600;color:#0F172A;font-size:14px;">${s.t}</div>
            <div style="color:#64748B;font-size:12.5px;margin-top:2px;line-height:1.5;">${s.d}</div>
          </td>
        </tr>`).join("")}
      </table>
      <p style="margin:16px 0 28px;color:#475569;font-size:13px;font-style:italic;text-align:center;background:#F8FAFC;border-radius:8px;padding:10px 16px;">
        From kick-off to employee action plans in weeks, not quarters.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 16px;">
        <a href="${signupUrl}" style="display:inline-block;padding:15px 36px;background:linear-gradient(135deg,#3B82F6,#10B981);color:white;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 4px 12px rgba(16,185,129,0.25);">Start a company workspace →</a>
      </div>
      <p style="text-align:center;margin:0 0 28px;color:#64748B;font-size:12.5px;">
        Takes about two minutes · No payment required to set up<br/>
        <a href="${infoUrl}" style="color:#3B82F6;text-decoration:none;font-weight:500;">See the full programme overview →</a>
      </p>

      <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0 20px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td style="vertical-align:middle;padding-right:16px;width:110px;">
            <img src="${logoUrl}" alt="Lifeline Health" width="100" style="display:block;height:auto;max-width:100px;opacity:0.75;" />
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0 0 3px;color:#64748B;font-size:12.5px;">Questions? Hit reply — a real person reads everything.</p>
            <p style="margin:0;color:#94A3B8;font-size:11.5px;">— ${escapeHtml(signoff)} · Lifeline Health ehf. · kt. 590925-1440 · Þrastarási 71, 221 Hafnarfjörður</p>
          </td>
        </tr>
      </table>
    </div>
  </div>
</body></html>`;
  return { text, html, subject: `Lifeline Health for your workplace — a 2-minute intro` };
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
