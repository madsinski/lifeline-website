// Calendar items derived from journeys — the single source for both the
// Google push sync (calendar-sync.ts) and the .ics feeds, so the two can
// never disagree. Server-only.
//
// Client: their own blood test, measurements, interview and follow-up.
// Worker: the interviews and follow-ups assigned to them (interviewer_id).
// Worker events carry initials only — a calendar entry at a health service is
// health information, and it lives in a third party's calendar.

import { FASTING_IS, MEASURE_IS } from "./logistics";
import { MEASURE_IS as MEASURE_LABELS, MEASURE_PREP } from "./appointment-kinds";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sanitizeActivities } from "./adaptive-program";

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
   * An RRULE for things that happen every week — training that is pinned to
   * a place and an hour. One recurring event beats a hundred copies, and it
   * is what a calendar is for.
   */
  recurrence?: string[];
  /**
   * Ask Google to mint a Meet link for this event and write it back to the
   * journey. Set only on the interviewer's own copy: the same interview is on
   * the client's calendar too, and two calendars asking would make two
   * conferences for one conversation.
   */
  wantsMeet?: boolean;
  /** Which journey to write the link onto, when wantsMeet is set. */
  journeyId?: string;
  /** Which journey column holds this appointment's link. */
  meetField?: "meeting_url" | "followup_meeting_url";
  /**
   * A booking that owns its own link, instead of a column on the journey.
   *
   * The journey has one meeting_url because an intake interview happens
   * once. A monthly video consultation happens again next month, so its
   * link belongs to the booking row.
   */
  meetBookingId?: string;
  /**
   * The participant's email, invited as a guest on the interviewer's video
   * appointment: Google then sends them the invitation with the Meet link,
   * whether or not they connected a calendar of their own.
   */
  inviteEmail?: string | null;
}

type Kind = "blood" | "measure" | "interview" | "followup";
// Suffixes restricted to base32hex so Google accepts the id as-is.
const SUFFIX: Record<Kind, string> = { blood: "a0", measure: "a1", interview: "a2", followup: "a3" };
export const itemId = (journeyId: string, kind: Kind) => `${journeyId.replace(/-/g, "")}${SUFFIX[kind]}`;

/**
 * The same, for a weekly training commitment.
 *
 * Activity ids are base36 and Google only accepts base32hex (0-9, a-v) in an
 * event id, so the id is hashed to hex — every character of which is legal —
 * rather than passed through and rejected.
 */
export const activityItemId = (journeyId: string, activityId: string) =>
  `${journeyId.replace(/-/g, "")}b${createHash("sha1").update(activityId).digest("hex").slice(0, 10)}`;

