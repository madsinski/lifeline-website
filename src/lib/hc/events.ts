// Journey events — the single place a clinical/logistic milestone is
// recorded. Called by the patient-portal partner API (/api/hc/partner/event)
// and by the workstation (/api/vinnustod/journeys/[id]). Server-only.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { patchJourney } from "./server";
import type { HcJourney } from "./types";

export { JOURNEY_EVENTS, EVENT_LABELS, DOCTOR_ONLY, isJourneyEvent, type JourneyEvent } from "./events-labels";
import type { JourneyEvent } from "./events-labels";

export async function applyJourneyEvent(
  journey: HcJourney,
  event: JourneyEvent,
  opts: { at?: string | null; actor: string; mode?: "in_person" | "video" | null; note?: string | null; interviewerId?: string | null; meetingUrl?: string | null; origin?: string },
): Promise<HcJourney | null> {
  const at = opts.at ? new Date(opts.at).toISOString() : new Date().toISOString();
  const patch: Partial<HcJourney> = {};
  switch (event) {
    case "protocol_activated": patch.protocol_activated_at = at; break;
    case "blood_test_booked": patch.blood_test_booked_for = at; break;
    case "blood_test_done": patch.blood_test_done_at = at; break;
    case "blood_results_ready":
      patch.blood_results_at = at;
      if (!journey.blood_test_done_at) patch.blood_test_done_at = at;
      break;
    case "measurements_booked": patch.measurements_booked_for = at; break;
    case "measurements_done": patch.measurements_done_at = at; break;
    case "report_generated":
      patch.report_generated_at = at;
      patch.report_generated_by = opts.actor;
      break;
    case "interview_booked":
      patch.interview_booked_for = at;
      patch.interview_mode = opts.mode ?? "in_person";
      if (opts.interviewerId) patch.interviewer_id = opts.interviewerId;
      // A video appointment keeps its link unless a new one is given (null
      // clears it so Google mints a fresh one); in person drops it.
      if (opts.mode === "video") { if (opts.meetingUrl !== undefined) patch.meeting_url = opts.meetingUrl; }
      else patch.meeting_url = null;
      break;
    case "interview_done":
      patch.interview_done_at = at;
      if (opts.interviewerId && !journey.interviewer_id) patch.interviewer_id = opts.interviewerId;
      break;
    case "referral_heilsugaesla":
      patch.referral_to_heilsugaesla = true;
      patch.referral_note = opts.note ?? null;
      patch.referred_at = at;
      break;
    case "followup_booked":
      patch.followup_booked_for = at;
      patch.followup_mode = opts.mode ?? journey.followup_mode ?? journey.interview_mode ?? "in_person";
      if (patch.followup_mode === "video") { if (opts.meetingUrl !== undefined) patch.followup_meeting_url = opts.meetingUrl; }
      else patch.followup_meeting_url = null;
      if (opts.interviewerId && !journey.interviewer_id) patch.interviewer_id = opts.interviewerId;
      break;
    case "followup_done": patch.followup_done_at = at; break;
  }
  const updated = await patchJourney(journey.id, patch, opts.actor, `event:${event}`, { note: opts.note ?? null });
  if (updated) await notifyClient(updated, event, opts.origin);
  return updated;
}

const WD = ["sunnudaginn", "mánudaginn", "þriðjudaginn", "miðvikudaginn", "fimmtudaginn", "föstudaginn", "laugardaginn"];
const MO = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
/** "fimmtudaginn 2. október kl. 10:30" in Iceland's time zone (UTC, no DST). Written by hand. */
export function whenIs(iso: string): string {
  const d = new Date(iso);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()}. ${MO[d.getUTCMonth()]} kl. ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function bookingMessage(j: HcJourney, kind: "interview" | "followup"): { title: string; body: string } | null {
  const at = kind === "interview" ? j.interview_booked_for : j.followup_booked_for;
  if (!at || new Date(at).getTime() < Date.now()) return null;
  const video = (kind === "interview" ? j.interview_mode : j.followup_mode) === "video";
  const link = kind === "interview" ? j.meeting_url : j.followup_meeting_url;
  const what = kind === "interview" ? "Viðtalið þitt við hjúkrunarfræðing" : "Eftirfylgdarviðtalið þitt";
  return {
    title: kind === "interview" ? "Viðtalið þitt er bókað" : "Eftirfylgdarviðtal bókað",
    body: `${what} er ${whenIs(at)}. ` + (video
      ? (link
        ? `Það fer fram í myndsímtali. Þú tengist með hlekknum á heilsuferðinni þinni eða beint: ${link}`
        : "Það fer fram í myndsímtali. Hlekkurinn birtist á heilsuferðinni þinni fyrir viðtalið.")
      : "Það fer fram á staðnum. Heimilisfangið er á heilsuferðinni þinni."),
  };
}

/** Nudges the customer when the next step is theirs. Best effort. */
async function notifyClient(j: HcJourney, event: JourneyEvent, origin = "https://www.lifelinehealth.is") {
  const messages: Partial<Record<JourneyEvent, { title: string; body: string } | null>> = {
    interview_booked: bookingMessage(j, "interview"),
    followup_booked: bookingMessage(j, "followup"),
    report_generated: {
      title: "Skýrslan þín er tilbúin",
      body: "Læknir hefur staðfest skýrsluna þína. Næsta skref er viðtal við hjúkrunarfræðing þar sem þið farið yfir niðurstöðurnar og gerið áætlun. Bókaðu viðtalið í sjúklingagáttinni.",
    },
    interview_done: {
      title: "Takk fyrir viðtalið",
      body: "Aðgerðaáætlunin þín birtist á aðganginum um leið og hjúkrunarfræðingurinn hefur gengið frá henni.",
    },
  };
  const m = messages[event];
  if (!m) return;
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(j.client_id);
  const email = u?.user?.email;
  if (!email) return;
  await sendEmail({
    to: email,
    subject: m.title,
    html: renderBrandedEmail({ title: m.title, bodyHtml: `<p style="margin:0;">${m.body}</p>`, ctaLabel: "Opna heilsuferðina", ctaUrl: `${origin}/account/heilsuferd` }),
    text: `${m.body}\n\n${origin}/account/heilsuferd`,
  }).catch(() => {});
}
