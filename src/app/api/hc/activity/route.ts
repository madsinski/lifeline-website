// The participant's own last N days: workouts (including what they did
// instead of a prescribed session), meals and habit ticks — "Vikan þín" on
// /app/eg/saga.
// GET ?days=14 (1–60). Auth: the signed-in client, own data only.
// Schema: supabase/migration-session-substitutions.sql

import { NextRequest, NextResponse } from "next/server";
import { currentJourney, requireUser } from "@/lib/hc/server";
import { clampDays, loadActivity } from "@/lib/hc/activity-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const days = clampDays(req.nextUrl.searchParams.get("days"));
  try {
    const journey = await currentJourney(user.id);
    const entries = await loadActivity(user.id, journey?.id ?? null, days);
    return NextResponse.json({ days, entries });
  } catch {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
