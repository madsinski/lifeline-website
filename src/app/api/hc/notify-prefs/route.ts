// "Tilkynningar frá Lifeline" — the participant's own channel choices for
// messages and requests from staff. GET → prefs; POST { push?, sms?, email? }.
// Schema: supabase/migration-hc-notify-prefs.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";
import { getNotifyPrefs } from "@/lib/hc/notify";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const [prefs, { count }, { data: c }] = await Promise.all([
    getNotifyPrefs(user.id),
    supabaseAdmin.from("hc_push_subscriptions").select("id", { count: "exact", head: true }).eq("client_id", user.id),
    supabaseAdmin.from("clients_decrypted").select("phone").eq("id", user.id).maybeSingle(),
  ]);
  return NextResponse.json({ prefs, devices: count ?? 0, has_phone: !!c?.phone });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));
  const cur = await getNotifyPrefs(user.id);
  const next = {
    push: typeof b.push === "boolean" ? b.push : cur.push,
    sms: typeof b.sms === "boolean" ? b.sms : cur.sms,
    email: typeof b.email === "boolean" ? b.email : cur.email,
  };
  const { error } = await supabaseAdmin.from("hc_notify_prefs")
    .upsert({ client_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: "client_id" });
  if (error) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 500 });
  return NextResponse.json({ prefs: next });
}
