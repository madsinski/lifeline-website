// A participant's device for Web Push reminders.
// POST { subscription: PushSubscriptionJSON } → register this device
// DELETE { endpoint }                         → forget it

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));
  const s = b.subscription ?? {};
  const endpoint = typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) ? s.endpoint.slice(0, 1000) : null;
  const p256dh = typeof s.keys?.p256dh === "string" ? s.keys.p256dh.slice(0, 200) : null;
  const auth = typeof s.keys?.auth === "string" ? s.keys.auth.slice(0, 100) : null;
  if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: "bad_subscription" }, { status: 400 });
  const { error } = await supabaseAdmin.from("hc_push_subscriptions").upsert(
    { client_id: user.id, endpoint, p256dh, auth, user_agent: (req.headers.get("user-agent") || "").slice(0, 300) },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));
  if (typeof b.endpoint !== "string") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await supabaseAdmin.from("hc_push_subscriptions").delete().eq("client_id", user.id).eq("endpoint", b.endpoint);
  return NextResponse.json({ ok: true });
}