const JOURNEY_COLS = "id, client_id, location_id, interviewer_id, blood_test_booked_for, blood_test_done_at, measurements_booked_for, measurements_done_at, interview_booked_for, interview_mode, interview_done_at, meeting_url, followup_booked_for, followup_done_at, followup_mode, followup_meeting_url";

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
      description: `${FASTING_IS}\n\nhttps://www.lifelinehealth.is/account/heilsuferd`,
      location: place(loc?.blood_test_site, loc?.blood_test_address), reminderMinutes: 12 * 60,
    });
    if (recent(j.measurements_booked_for)) out.push({
      id: itemId(j.id, "measure"), start: j.measurements_booked_for!, minutes: 30,
      summary: "Mælingar – Lifeline heilsufarsskoðun",
      description: `${MEASURE_IS}\n\nhttps://www.lifelinehealth.is/account/heilsuferd`,
      location: place(loc?.measurement_site, loc?.measurement_address), reminderMinutes: 120,
    });
    if (recent(j.interview_booked_for)) out.push({
      id: itemId(j.id, "interview"), start: j.interview_booked_for!, minutes: 45,
      summary: "Viðtal við hjúkrunarfræðing – Lifeline",
      description: `${j.interview_mode === "video" ? (j.meeting_url ? `Myndsímtal: ${j.meeting_url}` : "Myndsímtal. Hlekkurinn birtist á aðganginum þínum.") : "Farið yfir niðurstöður og gerð aðgerðaáætlun."}\n\nhttps://www.lifelinehealth.is/account/heilsuferd`,
      location: j.interview_mode === "video" ? (j.meeting_url ?? "Myndsímtal") : place(loc?.interview_site, loc?.interview_address), reminderMinutes: 120,
    });
    if (recent(j.followup_booked_for)) {
      const video = j.followup_mode === "video";
      out.push({
        id: itemId(j.id, "followup"), start: j.followup_booked_for!, minutes: 30,
        summary: "Eftirfylgdarviðtal – Lifeline",
        description: `Farið yfir árangur og áætlunin uppfærð.${video ? (j.followup_meeting_url ? `\n\nMyndsímtal: ${j.followup_meeting_url}` : "\n\nMyndsímtal. Hlekkurinn birtist á aðganginum þínum.") : ""}\n\nhttps://www.lifelinehealth.is/account/heilsuferd`,
        location: video ? (j.followup_meeting_url ?? "Myndsímtal") : place(loc?.interview_site, loc?.interview_address), reminderMinutes: 120,
      });
    }
  }
  // The repeatable coach bookings. No wantsMeet here: the coach's copy is
  // the one that asks, or the same call gets two conferences.
  for (const b of await bookings("client", clientId)) {
    out.push(bookingItem(b, false, null, null, locs.get(journeyLocationId(b) ?? "")));
  }

  return out;
}

