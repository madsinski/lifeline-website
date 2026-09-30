// The participant's upcoming appointments, from the journey row. Pure and
// client-safe: the hub, the "Í dag" screen and the plan API all use it, so
// every screen shows the same next appointment and the same join link.

import type { HcJourney, HcLocation } from "./types";

export interface Upcoming {
  kind: "blood" | "measure" | "interview" | "followup";
  title: string;
  at: string;
  minutes: number;
  video: boolean;
  /** Meeting link for a video appointment, once it exists. */
  link: string | null;
  place: string | null;
  note: string | null;
}

type J = Pick<HcJourney, "blood_test_booked_for" | "blood_test_done_at" | "blood_results_at" | "measurements_booked_for" | "measurements_done_at"
  | "interview_booked_for" | "interview_done_at" | "meeting_url" | "followup_booked_for" | "followup_done_at" | "followup_meeting_url">
  & { interview_mode: string | null; followup_mode?: string | null };

const place = (site?: string | null, addr?: string | null) => [site, addr].filter(Boolean).join(", ") || null;

/** Appointments not done yet, from an hour ago on, soonest first. */
export function upcomingAppointments(j: J, loc: Partial<Pick<HcLocation, "blood_test_site" | "blood_test_address" | "measurement_site" | "measurement_address" | "interview_site" | "interview_address">> | null, now = Date.now()): Upcoming[] {
  const out: Upcoming[] = [];
  const live = (at: string | null, minutes: number) => !!at && new Date(at).getTime() + minutes * 60_000 > now - 60 * 60_000;
  if (live(j.blood_test_booked_for, 20) && !(j.blood_test_done_at || j.blood_results_at)) out.push({
    kind: "blood", title: "Blóðprufa", at: j.blood_test_booked_for!, minutes: 20, video: false, link: null,
    place: place(loc?.blood_test_site, loc?.blood_test_address), note: "Mættu fastandi. Vatn er í lagi.",
  });
  if (live(j.measurements_booked_for, 30) && !j.measurements_done_at) out.push({
    kind: "measure", title: "Mælingar", at: j.measurements_booked_for!, minutes: 30, video: false, link: null,
    place: place(loc?.measurement_site, loc?.measurement_address), note: "Léttur klæðnaður, ekkert málmskart.",
  });
  if (live(j.interview_booked_for, 45) && !j.interview_done_at) {
    const video = j.interview_mode === "video";
    out.push({
      kind: "interview", title: "Viðtal við hjúkrunarfræðing", at: j.interview_booked_for!, minutes: 45, video,
      link: video ? j.meeting_url : null, place: video ? null : place(loc?.interview_site, loc?.interview_address),
      note: "Þið farið yfir niðurstöðurnar og gerið áætlunina þína saman.",
    });
  }
  if (live(j.followup_booked_for, 30) && !j.followup_done_at) {
    const video = (j.followup_mode ?? j.interview_mode) === "video";
    out.push({
      kind: "followup", title: "Eftirfylgdarviðtal", at: j.followup_booked_for!, minutes: 30, video,
      link: video ? j.followup_meeting_url ?? null : null, place: video ? null : place(loc?.interview_site, loc?.interview_address),
      note: "Farið yfir hvernig gengur og áætlunin uppfærð.",
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
