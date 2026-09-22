// Patient-portal partner API: report a milestone so the journey moves on by
// itself — booking made, blood test taken, results in, measurements done,
// interview booked/done.
//
// Auth: header `x-api-key: $HC_PARTNER_API_KEY`.
// POST { journey_id | code, event, at?, mode? }
//   event ∈ blood_test_booked, blood_test_done, blood_results_ready,
//           measurements_booked, measurements_done, interview_booked,
//           interview_done, followup_booked, followup_done
// report_generated is deliberately NOT accepted here: a Lifeline doctor
// confirms the report in the workstation (5-minute SMS escalation).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeCode } from "@/lib/hc/codes";
import { applyJourneyEvent, DOCTOR_ONLY, isJourneyEvent } from "@/lib/hc/events";
import { partnerAuthorized, siteOrigin } from "@/lib/hc/server";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!partnerAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isJourneyEvent(body.event) || DOCTOR_ONLY.includes(body.event) || body.event === "protocol_activated") {
    return NextResponse.json({ error: "bad_event" }, { status: 400 });
  }

  let journeyId: string | null = typeof body.journey_id === "string" ? body.journey_id : null;
  if (!journeyId && body.code) {
    const { data } = await supabaseAdmin.from("hc_orders").select("journey_id").eq("activation_code", normalizeCode(String(body.code))).maybeSingle();
    journeyId = data?.journey_id ?? null;
  }
  if (!journeyId) return NextResponse.json({ error: "journey_not_found" }, { status: 404 });
  const { data: journey } = await supabaseAdmin.from("hc_journeys").select("*").eq("id", journeyId).maybeSingle();
  if (!journey) return NextResponse.json({ error: "journey_not_found" }, { status: 404 });

  if (body.at && Number.isNaN(new Date(body.at).getTime())) return NextResponse.json({ error: "bad_date" }, { status: 400 });
  const updated = await applyJourneyEvent(journey as HcJourney, body.event, {
    at: body.at ?? null,
    actor: "partner:portal",
    mode: body.mode === "video" ? "video" : body.mode === "in_person" ? "in_person" : null,
    origin: siteOrigin(req),
  });
  return NextResponse.json({ ok: !!updated, stage: updated?.stage ?? null });
}
