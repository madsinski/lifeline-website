// Daily cron — calls public.refresh_user_meters() for every active
// client so consistency_score / completion_score / intensity_score
// don't go stale for users who didn't log an action today.
//
// Without this, scores only update when an action is marked done. A
// user who opens the app at 08:00 with nothing logged yet sees
// yesterday's percentages — which causes the Home hero tile and AI
// coach narrative to feel oddly out of sync with reality.
//
// Vercel cron schedule lives in vercel.json. Auth via CRON_SECRET as
// per the other cron routes here.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 300;
export const runtime = "nodejs";

// We consider a client "active" if they've logged any action in the
// last 30 days. Beyond that we skip — they're cold, no point spending
// the RPC call.
const ACTIVE_LOOKBACK_DAYS = 30;
// Cap concurrency so we don't open hundreds of Postgres connections.
const RPC_CONCURRENCY = 8;

function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) return false;
  const got = auth.slice(prefix.length);
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<{ ok: number; err: number }> {
  let ok = 0;
  let err = 0;
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }).map(async () => {
    while (true) {
      const myIdx = idx++;
      if (myIdx >= items.length) return;
      try { await fn(items[myIdx]); ok++; }
      catch { err++; }
    }
  });
  await Promise.all(workers);
  return { ok, err };
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sinceIso = new Date(Date.now() - ACTIVE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Active = had at least one action_completions row in the last 30d.
  // Distinct on client_id keeps the result small even for power users.
  const { data: actives, error: queryErr } = await supabaseAdmin
    .from("action_completions")
    .select("client_id")
    .gte("date", sinceIso);
  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 500 });
  }
  const uniqueIds = Array.from(new Set((actives ?? []).map((r) => r.client_id as string)));

  const started = Date.now();
  const { ok, err } = await runWithConcurrency(uniqueIds, RPC_CONCURRENCY, async (clientId) => {
    const { error } = await supabaseAdmin.rpc("refresh_user_meters", { p_client_id: clientId });
    if (error) throw new Error(error.message);
  });

  return NextResponse.json({
    ok: true,
    active_users: uniqueIds.length,
    refreshed: ok,
    failed: err,
    elapsed_ms: Date.now() - started,
  });
}
