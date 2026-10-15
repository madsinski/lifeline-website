// The withdrawal-right waiver (söluskilmálar gr. 8, d-liður 1. mgr. 18. gr.
// laga nr. 16/2016), shared by /api/hc/subscribe and /api/hc/checkout.
//
// Required from the website: the web Paywall and checkout send
// `x-lifeline-client: web`. The mobile app (fhir-health-dashboard) calls the
// same routes without the flag today, so a request without the header is let
// through and recorded as not waived. TODO once the RN app sends
// withdrawal_waiver: drop the header test so every purchase needs it.
//
// The header is not a security boundary — leaving it off only gets a
// purchase recorded as "no waiver", which is the consumer-friendly default.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isMissingSchema, warnOnce } from "@/lib/hc/subscription";

const WAIVER_REQUIRED = "Merkja þarf við að þjónustan hefjist strax og að rétturinn til að falla frá samningi falli niður þegar hún hefur verið veitt að fullu.";

/**
 * The waiver is required from the website; the RN app is exempt until it
 * sends the flag (see the header comment). Returns an error response or null.
 */
export function requireWaiver(req: NextRequest, body: { withdrawal_waiver?: unknown } | null): NextResponse | null {
  const fromWeb = req.headers.get("x-lifeline-client") === "web";
  if (fromWeb && body?.withdrawal_waiver !== true) {
    return NextResponse.json({ error: WAIVER_REQUIRED }, { status: 400 });
  }
  return null;
}

/**
 * The server's time of the waiver onto a row, if the column exists yet.
 * Never fails the purchase: the hc_audit line is written regardless.
 */
export async function recordWaiver(table: "subscriptions" | "hc_orders", id: string, at: string) {
  const { error } = await supabaseAdmin.from(table).update({ withdrawal_waiver_at: at }).eq("id", id);
  if (error) {
    if (isMissingSchema(error)) warnOnce(`waiver:${table}`, `${table}.withdrawal_waiver_at missing — run supabase/migration-withdrawal-waiver.sql; waiver kept in hc_audit only.`);
    else console.error(`[hc] recording withdrawal waiver on ${table} failed`, error.message);
  }
}

