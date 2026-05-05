// POST /api/account/welcome/seen
// Stamp clients.welcome_seen_at = now() for the authenticated user.
//
// Why this exists: doing the same update from the browser via
// `supabase.from("clients_decrypted").update({ welcome_seen_at })`
// goes through the view's INSTEAD OF UPDATE trigger, which writes
// every column from NEW back to the base table. In practice that
// path was blanking biody_patient_id (and likely other non-encrypted
// columns) when a user clicked "Horfa á kynningu" to re-watch the
// slideshow after activating Biody — they'd come back to the
// dashboard and see "Activate" again instead of "Edit details".
//
// Writing the base table directly via the service-role admin client
// sidesteps the trigger entirely.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user?.id) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const { error: updErr } = await supabaseAdmin
    .from("clients")
    .update({ welcome_seen_at: new Date().toISOString() })
    .eq("id", userData.user.id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