function initials(name: string | null | undefined): string {
  const parts = (name || "").replace(/^Prufa\s*[–-]\s*/, "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.map((p) => p[0]!.toUpperCase() + ".").join(" ") : "—";
}

const BOOKING_IS: Record<string, { label: string; what: string }> = {
  video: { label: "Myndsímtal við þjálfara", what: "Myndsímtal: farið yfir vikuna, áætlunina og það sem stendur í vegi." },
  measurement: { label: "Mælingar", what: "Líkamssamsetning og blóðþrýstingur." },
  vo2max: { label: "Þrekpróf (VO₂max)", what: "Þolpróf á hjóli eða bretti. Komdu í æfingafötum." },
  strength: { label: "Styrkmæling", what: "Grip- og fótstyrkur." },
};

interface BookingRow {
  id: string; journey_id: string; client_id: string; coach_id: string | null;
  kind: string; starts_at: string; minutes: number; meeting_url: string | null; note: string | null;
  /** What is being measured, for a measurement booking. */
  items: string[] | null;
  /** Joined from the journey, for the site address. Supabase hands a
   *  to-one embed back as an object or a one-element array depending on
   *  how it infers the relationship, so both shapes are accepted. */
  journey?: { location_id: string | null } | { location_id: string | null }[] | null;
}

/**
 * The repeatable bookings with a coach: video consultations and the
 * measurements people come back for.
 *
 * These live in hc_bookings rather than on the journey, which carries one
 * slot each for the steps that happen once. Both calendars show them; only
 * the coach's copy asks Google for a Meet link, because the same call is on
 * both and two asks would make two conferences for one conversation.
 */
async function bookings(where: "client" | "coach", id: string): Promise<BookingRow[]> {
  const q = supabaseAdmin.from("hc_bookings")
    .select("id, journey_id, client_id, coach_id, kind, starts_at, minutes, meeting_url, note, items, journey:hc_journeys(location_id)")
    .neq("status", "cancelled")
    .gte("starts_at", windowStart())
    .order("starts_at");
  const { data } = await (where === "client" ? q.eq("client_id", id) : q.eq("coach_id", id));
  return (data ?? []) as unknown as BookingRow[];
}

/**
 * A coach booking as a calendar entry.
 *
 * The description used to be a fixed sentence per kind and the location the
 * literal string "Lifeline", so a measurement in Google Calendar said
 * nothing about what was being measured, where to go, or what to bring —
 * while the same booking in the app said all three. Everything the sheet
 * shows goes in here, because the calendar is where people actually look
 * the evening before.
 */
/** The journey's location id, whichever shape the embed came back as. */
function journeyLocationId(b: BookingRow): string | null {
  const j = b.journey;
  if (!j) return null;
  return Array.isArray(j) ? j[0]?.location_id ?? null : j.location_id ?? null;
}

function bookingItem(
  b: BookingRow, forCoach: boolean, who: string | null, guestEmail: string | null,
  loc?: Record<string, string | null> | null,
): CalItem {
  const t = BOOKING_IS[b.kind] ?? { label: "Tími hjá Lifeline", what: "" };
  const video = b.kind === "video";
  const items = b.items ?? [];

  // "Líkamssamsetning + blóðþrýstingur" rather than a generic sentence.
  const what = !video && items.length
    ? items.map((k) => MEASURE_LABELS[k]?.label ?? k).join(" + ")
    : t.what;

  // What to bring and what shifts the reading, from the same source the
  // app's booking sheet uses.
  const prep = video ? [] : Array.from(new Set(items.flatMap((k) => MEASURE_PREP[k] ?? [])));

  const site = video ? null : place(loc?.measurement_site, loc?.measurement_address);

  return {
    id: `b${b.id.replace(/-/g, "").slice(0, 24)}`,
    start: b.starts_at, minutes: b.minutes,
    summary: forCoach && who ? `${t.label} – ${who}` : `Lifeline – ${t.label}`,
    description: [
      what,
      prep.length ? `\nGott að vita:\n${prep.map((x) => `• ${x}`).join("\n")}` : null,
      site ? `\nStaðsetning: ${site}` : null,
      loc?.measurement_info && !video ? `\n${loc.measurement_info}` : null,
      b.note,
      b.meeting_url ? `\nMyndsímtal: ${b.meeting_url}` : null,
      "\nhttps://www.lifelinehealth.is/account/heilsuferd/aaetlun?tab=coach",
    ].filter(Boolean).join("\n"),
    location: video ? (b.meeting_url ?? "Myndsímtal") : (site ?? "Lifeline"),
    reminderMinutes: 30,
    // Only the coach hosts, and only while there is no link yet.
    wantsMeet: forCoach && video && !b.meeting_url,
    journeyId: b.journey_id,
    meetBookingId: b.id,
    inviteEmail: forCoach && video ? guestEmail : null,
  };
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
  // Emails of participants with an upcoming video appointment, to invite them.
  const emails = new Map<string, string | null>();
  for (const j of journeys || []) {
    const video = (j.interview_mode === "video" && recent(j.interview_booked_for) && !j.interview_done_at)
      || (j.followup_mode === "video" && recent(j.followup_booked_for) && !j.followup_done_at);
    if (video && !emails.has(j.client_id)) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(j.client_id);
      emails.set(j.client_id, data?.user?.email ?? null);
    }
  }
  const out: CalItem[] = [];
  for (const j of journeys || []) {
    const who = initials(names.get(j.client_id));
    const loc = locs.get(j.location_id ?? "");
    const link = "https://www.lifelinehealth.is/vinnustod";
    // A video appointment is shared with the participant (they are the
    // guest), so its text is written for both of them.
    if (recent(j.interview_booked_for)) {
      const video = j.interview_mode === "video";
      out.push({
        id: itemId(j.id, "interview"), start: j.interview_booked_for!, minutes: 45,
        summary: video ? "Lifeline Health – viðtal (myndsímtal)" : `Lifeline viðtal – ${who}`,
        description: video
          ? `Viðtal við hjúkrunarfræðing: farið yfir niðurstöður heilsufarsskoðunar og gerð aðgerðaáætlun.${j.meeting_url ? `\nMyndsímtal: ${j.meeting_url}` : ""}`
          : `Heilsufarsskoðun: viðtal og aðgerðaáætlun.\nOpnaðu skjólstæðinginn í vinnustöðinni: ${link}`,
        location: video ? (j.meeting_url ?? "Myndsímtal") : place(loc?.interview_site, loc?.interview_address), reminderMinutes: 30,
        // The interviewer hosts, so their calendar is the one that asks.
        wantsMeet: video && !j.meeting_url,
        journeyId: j.id, meetField: "meeting_url",
        inviteEmail: video && !j.interview_done_at ? emails.get(j.client_id) ?? null : null,
      });
    }
    if (recent(j.followup_booked_for)) {
      const video = j.followup_mode === "video";
      out.push({
        id: itemId(j.id, "followup"), start: j.followup_booked_for!, minutes: 30,
        summary: video ? "Lifeline Health – eftirfylgd (myndsímtal)" : `Lifeline eftirfylgd – ${who}`,
        description: video
          ? `Eftirfylgdarviðtal: farið yfir árangur og áætlunin uppfærð.${j.followup_meeting_url ? `\nMyndsímtal: ${j.followup_meeting_url}` : ""}`
          : `Eftirfylgdarviðtal eftir 3 mánuði.\n${link}`,
        location: video ? (j.followup_meeting_url ?? "Myndsímtal") : place(loc?.interview_site, loc?.interview_address), reminderMinutes: 30,
        wantsMeet: video && !j.followup_meeting_url,
        journeyId: j.id, meetField: "followup_meeting_url",
        inviteEmail: video && !j.followup_done_at ? emails.get(j.client_id) ?? null : null,
      });
    }
  }
  // Where this worker is the coach rather than the interviewer.
  const mine = await bookings("coach", workerId);
  if (mine.length) {
    const extra = Array.from(new Set(mine.map((b) => b.client_id)));
    const { data: more } = await supabaseAdmin.from("clients_decrypted").select("id, full_name").in("id", extra);
    const names = new Map((more ?? []).map((c) => [c.id as string, c.full_name as string | null]));
    for (const b of mine) {
      out.push(bookingItem(b, true, names.get(b.client_id) ?? null, emails.get(b.client_id) ?? null));
    }
  }

  return out;
}

