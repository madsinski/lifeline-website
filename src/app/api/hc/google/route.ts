// Customer's Google Calendar connection: status, pause/resume + sync now, disconnect.

import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { disconnect, purgeEvents, statusFor, syncOwner } from "@/lib/hc/calendar-sync";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await statusFor("client", user.id));
}

/** { enabled } toggles; { sync: true } syncs now and returns the result. */
export async function PATCH(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));
  if (b.sync) return NextResponse.json({ result: await syncOwner("client", user.id), ...(await statusFor("client", user.id)) });
  const enabled = Boolean(b.enabled);
  await supabaseAdmin.from("hc_google_sync").update({ enabled }).eq("owner_kind", "client").eq("owner_id", user.id);
  after(async () => {
    // Paused: empty the calendar rather than freezing stale appointments in it.
    if (enabled) await syncOwner("client", user.id);
    else await purgeEvents("client", user.id).catch(() => {});
  });
  return NextResponse.json({ enabled });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  await disconnect("client", user.id);
  return NextResponse.json({ ok: true });
}
