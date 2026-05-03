// On-demand Biody body-composition fetch.
//
// Auth-gates the caller, verifies they hold an active biody-import-v1
// consent, looks up their own biody_patient_id, and returns the measurement
// list straight from Biody Manager. Nothing is persisted.
//
// Cache-Control: no-store — the dashboard should always show fresh data,
// and the response includes Art. 9 health values that mustn't sit in
// any intermediate cache layer.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPatientMeasurements, summariseMeasurement } from "@/lib/biody-client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const accessToken = authHeader.slice("Bearer ".length);

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }
  const user = userData.user;

  // Consent check — the user must have an active biody-import-v1 consent.
  const { data: consent } = await supabaseAdmin
    .from("client_consents")
    .select("id, granted, revoked_at")
    .eq("client_id", user.id)
    .eq("consent_key", "biody-import-v1")
    .is("revoked_at", null)
    .maybeSingle();
  if (!consent || !consent.granted) {
    return NextResponse.json(
      { ok: false, error: "Consent not granted for Biody import" },
      { status: 403 },
    );
  }

  // Self-only mapping.
  const { data: clientRow } = await supabaseAdmin
    .from("clients")
    .select("biody_patient_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!clientRow?.biody_patient_id) {
    return NextResponse.json({ ok: true, measurements: [], note: "No Biody patient linked" }, { status: 200 });
  }

  try {
    const raw = await getPatientMeasurements(Number(clientRow.biody_patient_id), { limit: 50 });
    const summaries = raw.map(summariseMeasurement);
    return NextResponse.json(
      { ok: true, measurements: summaries },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 },
    );
  }
}
