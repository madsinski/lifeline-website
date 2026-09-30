// Web Push to a participant's devices (hc_push_subscriptions). VAPID keys are
// NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT. Gone
// endpoints (404/410) are removed. Server-only.

import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-admin";

let ready = false;
export function pushConfigured(): boolean {
  if (ready) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@lifelinehealth.is", pub, priv);
  ready = true;
  return true;
}

export interface PushPayload { title: string; body: string; url?: string; tag?: string }

/** Send to every device of this participant; returns how many accepted it. */
export async function sendPush(clientId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  const { data: subs } = await supabaseAdmin.from("hc_push_subscriptions").select("id, endpoint, p256dh, auth").eq("client_id", clientId);
  let ok = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "normal" });
      ok++;
      await supabaseAdmin.from("hc_push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await supabaseAdmin.from("hc_push_subscriptions").delete().eq("id", s.id);
    }
  }
  return ok;
}
