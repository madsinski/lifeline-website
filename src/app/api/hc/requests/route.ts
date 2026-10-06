// The participant asks the coach for something.
//
// GET  → their own requests, newest first, with any reply.
// POST { kind, detail?, body? } → a new one, status 'open'.
// PATCH { id, status: 'cancelled' } → withdraw one they have not had answered.
//
// Schema: supabase/migration-hc-requests.sql. body and reply are encrypted
// at column level; written through hc_requests_decrypted.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";
import { MEASUREMENTS, MEETING_WAYS, isKind } from "@/lib/hc/requests";

export const runtime = "nodejs";

/** Four open requests is already more than a coach can act on at once. */
const MAX_OPEN = 4;

const mine = async (journeyId: string) => {
  const { data } = await supabaseAdmin
    .from("hc_requests_decrypted")
    .select("id, kind, detail, body, status, reply, replied_by, replied_at, created_at")
    .eq("journey_id", journeyId)
    .order("created_at", { ascending: false })
    .limit(40);
  return data || [];
};

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "Engin heilsuferð fannst." }, { status: 404 });
  return NextResponse.json({ requests: await mine(journey.id) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "Engin heilsuferð fannst." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  if (!isKind(b.kind)) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const open = (await mine(journey.id)).filter((r) => r.status === "open" || r.status === "in_progress");
  if (open.length >= MAX_OPEN) {
    return NextResponse.json({ error: "Þú ert með fjórar beiðnir í vinnslu. Við svörum þeim fyrst." }, { status: 429 });
  }

  // Only the choices we offered — a detail object is not a free-form store.
  const detail: Record<string, unknown> = {};
  if (b.kind === "measurement") {
    const want = Array.isArray(b.detail?.measurements) ? b.detail.measurements : [];
    detail.measurements = want.filter((k: unknown) => MEASUREMENTS.some((m) => m.key === k)).slice(0, 5);
  }
  if (b.kind === "appointment" && MEETING_WAYS.some((w) => w.key === b.detail?.way)) detail.way = b.detail.way;
  if (b.kind === "program" && ["exercise", "nutrition", "sleep", "mental"].includes(b.detail?.pillar)) detail.pillar = b.detail.pillar;

  const body = typeof b.body === "string" && b.body.trim() ? b.body.trim().slice(0, 2000) : null;

  const { error } = await supabaseAdmin.from("hc_requests_decrypted").insert({
    journey_id: journey.id, client_id: user.id, kind: b.kind, detail, body, status: "open",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await hcAudit(user.id, "request_new", journey.id, { kind: b.kind });
  return NextResponse.json({ requests: await mine(journey.id) });
}

export async function PATCH(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "Engin heilsuferð fannst." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  if (typeof b.id !== "string" || b.status !== "cancelled") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  // Only their own, and only one nobody has answered yet.
  const { data: row } = await supabaseAdmin
    .from("hc_requests_decrypted")
    .select("id, kind, detail, body, status, reply, replied_by, replied_at")
    .eq("id", b.id).eq("journey_id", journey.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.status !== "open") return NextResponse.json({ error: "Þessari beiðni er þegar svarað." }, { status: 409 });

  const { error } = await supabaseAdmin.from("hc_requests_decrypted")
    .update({ ...row, status: "cancelled" }).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ requests: await mine(journey.id) });
}
