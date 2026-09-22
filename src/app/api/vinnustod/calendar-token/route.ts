// Workstation user's personal .ics subscription (Apple / Outlook / other).
// POST → { https, webcal }; { rotate: true } revokes the old link.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { newToken, sameOrigin } from "@/lib/hc/secrets";
import { getWorkerSession } from "@/lib/hc/ws-auth";
import { siteOrigin } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await getWorkerSession();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const { data } = await supabaseAdmin.from("hc_workers").select("calendar_token").eq("id", me.id).single();
  let token = data?.calendar_token as string | null;
  if (!token || b.rotate) {
    token = newToken(24);
    await supabaseAdmin.from("hc_workers").update({ calendar_token: token }).eq("id", me.id);
  }
  const https = `${siteOrigin(req)}/api/vinnustod/calendar/${token}.ics`;
  return NextResponse.json({ https, webcal: https.replace(/^https?:/, "webcal:") });
}
