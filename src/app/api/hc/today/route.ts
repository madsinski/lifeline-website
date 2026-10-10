// What Í dag needs above the checklist: how you are doing, what is urgent,
// and the partner — in one request, because three cards at the top of the
// daily page should not be three round trips.
//
// GET  → { stats, urgent[], partner }
// POST { nudge: true } → poke your accountability partner.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";
import { parseAppointment } from "@/lib/app/appointment-date";

export const runtime = "nodejs";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

/**
 * The same three numbers for whoever is asked about.
 *
 * One function for both people on purpose: the point of putting your row
 * above your partner's is that they can be compared, which only holds if
 * they are measured identically. Two call sites computing "days active"
 * slightly differently would make the comparison a lie.
 */
async function stats(journeyId: string | null) {
  if (!journeyId) return null;
  const { data } = await supabaseAdmin
    .from("hc_action_logs").select("done_on")
    .eq("journey_id", journeyId).gte("done_on", iso(daysAgo(59)));
  const done = new Set((data ?? []).map((r) => String(r.done_on)));
  const within = (n: number) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (done.has(iso(daysAgo(i)))) c++;
    return c;
  };
  // Yesterday still counts, so the streak does not read as broken before
  // the day's first tick.
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    if (done.has(iso(daysAgo(i)))) streak++;
    else if (i > 0) break;
  }
  return { days7: within(7), days14: within(14), days28: within(28), streak };
}

/**
 * What the partner is training today and tomorrow — titles only.
 *
 * The point of an accountability partner is knowing what the other one is
 * meant to be doing, which is why the stats are already shared both ways.
 * Titles and nothing else: no exercises, no weights, no notes. Seeing that
 * somebody has a lift today is the accountability; seeing what they lift is
 * their business.
 */
