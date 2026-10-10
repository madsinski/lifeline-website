// The coach's side of the thread.
//
// hc_chat had a participant writing into it and nobody reading, which made
// the Þjálfari page a one-way outbox dressed as a conversation. This is the
// other end: who is waiting, what they said, and a reply.
//
// Actor: workstation session or Lifeline staff (Bearer + AAL2), and only
// journeys at the actor's own locations — the same gate as the queue.

import { NextRequest, NextResponse, after } from "next/server";
import { sendPush } from "@/lib/hc/push";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

interface Row {
  id: string; journey_id: string; client_id: string;
  author_kind: "client" | "coach"; author_name: string | null;
  kind: "message" | "nudge"; body: string | null; created_at: string;
  read_by_client_at: string | null; read_by_coach_at: string | null;
}

/** Journeys this actor may see, or null for all of them. */
async function allowedJourneys(locs: string[] | null): Promise<Set<string> | null> {
  if (!locs) return null;
  const { data } = await supabaseAdmin.from("hc_journeys").select("id").in("location_id", locs).is("cancelled_at", null);
  return new Set((data ?? []).map((j) => j.id as string));
}

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locs = actorLocationFilter(actor);
  if (locs && locs.length === 0) return NextResponse.json({ threads: [] });
  const allowed = await allowedJourneys(locs);

  const one = req.nextUrl.searchParams.get("journey");

  // ── One thread, in full ─────────────────────────────────────────────
  if (one) {
    if (allowed && !allowed.has(one)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const { data } = await supabaseAdmin.from("hc_chat_decrypted").select("*")
      .eq("journey_id", one).order("created_at", { ascending: true }).limit(300);
    const rows = (data ?? []) as Row[];
    const name = await clientName(rows[0]?.client_id);
    return NextResponse.json({ messages: rows, clientName: name });
  }

  // ── The list: newest first, unanswered first ────────────────────────
  const { data } = await supabaseAdmin.from("hc_chat_decrypted").select("*")
    .order("created_at", { ascending: false }).limit(500);
  const rows = ((data ?? []) as Row[]).filter((r) => !allowed || allowed.has(r.journey_id));

  const byJourney = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byJourney.get(r.journey_id) ?? [];
    list.push(r);
    byJourney.set(r.journey_id, list);
  }
  const names = await clientNames([...new Set(rows.map((r) => r.client_id))]);

  const threads = [...byJourney.entries()].map(([journeyId, list]) => {
    const last = list[0];
    return {
      journeyId, clientId: last.client_id,
      name: names.get(last.client_id) ?? "—",
      last: last.body, lastAt: last.created_at, lastFrom: last.author_kind,
      // Unread for the coach means the person wrote and nobody has opened
      // it since. A reply is what clears it, but opening it does too —
      // otherwise the count argues with the nurse who has read and is
      // thinking.
      unread: list.filter((m) => m.author_kind === "client" && !m.read_by_coach_at).length,
    };
  }).sort((a, b) => (b.unread - a.unread) || (+new Date(b.lastAt) - +new Date(a.lastAt)));

  return NextResponse.json({ threads, unread: threads.reduce((n, t) => n + t.unread, 0) });
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locs = actorLocationFilter(actor);
  const allowed = await allowedJourneys(locs);
  const b = await req.json().catch(() => ({}));
  const journeyId = String(b.journey ?? "");
  if (!journeyId) return NextResponse.json({ error: "no_journey" }, { status: 400 });
  if (allowed && !allowed.has(journeyId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: j } = await supabaseAdmin.from("hc_journeys").select("id, client_id").eq("id", journeyId).maybeSingle();
  if (!j) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (b.seen) {
    await supabaseAdmin.from("hc_chat").update({ read_by_coach_at: new Date().toISOString() })
      .eq("journey_id", journeyId).eq("author_kind", "client").is("read_by_coach_at", null);
    return NextResponse.json({ ok: true });
  }

  const text = typeof b.send === "string" ? b.send.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  // A nudge is the coach writing unprompted; the page shows it differently
  // so it does not read as an answer to something the person asked.
  const kind = b.nudge ? "nudge" : "message";

  const { error } = await supabaseAdmin.from("hc_chat_decrypted").insert({
    journey_id: journeyId, client_id: j.client_id,
    author_kind: "coach",
    author_id: actor.kind === "worker" ? actor.worker.id : actor.staffId,
    author_name: actor.kind === "worker" ? actor.worker.name : actor.label.replace(/\s*\(Lifeline\)$/, ""),
    kind, body: text,
    // Writing a reply is reading the question.
    read_by_coach_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("hc_chat").update({ read_by_coach_at: new Date().toISOString() })
    .eq("journey_id", journeyId).eq("author_kind", "client").is("read_by_coach_at", null);

  /*
   * To the phone as well as the page.
   *
   * The dot and the chime only reach somebody who has the app open. A
   * message from a coach is the one thing in the journey worth a push —
   * it is a person waiting on an answer, not a reminder.
   *
   * after(), because a bare promise is killed when the response returns on
   * Vercel, and a failure here must never fail the send: the message is
   * already written and the notification is a courtesy on top of it.
   */
  const who = actor.kind === "worker" ? actor.worker.name : actor.label.replace(/\s*\(Lifeline\)$/, "");
  after(async () => {
    await sendPush(j.client_id, {
      title: kind === "nudge" ? `Kveðja frá ${who}` : `Skilaboð frá ${who}`,
      // The first line only. A notification is a knock on the door, not the
      // conversation, and a health message does not belong on a lock screen
      // in full.
      body: text.length > 90 ? `${text.slice(0, 90)}…` : text,
      url: "/account/heilsuferd/aaetlun?tab=coach",
      tag: `chat-${journeyId}`,
    }).catch(() => {});
  });
  return NextResponse.json({ ok: true });
}

async function clientNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data } = await supabaseAdmin.from("clients_decrypted").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((c) => [c.id as string, (c.full_name as string | null) ?? "—"]));
}
async function clientName(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  return (await clientNames([id])).get(id) ?? null;
}