/**
 * Training that belongs in a calendar.
 *
 * Not the whole plan. A Zone 2 session is "sometime on Wednesday, wherever
 * you like" and putting it in someone's calendar at an invented hour is
 * noise they will mute the whole feed over. What earns a slot is the
 * intersection of the two things a calendar is actually for: being somewhere
 * specific, at a specific time. That is exactly the weekly commitments they
 * have given an hour to — CrossFit at 16:30, football at 12:00 — so those
 * sync, as one weekly recurring event each, and nothing else does.
 */
export async function trainingCommitments(clientId: string): Promise<CalItem[]> {
  const { data: journeys, error } = await supabaseAdmin
    .from("hc_journeys").select("id").eq("client_id", clientId).is("cancelled_at", null);
  if (error) throw new Error(error.message);
  const ids = (journeys ?? []).map((j) => j.id);
  if (!ids.length) return [];

  const { data, error: sErr } = await supabaseAdmin
    .from("hc_training_settings").select("journey_id, activities").in("journey_id", ids);
  if (sErr) throw new Error(sErr.message);

  // Monday-first 0–6 → the RRULE day codes.
  const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const out: CalItem[] = [];
  for (const row of data ?? []) {
    const acts = sanitizeActivities((row as { activities: unknown }).activities);
    for (const a of acts) {
      if (!a.at) continue; // no hour means no calendar slot
      out.push({
        id: activityItemId(String((row as { journey_id: string }).journey_id), a.id),
        start: nextOccurrence(a.day, a.at),
        minutes: a.minutes ?? 60,
        summary: a.name,
        description: "Úr æfingaáætluninni þinni hjá Lifeline.\n\nhttps://www.lifelinehealth.is/account/heilsuferd/aaetlun?tab=exercise",
        location: null,
        reminderMinutes: 60,
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[a.day]}`],
      });
    }
  }
  return out;
}

/** The coming (or today's, if still ahead) instance of a weekly slot. */
function nextOccurrence(weekday: number, at: string): string {
  const [h, m] = at.split(":").map(Number);
  const now = new Date();
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  const todayIdx = (now.getDay() + 6) % 7;
  let delta = (weekday - todayIdx + 7) % 7;
  if (delta === 0 && d.getTime() < now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString();
}