async function trainingOf(clientId: string): Promise<{ today: string[]; tomorrow: string[] } | null> {
  const { data: j } = await supabaseAdmin.from("hc_journeys")
    .select("id").eq("client_id", clientId).is("cancelled_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!j) return null;
  const { data: ts } = await supabaseAdmin.from("hc_training_settings")
    .select("activities").eq("journey_id", j.id).maybeSingle();
  const acts = Array.isArray(ts?.activities) ? (ts!.activities as { name?: unknown; day?: unknown }[]) : [];
  const dow = (new Date().getDay() + 6) % 7;
  const pick = (d: number) => acts
    .filter((a) => Math.round(Number(a.day)) === d)
    .map((a) => String(a.name ?? "")).filter(Boolean);
  return { today: pick(dow), tomorrow: pick((dow + 1) % 7) };
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  const jid = journey?.id ?? null;

  const [mine, me, { data: appts }, { data: nudges }] = await Promise.all([
    stats(jid),
    supabaseAdmin.from("clients")
      .select("accountability_partner_id, accountability_partner_name").eq("id", user.id).maybeSingle()
      .then((r) => r.data),
    supabaseAdmin.from("appointments")
      .select("type, date, time, station_name, coach_name, status, video_room_url")
      .eq("client_id", user.id).eq("status", "booked"),
    // A nudge from the partner arrives as a peer message.
    supabaseAdmin.from("peer_messages")
      .select("id, sender_id, content, created_at")
      .eq("receiver_id", user.id).eq("read", false)
      .order("created_at", { ascending: false }).limit(5),
  ]);

  // Only what is genuinely ahead: the column is text, so this is parsed.
  const now = Date.now();
  const upcoming = (appts ?? [])
    .map((a) => ({ a, at: parseAppointment(a.date, a.time) }))
    .filter((x): x is { a: typeof x.a; at: Date } => x.at !== null && x.at.getTime() >= now)
    .sort((x, y) => x.at.getTime() - y.at.getTime());

  const names = new Map<string, string>();
  const senderIds = Array.from(new Set((nudges ?? []).map((n) => n.sender_id as string)));
  if (senderIds.length) {
    const { data: who } = await supabaseAdmin.from("clients").select("id, full_name").in("id", senderIds);
    for (const w of who ?? []) names.set(w.id as string, (w.full_name as string) ?? "—");
  }

  /**
   * Resolve the partner by name when there is no id.
   *
   * The app never wrote accountability_partner_id — it sets only the name
   * and a score it leaves at zero. Without resolving, an app-chosen partner
   * can be neither measured nor nudged, which is exactly what Mads' own
   * account showed: "canNudge: false" beside a partner who is right there.
   */
  const partnerName = me?.accountability_partner_name as string | undefined;
  let partnerId = me?.accountability_partner_id as string | undefined;
  if (!partnerId && partnerName) {
    const { data: byName } = await supabaseAdmin
      .from("clients").select("id").eq("full_name", partnerName).limit(2);
    // Only when the name is unambiguous — two members can share one.
    if (byName?.length === 1) partnerId = byName[0].id as string;
  }

  let theirs: Awaited<ReturnType<typeof stats>> = null;
  if (partnerId) {
    const { data: pj } = await supabaseAdmin
      .from("hc_journeys").select("id").eq("client_id", partnerId).is("cancelled_at", null).limit(1);
    if (pj?.[0]) theirs = await stats(pj[0].id as string);
  }

  return NextResponse.json({
    // The share of the last 28 days with something done. A percentage of
    // days is honest in a way "% of actions" is not: it does not punish a
    // person for having a long plan.
    stats: mine ? { ...mine, percent28: Math.round((mine.days28 / 28) * 100) } : null,
    urgent: [
      ...upcoming.slice(0, 2).map((u) => ({
        kind: "appointment" as const,
        at: u.at.toISOString(),
        title: u.a.type === "consultation" ? "Samtal við þjálfara"
          : u.a.type === "measurement" ? "Mælingatími"
          : u.a.type === "blood-test" ? "Blóðprufa" : "Tími",
        detail: (u.a.station_name as string) ?? (u.a.coach_name as string) ?? null,
        href: (u.a.video_room_url as string) ?? null,
      })),
      ...(nudges ?? []).map((n) => ({
        kind: "nudge" as const,
        at: n.created_at as string,
        title: `${names.get(n.sender_id as string) ?? "Félagi"} sendi þér hvatningu`,
        detail: (n.content as string) ?? null,
        href: null as string | null,
      })),
    ],
    partner: partnerName
      ? {
          id: partnerId ?? null, name: partnerName, canNudge: Boolean(partnerId),
          // Same shape as `stats`, so the two rows are the same measures.
          stats: theirs ? { ...theirs, percent28: Math.round((theirs.days28 / 28) * 100) } : null,
          training: partnerId ? await trainingOf(partnerId) : null,
        }
      : null,
  });
}

/**
 * Send the partner something. One a day — a poke that can be spammed stops
 * being encouragement and becomes noise, which is how people mute each
 * other.
 */
export const NUDGES: Record<string, string> = {
  cheer: "sendir þér hvatningu",
  proud: "er stoltur af þér",
  missing: "saknar þín í vikunni",
  together: "stingur upp á því að þið æfið saman",
};
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { data: me } = await supabaseAdmin
    .from("clients")
    .select("full_name, accountability_partner_id, accountability_partner_name")
    .eq("id", user.id).maybeSingle();

  // Same name fallback as the GET, or the button would show and then fail.
  let partnerId = me?.accountability_partner_id as string | undefined;
  if (!partnerId && me?.accountability_partner_name) {
    const { data: byName } = await supabaseAdmin
      .from("clients").select("id").eq("full_name", me.accountability_partner_name as string).limit(2);
    if (byName?.length === 1) partnerId = byName[0].id as string;
  }
  if (!partnerId) return NextResponse.json({ error: "no-partner" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const kind = typeof body?.kind === "string" && NUDGES[body.kind] ? body.kind : "cheer";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 140) : "";

  const { data: recent } = await supabaseAdmin
    .from("peer_messages").select("id")
    .eq("sender_id", user.id).eq("receiver_id", partnerId)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .limit(1);
  if (recent?.length) {
    return NextResponse.json({ error: "already-today", message: "Þú sendir hvatningu í dag." }, { status: 429 });
  }

  const { error } = await supabaseAdmin.from("peer_messages").insert({
    sender_id: user.id, receiver_id: partnerId, read: false,
    content: note
      ? `${(me?.full_name as string) ?? "Félagi þinn"}: ${note}`
      : `${(me?.full_name as string) ?? "Félagi þinn"} ${NUDGES[kind]}`,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await hcAudit(`self:${user.id}`, "partner_nudged", null, { partner: partnerId, kind });
  return NextResponse.json({ ok: true });
}
