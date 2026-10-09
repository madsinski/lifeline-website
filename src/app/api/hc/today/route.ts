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

/** Days with at least one action logged, out of the last n. */
async function activeDays(journeyId: string | null, clientId: string, n: number) {
  if (!journeyId) return 0;
  const { data } = await supabaseAdmin
    .from("hc_action_logs").select("done_on")
    .eq("journey_id", journeyId).gte("done_on", iso(daysAgo(n - 1)));
  void clientId;
  return new Set((data ?? []).map((r) => String(r.done_on))).size;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  const jid = journey?.id ?? null;

  const [d7, d28, me, { data: appts }, { data: nudges }, { data: logs }] = await Promise.all([
    activeDays(jid, user.id, 7),
    activeDays(jid, user.id, 28),
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
    supabaseAdmin.from("hc_action_logs").select("done_on")
      .eq("journey_id", jid ?? "00000000-0000-0000-0000-000000000000")
      .gte("done_on", iso(daysAgo(60))),
  ]);

  // Current run of consecutive days ending today or yesterday. Yesterday
  // counts so the number does not read as broken before the day's first tick.
  const done = new Set((logs ?? []).map((r) => String(r.done_on)));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const day = iso(daysAgo(i));
    if (done.has(day)) streak++;
    else if (i > 0) break;
  }

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

  const partnerId = me?.accountability_partner_id as string | undefined;
  const partnerName = me?.accountability_partner_name as string | undefined;
  let partnerDays: number | null = null;
  if (partnerId || partnerName) {
    const { data: pj } = partnerId
      ? await supabaseAdmin.from("hc_journeys").select("id").eq("client_id", partnerId).is("cancelled_at", null).limit(1)
      : { data: null };
    if (pj?.[0]) partnerDays = await activeDays(pj[0].id as string, partnerId!, 14);
  }

  return NextResponse.json({
    stats: {
      days7: d7, days28: d28, streak,
      // The share of the last 28 days with something done. A percentage of
      // days is honest in a way "% of actions" is not: it does not punish a
      // person for having a long plan.
      percent28: Math.round((d28 / 28) * 100),
    },
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
      ? { id: partnerId ?? null, name: partnerName, days: partnerDays, of: 14, canNudge: Boolean(partnerId) }
      : null,
    me: { days: await activeDays(jid, user.id, 14), of: 14 },
  });
}

/** Poke the partner. One a day — a nudge that can be spammed is noise. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { data: me } = await supabaseAdmin
    .from("clients").select("full_name, accountability_partner_id").eq("id", user.id).maybeSingle();
  const partnerId = me?.accountability_partner_id as string | undefined;
  if (!partnerId) return NextResponse.json({ error: "no-partner" }, { status: 400 });

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
    content: `${(me?.full_name as string) ?? "Félagi þinn"} sendir þér hvatningu 💪`,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await hcAudit(`self:${user.id}`, "partner_nudged", null, { partner: partnerId });
  return NextResponse.json({ ok: true });
}
