// Everything waiting for the person, in one list.
//
// GET  → { items[], unread }
// POST { seen: true } → mark the unread ones read.
//
// "Unread" means something actually arrived and has not been looked at: a
// message from the coach, a kveðja from the félagi, a report waiting to be
// confirmed. An appointment next Tuesday is not unread — it is just true —
// so it appears in the list without ever lighting the dot. A dot that
// cannot be cleared is a dot people learn to ignore.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, requireUser } from "@/lib/hc/server";
import { parseAppointment } from "@/lib/app/appointment-date";

export const runtime = "nodejs";

export type NoteKind = "coach" | "partner" | "appointment" | "report" | "retention";

export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  body: string | null;
  at: string;
  /** Counts toward the dot. */
  unread: boolean;
  href: string | null;
  /** How many messages this row stands for, when it stands for several. */
  count?: number;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);

  const [{ data: convo }, { data: peer }, { data: appts }, { data: reports }, { data: chat }] = await Promise.all([
    supabaseAdmin.from("conversations").select("id, coach_name")
      .eq("client_id", user.id).eq("archived", false)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("peer_messages")
      .select("id, sender_id, content, read, created_at")
      .eq("receiver_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("appointments")
      .select("id, type, date, time, station_name, coach_name, video_room_url")
      .eq("client_id", user.id).eq("status", "booked"),
    journey
      ? supabaseAdmin.from("hc_reports")
          .select("id, report_date, approval_requested_at, approval_requested_by, client_approved_at, retention_asked_at")
          .eq("journey_id", journey.id).order("created_at", { ascending: false }).limit(3)
      : Promise.resolve({ data: [] }),
    /*
     * hc_chat — the coach conversation on Þjálfari.
     *
     * This list read `messages_decrypted` only, which is the older app
     * conversation. A coach writing from the workstation writes to hc_chat,
     * so the message arrived, sat unread, and lit nothing: no dot in the
     * navbar, nothing on the lightning bolt. The bell had the animation and
     * the chime all along and was never given a number above zero.
     */
    journey
      ? supabaseAdmin.from("hc_chat_decrypted")
          .select("id, author_kind, author_name, body, created_at, read_by_client_at")
          .eq("journey_id", journey.id).eq("author_kind", "coach")
          .order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  // Coach messages: anything they sent that is still unread.
  const { data: coachMsgs } = convo
    ? await supabaseAdmin.from("messages_decrypted")
        .select("id, sender_id, sender_name, content, read, created_at")
        .eq("conversation_id", convo.id).neq("sender_id", user.id)
        .order("created_at", { ascending: false }).limit(20)
    : { data: [] };

  // Names for whoever sent a kveðja.
  const senderIds = Array.from(new Set((peer ?? []).map((m) => m.sender_id as string)));
  const names = new Map<string, string>();
  if (senderIds.length) {
    const { data: who } = await supabaseAdmin.from("clients").select("id, full_name").in("id", senderIds);
    for (const x of who ?? []) names.set(x.id as string, (x.full_name as string) ?? "—");
  }

  const items: Note[] = [];

  /*
   * One row per coach, not one per message.
   *
   * Three replies in a row produced three identical-looking entries, which
   * pushed everything else off the list and read as three events when it
   * was one conversation. The row carries the newest message, the count,
   * and goes unread if any of them is — because the thing you do about it
   * is the same either way: open the conversation.
   *
   * Both sources collapse together. The coach is one person whether they
   * wrote from the older app conversation or from the workstation, and the
   * distinction is ours, not theirs.
   */
  const fromCoach: { who: string; body: string | null; at: string; unread: boolean; id: string }[] = [];
  for (const m of coachMsgs ?? []) {
    fromCoach.push({
      who: (m.sender_name as string) ?? "þjálfara", body: (m.content as string) ?? null,
      at: m.created_at as string, unread: !m.read, id: `coach:${m.id}`,
    });
  }
  for (const m of (chat ?? []) as Record<string, string | null>[]) {
    fromCoach.push({
      who: m.author_name ?? "þjálfara", body: m.body ?? null,
      at: m.created_at as string, unread: !m.read_by_client_at, id: `chat:${m.id}`,
    });
  }

  const byCoach = new Map<string, typeof fromCoach>();
  for (const m of fromCoach) {
    const g = byCoach.get(m.who);
    if (g) g.push(m); else byCoach.set(m.who, [m]);
  }
  for (const [who, group] of byCoach) {
    group.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const newest = group[0];
    items.push({
      // The newest message's id, so the row changes identity when a new one
      // lands and anything keyed on it re-renders.
      id: newest.id, kind: "coach",
      title: `Skilaboð frá ${who}`,
      body: newest.body,
      at: newest.at,
      unread: group.some((m) => m.unread),
      count: group.length,
      href: "/account/heilsuferd/aaetlun?tab=coach",
    });
  }

  for (const m of peer ?? []) {
    items.push({
      id: `partner:${m.id}`, kind: "partner",
      title: names.get(m.sender_id as string) ?? "Félagi",
      body: (m.content as string) ?? null,
      at: m.created_at as string, unread: !m.read,
      href: "/account/heilsuferd/aaetlun?tab=today",
    });
  }

  const now = Date.now();
  for (const a of appts ?? []) {
    const at = parseAppointment(a.date, a.time);
    if (!at || at.getTime() < now) continue;
    items.push({
      id: `appt:${a.id}`, kind: "appointment",
      title: a.type === "consultation" ? "Samtal við þjálfara"
        : a.type === "measurement" ? "Mælingatími"
        : a.type === "blood-test" ? "Blóðprufa" : "Tími",
      body: (a.station_name as string) ?? (a.coach_name as string) ?? null,
      at: at.toISOString(),
      // A booking is not news; it is a fact about next week.
      unread: false,
      href: (a.video_room_url as string) ?? "/account/heilsuferd/aaetlun?tab=today",
    });
  }

  for (const r of reports ?? []) {
    if (r.approval_requested_at && !r.client_approved_at) {
      items.push({
        id: `report:${r.id}`, kind: "report",
        title: "Skýrsla bíður staðfestingar",
        body: `${(r.approval_requested_by as string) ?? "Starfsmaður"} setti hana inn fyrir þig.`,
        at: r.approval_requested_at as string, unread: true,
        href: "/account/heilsuferd",
      });
    } else if (r.retention_asked_at && r.client_approved_at) {
      items.push({
        id: `retention:${r.id}`, kind: "retention",
        title: "Viltu halda skýrslunni þinni?",
        body: "Við spyrjum einu sinni á ári.",
        at: r.retention_asked_at as string, unread: true,
        href: "/account/heilsuferd",
      });
    }
  }

  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return NextResponse.json({ items, unread: items.filter((i) => i.unread).length });
}

/** Opening the list clears the dot. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { data: convo } = await supabaseAdmin.from("conversations")
    .select("id").eq("client_id", user.id).eq("archived", false)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const journey = await currentJourney(user.id);

  await Promise.all([
    supabaseAdmin.from("peer_messages").update({ read: true })
      .eq("receiver_id", user.id).eq("read", false),
    // The coach conversation. Without this the dot would light and never
    // clear, which is worse than not lighting at all.
    journey
      ? supabaseAdmin.from("hc_chat").update({ read_by_client_at: new Date().toISOString() })
          .eq("journey_id", journey.id).eq("author_kind", "coach").is("read_by_client_at", null)
      : Promise.resolve(null),
    convo
      ? supabaseAdmin.from("messages_decrypted").update({ read: true })
          .eq("conversation_id", convo.id).neq("sender_id", user.id).eq("read", false)
      : Promise.resolve(null),
  ]);
  // Reports waiting on an answer stay unread on purpose: they are not
  // cleared by being seen, only by being answered.
  return NextResponse.json({ ok: true });
}
