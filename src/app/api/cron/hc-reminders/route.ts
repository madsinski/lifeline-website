// Hourly: automatic emails to heilsuferð participants. One of each, ever
// (the *_reminded_at / *_invited_at stamps on hc_journeys,
// supabase/migration-hc-followup-video.sql).
//
//   • interview / follow-up tomorrow → time, place or video link
//   • three months after the plan (plan review_date) with no follow-up booked
//     → invitation to book the follow-up
//   • a month before reevaluation_due_at → the re-evaluation is coming up
//
// Scheduled in vercel.json. Auth: CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { hcAudit } from "@/lib/hc/server";
import { whenIs } from "@/lib/hc/events";

export const runtime = "nodejs";

const ORIGIN = "https://www.lifelinehealth.is";
const H = 3600_000;

async function emailOf(clientId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(clientId);
  return data?.user?.email ?? null;
}

async function send(clientId: string, title: string, body: string, path = "/account/heilsuferd"): Promise<boolean> {
  const to = await emailOf(clientId);
  if (!to) return false;
  const r = await sendEmail({
    to, subject: title,
    html: renderBrandedEmail({ title, bodyHtml: `<p style="margin:0;">${body}</p>`, ctaLabel: "Opna heilsuferðina", ctaUrl: `${ORIGIN}${path}` }),
    text: `${body}\n\n${ORIGIN}${path}`,
  }).then(() => true, () => false);
  return r;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = Date.now();
  const soon = new Date(now + 26 * H).toISOString();   // "tomorrow", with an hour of slack each side
  const notYet = new Date(now + 2 * H).toISOString();  // too close: they already know
  const sent: Record<string, number> = { interview: 0, followup: 0, invite: 0, reeval: 0 };

  // ── Appointment tomorrow ──
  for (const kind of ["interview", "followup"] as const) {
    const at = `${kind}_booked_for`, done = `${kind}_done_at`, stamp = `${kind}_reminded_at`;
    const { data } = await supabaseAdmin.from("hc_journeys")
      .select(`id, client_id, ${at}, interview_mode, meeting_url, followup_mode, followup_meeting_url`)
      .gte(at, notYet).lte(at, soon).is(done, null).is(stamp, null).is("cancelled_at", null).limit(100);
    for (const j of (data || []) as unknown as Record<string, string | null>[]) {
      const when = whenIs(j[at]!);
      const video = (kind === "interview" ? j.interview_mode : j.followup_mode ?? j.interview_mode) === "video";
      const link = kind === "interview" ? j.meeting_url : j.followup_meeting_url;
      const what = kind === "interview" ? "Viðtalið þitt við hjúkrunarfræðing" : "Eftirfylgdarviðtalið þitt";
      const body = `${what} er ${when}. ` + (video
        ? `Það fer fram í myndsímtali.${link ? ` Þú tengist hér: ${link}` : " Hlekkurinn er á heilsuferðinni þinni."} Gott er að vera á rólegum stað með heyrnartól.`
        : "Það fer fram á staðnum. Heimilisfangið er á heilsuferðinni þinni.");
      if (await send(j.client_id!, kind === "interview" ? "Áminning: viðtal á morgun" : "Áminning: eftirfylgd á morgun", body)) {
        await supabaseAdmin.from("hc_journeys").update({ [stamp]: new Date().toISOString() }).eq("id", j.id!);
        await hcAudit("system", `${kind}_reminder_sent`, j.id!);
        sent[kind]++;
      }
    }
  }

  // ── Three months after the plan: book the follow-up ──
  const today = new Date(now).toISOString().slice(0, 10);
  const { data: plans } = await supabaseAdmin.from("hc_action_plans")
    .select("journey_id, client_id, review_date").eq("status", "published").lte("review_date", today).limit(200);
  const ids = (plans || []).map((p) => p.journey_id);
  if (ids.length) {
    const { data: js } = await supabaseAdmin.from("hc_journeys")
      .select("id, client_id").in("id", ids).is("followup_booked_for", null).is("followup_done_at", null)
      .is("followup_invited_at", null).is("cancelled_at", null);
    for (const j of js || []) {
      const body = "Þrír mánuðir eru liðnir frá því að áætlunin þín var gerð. Í eftirfylgdarviðtali farið þið hjúkrunarfræðingurinn yfir hvernig gengur og uppfærið áætlunina. Hjúkrunarfræðingurinn hefur samband til að finna tíma, eða þú svarar þessum pósti.";
      if (await send(j.client_id, "Tími fyrir eftirfylgd", body, "/account/heilsuferd/aaetlun")) {
        await supabaseAdmin.from("hc_journeys").update({ followup_invited_at: new Date().toISOString() }).eq("id", j.id);
        await hcAudit("system", "followup_invite_sent", j.id);
        sent.invite++;
      }
    }
  }

  // ── A month before the re-evaluation ──
  const month = new Date(now + 30 * 24 * H).toISOString();
  const { data: re } = await supabaseAdmin.from("hc_journeys")
    .select("id, client_id, reevaluation_due_at").lte("reevaluation_due_at", month)
    .is("reevaluation_reminded_at", null).is("cancelled_at", null).limit(100);
  for (const j of re || []) {
    const body = "Brátt er ár liðið frá heilsufarsskoðuninni þinni. Endurmat sýnir hvernig mælingarnar hafa þróast og hvort áætlunin skilar sér. Þú getur bókað endurmatið á heilsuferðinni þinni.";
    if (await send(j.client_id, "Endurmat nálgast", body)) {
      await supabaseAdmin.from("hc_journeys").update({ reevaluation_reminded_at: new Date().toISOString() }).eq("id", j.id);
      await hcAudit("system", "reevaluation_reminder_sent", j.id);
      sent.reeval++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
