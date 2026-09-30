// Hourly: opt-in reminders to heilsuferð participants, at the hour each chose
// (Iceland = UTC), on the channels they chose (push / email / sms), once a
// day at most. Settings: hc_nudge_prefs (supabase/migration-hc-nudges.sql),
// edited on "Í dag" (components/hc/NudgeSettings). Text: lib/hc/nudge-message.
// Scheduled in vercel.json. Auth: CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { sendSms, smsConfigured } from "@/lib/sms";
import { sendPush } from "@/lib/hc/push";
import { getClientProfile } from "@/lib/hc/server";
import { loadTraining } from "@/lib/hc/training-server";
import { nudgeMessage, type NudgeMode } from "@/lib/hc/nudge-message";
import type { ActionPlan } from "@/lib/hc/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const URL_TODAY = "https://www.lifelinehealth.is/account/heilsuferd/aaetlun?tab=today";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const hour = Number(req.nextUrl.searchParams.get("hour") ?? now.getUTCHours());
  const today = now.toISOString().slice(0, 10);
  const weekday = now.getUTCDay();
  const since = new Date(now.getTime() - 8 * 86400_000).toISOString().slice(0, 10);

  const { data: due } = await supabaseAdmin.from("hc_nudge_prefs").select("*")
    .eq("hour", hour).or(`paused_until.is.null,paused_until.lt.${today}`).or(`last_sent_on.is.null,last_sent_on.lt.${today}`).limit(500);
  const out = { considered: 0, sent: 0, skipped: 0 };

  for (const p of due || []) {
    const channels: string[] = p.channels ?? [];
    if (!channels.length) continue;
    out.considered++;
    // Their current journey and its published plan.
    const { data: j } = await supabaseAdmin.from("hc_journeys").select("id").eq("client_id", p.client_id).is("cancelled_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!j) { out.skipped++; continue; }
    const [{ data: plan }, { data: logs }, { data: prefs }] = await Promise.all([
      supabaseAdmin.from("hc_action_plans").select("modules, exercise, start_date").eq("journey_id", j.id).eq("status", "published").maybeSingle(),
      supabaseAdmin.from("hc_action_logs").select("action_uid, done_on").eq("journey_id", j.id).gte("done_on", since),
      supabaseAdmin.from("hc_action_prefs").select("action_uid, hidden, note").eq("journey_id", j.id),
    ]);
    if (!plan) { out.skipped++; continue; }
    const training = await loadTraining(j.id).catch(() => null);
    const msg = nudgeMessage({
      mode: p.mode as NudgeMode, plan: plan as Pick<ActionPlan, "modules" | "exercise" | "start_date">,
      logs: logs || [], prefs: prefs || [], training, today, weekday,
    });
    if (!msg) { out.skipped++; continue; }

    let delivered = 0;
    if (channels.includes("push")) delivered += await sendPush(p.client_id, { ...msg, url: URL_TODAY, tag: `nudge-${today}` });
    if (channels.includes("email")) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.client_id);
      if (u?.user?.email) {
        const ok = await sendEmail({
          to: u.user.email, subject: msg.title,
          html: renderBrandedEmail({ title: msg.title, bodyHtml: `<p style="margin:0;">${msg.body}</p><p style="margin:16px 0 0;font-size:12px;color:#64748b;">Þú getur breytt eða slökkt á áminningum undir „Í dag“ á heilsuferðinni.</p>`, ctaLabel: "Opna daginn í dag", ctaUrl: URL_TODAY }),
          text: `${msg.body}\n\n${URL_TODAY}\n\nBreyta eða slökkva á áminningum: undir „Í dag“ á heilsuferðinni.`,
        }).then(() => true, () => false);
        if (ok) delivered++;
      }
    }
    if (channels.includes("sms") && smsConfigured()) {
      const profile = await getClientProfile(p.client_id);
      if (profile?.phone) {
        const r = await sendSms({ to: profile.phone, body: `${msg.title}: ${msg.body} ${URL_TODAY}` });
        if (r.ok) delivered++;
      }
    }
    if (delivered) {
      await supabaseAdmin.from("hc_nudge_prefs").update({ last_sent_on: today }).eq("client_id", p.client_id);
      out.sent++;
    } else out.skipped++;
  }
  return NextResponse.json({ ok: true, hour, ...out });
}
