// Calendar items derived from journeys — the single source for both the
// Google push sync (calendar-sync.ts) and the .ics feeds, so the two can
// never disagree. Server-only.
//
// Client: their own blood test, measurements, interview and follow-up.
// Worker: the interviews and follow-ups assigned to them (interviewer_id).
// Worker events carry initials only — a calendar entry at a health service is
// health information, and it lives in a third party's calendar.

import { supabaseAdmin } from "@/lib/supabase-admin";

export interface CalItem {
  /** Stable, Google-safe id (base32hex: 0-9 a-v), derived from journey + kind. */
  id: string;
  start: string;
  minutes: number;
  summary: string;
  description: string;
  location: string | null;
  reminderMinutes: number | null;
  /**
   * Ask Google to mint a Meet link for this event and write it back to the
   * journey. Set only on the interviewer's own copy: the same interview is on
   * the client's calendar too, and two calendars asking would make two
   * conferences for one conversation.
   */
  wantsMeet?: boolean;
  /** Which journey to write the link onto, when wantsMeet is set. */
  journeyId?: string;
}

type Kind = "blood" | "measure" | "interview" | "followup";
// Suffixes restricted to base32hex so Google accepts the id as-is.
const SUFFIX: Record<Kind, string> = { blood: "a0", measure: "a1", interview: "a2", followup: "a3" };
export const itemId = (journeyId: string, kind: Kind) => `${journeyId.replace(/-/g, "")}${SUFFIX[kind]}`;

const JOURNEY_COLS = "id, client_id, location_id, interviewer_id, blood_test_booked_for, blood_test_done_at, measurements_booked_for, measurements_done_at, interview_booked_for, interview_mode, interview_done_at, meeting_url, followup_booked_for, followup_done_at";

/** How far back events are kept; older ones are history and are left alone. */
const WINDOW_BACK_DAYS = 30;
export const windowStart = () => new Date(Date.now() - WINDOW_BACK_DAYS * 86400_000).toISOString();

async function locations(ids: (string | null)[]) {
  const uniq = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (!uniq.length) return new Map<string, Record<string, string | null>>();
  const { data } = await supabaseAdmin.from("hc_locations").select("*").in("id", uniq);
  return new Map((data || []).map((l) => [l.id as string, l as Record<string, string | null>]));
}
const place = (site?: string | null, addr?: string | null) => [site, addr].filter(Boolean).join(", ") || null;
const recent = (iso: string | null) => !!iso && iso >= windowStart();

export async function clientAppointments(clientId: string): Promise<CalItem[]> {
  const { data: journeys, error } = await supabaseAdmin
    .from("hc_journeys").select(JOURNEY_COLS).eq("client_id", clientId).is("cancelled_at", null);
  // A failed read must never look like "no appointments" — that would wipe the calendar.
  if (error) throw new Error(error.message);
  const locs = await locations((journeys || []).map((j) => j.location_id));
  const out: CalItem[] = [];
  for (const j of journeys || []) {
    const loc = locs.get(j.location_id ?? "");
    if (recent(j.blood_test_booked_for)) out.push({
      id: itemId(j.id, "blood"), start: j.blood_test_booked_for!, minutes: 20,
      summary: "Blóðprufa – Lifeline heilsufarsskoðun",
      description: "Mættu fastandi frá miðnætti. Vatn er í lagi.\n\nhttps://www.lifelinehealth.is/account/heilsuferd",
      location: place(loc?.blood_test_site, loc?.blood_test_address), reminderMinutes: 12 * 60,
    });
    if (recent(j.measurements_booked_for)) out.push({
      id: itemId(j.id, "measure"), start: j.measurements_booked_for!, minutes: 30,
      summary: "Mælingar – Lifeline heilsufarsskoðun",
      description: "Léttur klæðnaður, ekkert málmskart eða úr.\n\nhttps://www.lifelinehealth.is/account/heilsuferd",
      location: place(loc?.measurement_site, loc?.measurement_address), reminderMinutes: 120,
    });
    if (recent(j.interview_booked_for)) out.push({
      id: itemId(j.id, "interview"), start: j.interview_booked_for!, minutes: 45,
      summary: "Viðtal við hjúkrunarfræðing – Lifeline",
      description: `${j.interview_mode === "video" ? (j.meeting_url ? `Myndsímtal: ${j.meeting_url}` : "Myndsímtal. Hlekkurinn birtist á aðganginum þínum.") : "Farið yfir niðurstöður og gerð aðgerðaáætlun."}\n\nhttps://www.lifelinehealth.is/account/heilsuferd`,
      location: j.interview_mode === "video" ? (j.meeting_url ?? "Myndsímtal") : place(loc?.interview_site, loc?.interview_address), reminderMinutes: 120,
    });
    if (recent(j.followup_booked_for)) out.push({
      id: itemId(j.id, "followup"), start: j.followup_booked_for!, minutes: 30,
      summary: "Eftirfylgdarviðtal – Lifeline",
      description: `Farið yfir árangur og áætlunin uppfærð.${j.meeting_url ? `\n\nMyndsímtal: ${j.meeting_url}` : ""}\n\nhttps://www.lifelinehealth.is/account/heilsuferd`,
      location: place(loc?.interview_site, loc?.interview_address), reminderMinutes: 120,
    });
  }
  return out;
}

function initials(name: string | null | undefined): string {
  const parts = (name || "").replace(/^Prufa\s*[–-]\s*/, "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.map((p) => p[0]!.toUpperCase() + ".").join(" ") : "—";
}

export async function workerAppointments(workerId: string): Promise<CalItem[]> {
  const { data: journeys, error } = await supabaseAdmin
    .from("hc_journeys").select(JOURNEY_COLS).eq("interviewer_id", workerId).is("cancelled_at", null);
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((journeys || []).map((j) => j.client_id)));
  const names = new Map<string, string | null>();
  if (ids.length) {
    const { data } = await supabaseAdmin.from("clients_decrypted").select("id, full_name").in("id", ids);
    for (const c of data || []) names.set(c.id, c.full_name);
  }
  const locs = await locations((journeys || []).map((j) => j.location_id));
  const out: CalItem[] = [];
  for (const j of journeys || []) {
    const who = initials(names.get(j.client_id));
    const loc = locs.get(j.location_id ?? "");
    const link = "https://www.lifelinehealth.is/vinnustod";
    if (recent(j.interview_booked_for)) out.push({
      id: itemId(j.id, "interview"), start: j.interview_booked_for!, minutes: 45,
      summary: `Lifeline viðtal – ${who}${j.interview_mode === "video" ? " (myndsímtal)" : ""}`,
      description: `Heilsufarsskoðun: viðtal og aðgerðaáætlun.${j.meeting_url ? `\nMyndsímtal: ${j.meeting_url}` : ""}\nOpnaðu skjólstæðinginn í vinnustöðinni: ${link}`,
      location: j.interview_mode === "video" ? (j.meeting_url ?? "Myndsímtal") : place(loc?.interview_site, loc?.interview_address), reminderMinutes: 30,
      // The interviewer hosts, so their calendar is the one that asks.
      wantsMeet: j.interview_mode === "video" && !j.meeting_url,
      journeyId: j.id,
    });
    if (recent(j.followup_booked_for)) out.push({
      id: itemId(j.id, "followup"), start: j.followup_booked_for!, minutes: 30,
      summary: `Lifeline eftirfylgd – ${who}`,
      description: `Eftirfylgdarviðtal eftir 3 mánuði.\n${link}`,
      location: place(loc?.interview_site, loc?.interview_address), reminderMinutes: 30,
    });
  }
  return out;
}
