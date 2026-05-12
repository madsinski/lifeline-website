// POST /api/ai/log-user-action
//
// Updates ai_recommendation_log.user_action so we can measure
// acceptance rate per recommendation type. Called by the RN app
// when the user picks a mode / accepts a meal / overrides an
// action ranking.
//
// Valid actions: 'accepted' | 'overridden' | 'feedback_filed' | 'no_action'
//
// Auth: caller's auth.uid must match the log row's client_id, OR
// caller must be admin staff. Service-role write — no client UPDATE
// policy on ai_recommendation_log by design.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 15;

const requestSchema = z.object({
  log_id: z.string().uuid(),
  action: z.enum(["accepted", "overridden", "feedback_filed", "no_action"]),
});

function authToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 });
  }
  const { log_id, action } = parsed.data;

  const token = authToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!userData.user) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

  // Ownership check: load the row, confirm client_id matches OR caller is admin.
  const { data: row } = await supabaseAdmin
    .from("ai_recommendation_log")
    .select("client_id")
    .eq("id", log_id)
    .maybeSingle();
  if (!row) return NextResponse.json({ ok: false, error: "log_id not found" }, { status: 404 });

  let allowed = (row as { client_id: string }).client_id === userData.user.id;
  if (!allowed && userData.user.email) {
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("role, active")
      .eq("email", userData.user.email)
      .maybeSingle();
    allowed = !!(staff?.active && staff.role === "admin");
  }
  if (!allowed) return NextResponse.json({ ok: false, error: "Not authorised to update this log row" }, { status: 403 });

  const { error: updErr } = await supabaseAdmin
    .from("ai_recommendation_log")
    .update({ user_action: action })
    .eq("id", log_id);
  if (updErr) {
    Sentry.captureException(updErr, { tags: { route: "/api/ai/log-user-action" } });
    return NextResponse.json({ ok: false, error: `Update failed: ${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
