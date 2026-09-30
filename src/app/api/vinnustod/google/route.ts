// Workstation user's Google Calendar connection: status, pause/resume + sync now, disconnect.
// Worker (cookie) or Lifeline staff (Bearer, through the linked hc_workers row).

import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { disconnect, purgeEvents, statusFor, syncOwner } from "@/lib/hc/calendar-sync";
import { calendarWorker } from "@/lib/hc/ws-auth";
import { sameOrigin } from "@/lib/hc/secrets";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const me = await calendarWorker(req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await statusFor("worker", me.id));
}

export async function PATCH(req: Request) {
  const me = await calendarWorker(req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (me.cookie && !sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.sync) return NextResponse.json({ result: await syncOwner("worker", me.id), ...(await statusFor("worker", me.id)) });
  const enabled = Boolean(b.enabled);
  await supabaseAdmin.from("hc_google_sync").update({ enabled }).eq("owner_kind", "worker").eq("owner_id", me.id);
  after(async () => {
    if (enabled) await syncOwner("worker", me.id);
    else await purgeEvents("worker", me.id).catch(() => {});
  });
  return NextResponse.json({ enabled });
}

export async function DELETE(req: Request) {
  const me = await calendarWorker(req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (me.cookie && !sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await disconnect("worker", me.id);
  return NextResponse.json({ ok: true });
}
