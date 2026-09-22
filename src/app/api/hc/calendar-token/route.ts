// Personal calendar subscription for the journey (blood test, measurements,
// interview, follow-up). POST → { https, webcal, google }. The link itself is
// the credential, like the HSU shift feed; POST { rotate: true } revokes it.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { newToken } from "@/lib/hc/secrets";
import { requireUser, siteOrigin } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => ({}));
  const { data: existing } = await supabaseAdmin.from("account_calendar_feeds").select("token").eq("user_id", user.id).maybeSingle();
  let token = existing?.token as string | undefined;
  if (!token || body.rotate) {
    token = newToken(24);
    await supabaseAdmin.from("account_calendar_feeds").upsert({ user_id: user.id, token, created_at: new Date().toISOString() }, { onConflict: "user_id" });
  }
  const https = `${siteOrigin(req)}/api/hc/calendar/${token}.ics`;
  const webcal = https.replace(/^https?:/, "webcal:");
  return NextResponse.json({
    https,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  await supabaseAdmin.from("account_calendar_feeds").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
