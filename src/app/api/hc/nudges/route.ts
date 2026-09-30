// The participant's own reminder settings (opt-in).
// GET  → { prefs, available: { push, email, sms }, devices }
// POST { channels: ("push"|"email"|"sms")[], hour, mode, paused_until? }
// Sent by /api/cron/hc-nudges. Schema: supabase/migration-hc-nudges.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getClientProfile, hcAudit, requireUser } from "@/lib/hc/server";
import { pushConfigured } from "@/lib/hc/push";
import { smsConfigured } from "@/lib/sms";

export const runtime = "nodejs";

const CHANNELS = ["push", "email", "sms"] as const;
const MODES = ["daily", "behind", "weekly"] as const;

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const [{ data: prefs }, { count }, profile] = await Promise.all([
    supabaseAdmin.from("hc_nudge_prefs").select("channels, hour, mode, paused_until").eq("client_id", user.id).maybeSingle(),
    supabaseAdmin.from("hc_push_subscriptions").select("id", { count: "exact", head: true }).eq("client_id", user.id),
    getClientProfile(user.id),
  ]);
  return NextResponse.json({
    prefs: prefs ?? { channels: [], hour: 8, mode: "daily", paused_until: null },
    available: { push: pushConfigured(), email: !!user.email, sms: smsConfigured() && !!profile?.phone },
    devices: count ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));
  const channels = [...new Set((Array.isArray(b.channels) ? b.channels : []).filter((c: unknown): c is (typeof CHANNELS)[number] => (CHANNELS as readonly unknown[]).includes(c)))];
  const hour = Math.max(5, Math.min(22, Math.round(Number(b.hour) || 8)));
  const mode = (MODES as readonly unknown[]).includes(b.mode) ? b.mode : "daily";
  const paused_until = typeof b.paused_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.paused_until) ? b.paused_until : null;
  const { error } = await supabaseAdmin.from("hc_nudge_prefs").upsert(
    { client_id: user.id, channels, hour, mode, paused_until, updated_at: new Date().toISOString() },
    { onConflict: "client_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await hcAudit(`client:${user.id}`, "nudge_prefs", null, { channels, hour, mode, paused_until });
  return NextResponse.json({ prefs: { channels, hour, mode, paused_until } });
}
