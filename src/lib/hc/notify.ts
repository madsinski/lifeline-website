// Reaching a participant from staff: push and SMS, as they chose.
//
// "Tilkynningar frá Lifeline" (hc_notify_prefs, set under Stillingar) says
// which channels a person wants for messages and requests from staff. No row
// means everything on. The in-app notification (the red dot) is not a channel
// here: it is drawn from the data itself by /api/hc/notifications, always.
//
// Server only. Schema: supabase/migration-hc-notify-prefs.sql

import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPush } from "@/lib/hc/push";
import { sendSms, smsConfigured } from "@/lib/sms";
import { renderBrandedEmail, sendEmail } from "@/lib/email";

export interface NotifyPrefs { push: boolean; sms: boolean; email: boolean }
export const DEFAULT_NOTIFY: NotifyPrefs = { push: true, sms: true, email: true };

export async function getNotifyPrefs(clientId: string): Promise<NotifyPrefs> {
  const { data, error } = await supabaseAdmin.from("hc_notify_prefs").select("push, sms, email").eq("client_id", clientId).maybeSingle();
  if (error || !data) return DEFAULT_NOTIFY;
  return { push: data.push !== false, sms: data.sms !== false, email: data.email !== false };
}

/**
 * Push + SMS to one participant. `sms` is the full text message; keep it
 * free of health details (it sits on a lock screen and at the carrier).
 */
export async function notifyClient(clientId: string, msg: { title: string; body: string; url: string; tag: string; sms?: string; email?: { subject: string; text: string; cta?: { label: string; url: string } } }) {
  const prefs = await getNotifyPrefs(clientId);
  const pushed = prefs.push ? await sendPush(clientId, { title: msg.title, body: msg.body, url: msg.url, tag: msg.tag }, { purpose: "message" }).catch(() => 0) : 0;
  let texted = false;
  if (prefs.sms && msg.sms && smsConfigured()) {
    const { data: c } = await supabaseAdmin.from("clients_decrypted").select("phone").eq("id", clientId).maybeSingle();
    if (c?.phone) texted = (await sendSms({ to: c.phone, body: msg.sms }).catch(() => ({ ok: false }))).ok;
  }
  let emailed = false;
  if (prefs.email && msg.email) {
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(clientId);
    if (au?.user?.email) {
      const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
      emailed = (await sendEmail({
        to: au.user.email, subject: msg.email.subject, text: msg.email.text,
        html: renderBrandedEmail({
          title: msg.email.subject, bodyHtml: `<p style="margin:0;">${esc(msg.email.text)}</p>`,
          ...(msg.email.cta ? { ctaLabel: msg.email.cta.label, ctaUrl: msg.email.cta.url } : {}),
        }),
      }).catch(() => ({ ok: false }))).ok;
    }
  }
  return { pushed, texted, emailed, prefs };
}
