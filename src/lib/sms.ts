// SMS via Twilio — ported from Fjarlaekningar/src/lib/sms.ts. The sender is a
// name ("Lifeline"), not a number.
//
// Degrades gracefully: without TWILIO keys the message is logged and ok is
// returned, so nothing breaks before the keys are in Vercel.
//
// Icelandic letters (á ð þ í ó ú ý æ ö) are outside GSM-7, which forces
// UCS-2 and 70 chars per segment. Doctor alerts are therefore written in
// ASCII-safe Icelandic where it reads naturally.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

/** Max 11 ASCII characters — an SMS standard rule. */
export const SMS_SENDER = (process.env.SMS_SENDER_ID || "Lifeline").slice(0, 11);

export const smsConfigured = () => Boolean(ACCOUNT_SID && (API_KEY_SECRET || AUTH_TOKEN));

/** Icelandic number → E.164. Seven digits get +354. */
export function toE164(raw: string): string | null {
  const trimmed = (raw || "").trim();
  const plus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "").replace(/^00/, "");
  if (!digits) return null;
  if (!plus) {
    if (digits.length === 7) return `+354${digits}`;
    if (digits.length === 10 && digits.startsWith("354")) return `+${digits}`;
    return null;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

export interface SendSmsResult {
  ok: boolean;
  sid?: string;
  status?: string;
  error?: string;
  code?: number;
  dryRun?: boolean;
}

export async function sendSms(opts: { to: string; body: string }): Promise<SendSmsResult> {
  const to = toE164(opts.to);
  if (!to) return { ok: false, error: "Ógilt símanúmer" };
  if (!opts.body.trim()) return { ok: false, error: "Skeytið er tómt" };

  if (!smsConfigured()) {
    console.warn(`[sms] TWILIO keys missing — logging instead of sending:\n  to: ${to}\n  from: ${SMS_SENDER}\n  ${opts.body}`);
    return { ok: true, status: "dry-run", dryRun: true };
  }

  const form = new URLSearchParams({ To: to, From: SMS_SENDER, Body: opts.body });
  const user = API_KEY_SECRET ? API_KEY_SID! : ACCOUNT_SID!;
  const pass = API_KEY_SECRET ?? AUTH_TOKEN!;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const j = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string; code?: number };
    if (!res.ok) return { ok: false, error: j.message || "Sending failed", code: j.code };
    return { ok: true, sid: j.sid, status: j.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
