// What participants are asking for, for the workstation queue.
//
// GET  ?status=open → the open ones at this actor's locations, oldest first,
//                     because the person who waited longest should be next.
// POST { id, status?, reply? } → pick one up, answer it, close it.
//
// Actor: workstation session or Lifeline staff, limited to their locations —
// the same gate the rest of /api/vinnustod uses.
// Schema: supabase/migration-hc-requests.sql.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

const STATUS = ["open", "in_progress", "done", "cancelled"];

/** Journeys this actor may see, and the names to show against them. */
async function visible(locs: string[] | null) {
  let q = supabaseAdmin.from("hc_journeys").select("id, client_id, location_id");
  if (locs) q = q.in("location_id", locs);
  const { data } = await q;
  return new Map((data ?? []).map((j) => [j.id as string, j]));
}

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locs = actorLocationFilter(actor);
  const journeys = await visible(locs);
  if (!journeys.size) return NextResponse.json({ requests: [] });

  const status = req.nextUrl.searchParams.get("status");
  let q = supabaseAdmin.from("hc_requests_decrypted")
    .select("id, journey_id, client_id, kind, detail, body, status, reply, replied_by, replied_at, created_at")
    .in("journey_id", [...journeys.keys()])
    .order("created_at", { ascending: true })
    .limit(200);
  q = status && STATUS.includes(status) ? q.eq("status", status) : q.in("status", ["open", "in_progress"]);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Names come from clients_decrypted, as everywhere else in the workstation.
  const ids = [...new Set((data ?? []).map((r) => r.client_id as string))];
  const { data: people } = ids.length
    ? await supabaseAdmin.from("clients_decrypted").select("id, name").in("id", ids)
    : { data: [] as { id: string; name: string | null }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.name]));

  return NextResponse.json({
    requests: (data ?? []).map((r) => ({ ...r, name: nameOf.get(r.client_id as string) ?? null })),
  });
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.id !== "string") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: row } = await supabaseAdmin.from("hc_requests_decrypted")
    .select("id, journey_id, kind, detail, body, status, reply, replied_by, replied_at")
    .eq("id", b.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const journeys = await visible(actorLocationFilter(actor));
  if (!journeys.has(row.journey_id as string)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const status = STATUS.includes(b.status) ? b.status : row.status;
  const reply = typeof b.reply === "string" && b.reply.trim() ? b.reply.trim().slice(0, 4000) : row.reply;
  const answered = reply && reply !== row.reply;

  const { error } = await supabaseAdmin.from("hc_requests_decrypted").update({
    ...row, status, reply,
    replied_by: answered ? actor.label : row.replied_by,
    replied_at: answered ? new Date().toISOString() : row.replied_at,
  }).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
