// Macros from a description of what somebody actually ate.
//
// The real scenario this exists for: you are at work, lunch is whatever the
// canteen made, and none of it is on your plan. Before this, the only way to
// log that was to tick a planned meal you did not eat, which puts a wrong
// number in the diary, or to log nothing, which puts none.
//
// The estimate comes from the parse-meal Supabase edge function — the same
// one the iOS app's LogMealSheet calls, so a described lunch gets the same
// answer on the phone and on the web. One brain, two faces; a second
// implementation here would drift from it the first time either prompt
// changed.
//
// POST { description } → { macros: { kcal, protein, carbs, fat } }
//
// Auth: the signed-in client.
//
// ── Why this route exists at all, rather than the browser calling the
//    edge function directly the way the app does ─────────────────────────
//
// parse-meal is deployed with verify_jwt = false. It does not check the
// token the app sends it, so it answers anybody on the internet and spends
// OpenAI credits doing it. That is worth fixing at the function, but until
// then this route is the authenticated front door for the web: a caller has
// to be a signed-in client, and the attempts are capped.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

const FN_URL = "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/parse-meal";

/** Per-person cap, because each call costs a model request. */
const MAX_PER_10_MIN = 20;

/** Plausibility bounds for one meal. Anything outside is not an estimate. */
const LIMITS = { kcal: 3000, protein: 250, carbs: 500, fat: 250 };

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 400) : "";
  if (description.length < 3) return NextResponse.json({ error: "too_short" }, { status: 400 });

  /* Attempts in the last ten minutes, from the audit log — the same way the
     discount route counts them, so there is one mechanism for this. */
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("hc_audit")
    .select("id", { count: "exact", head: true })
    .eq("actor", `client:${user.id}`).eq("action", "meal_parse").gte("at", since);
  if ((count ?? 0) >= MAX_PER_10_MIN) {
    return NextResponse.json({ error: "too_many" }, { status: 429 });
  }
  await supabaseAdmin.from("hc_audit").insert({
    actor: `client:${user.id}`, action: "meal_parse", journey_id: null,
    detail: { length: description.length },
  }).then(() => {}, () => {});

  let macros: Record<string, unknown> | null = null;
  try {
    const r = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        /* Sent even though the function does not verify it, so that the day
           somebody turns verify_jwt on, this route keeps working. */
        Authorization: req.headers.get("authorization") ?? "",
      },
      body: JSON.stringify({ description }),
      signal: AbortSignal.timeout(20_000),
    });
    if (r.ok) macros = (await r.json().catch(() => null))?.macros ?? null;
  } catch { /* handled below */ }

  /*
   * No invented fallback, deliberately.
   *
   * The app answers a failed parse with a hardcoded { kcal: 400, protein:
   * 20, carbs: 40, fat: 15 } — a number nobody measured or estimated,
   * presented as this meal's macros and written to the diary as if it meant
   * something. For a product whose whole claim is measuring and tracking,
   * the honest answer to "we could not work it out" is to say so and let
   * the person type what they know.
   */
  const num = (v: unknown, cap: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= cap ? Math.round(n) : null;
  };
  const out = macros ? {
    kcal: num(macros.kcal, LIMITS.kcal),
    protein: num(macros.protein, LIMITS.protein),
    carbs: num(macros.carbs, LIMITS.carbs),
    fat: num(macros.fat, LIMITS.fat),
  } : null;
  /* All four or none: three macros and a null is not something to show
     somebody as their lunch. */
  if (!out || Object.values(out).some((v) => v === null)) {
    return NextResponse.json({ error: "no_estimate" }, { status: 502 });
  }

  return NextResponse.json({ macros: out });
}
