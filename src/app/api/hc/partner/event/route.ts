// DORMANT (2026-10-16): HC_PARTNER_API_KEY is not set in production, so
// partnerAuthorized() refuses every call and this endpoint answers 401. It is
// kept ready for if/when Medalia integrates; nothing in Lifeline depends on
// it. See security-posture.ts ("Partner API").
//
// Patient-portal partner API: report a milestone so the journey moves on by
// itself — booking made, blood test taken, results in, measurements done,
// the doctor's interview done (in Medalia), Áætlunarsamtal booked/done.
//
// Auth: header `x-api-key: $HC_PARTNER_API_KEY`.
// POST { journey_id | code, event, at?, mode? }
//   event ∈ blood_test_booked, blood_test_done, blood_results_ready,
//           measurements_booked, measurements_done, doctor_interview_done,
//           interview_booked, interview_done, followup_booked, followup_done
// protocol_activated goes through /activate. The legacy report_generated /
// referral_heilsugaesla events no longer exist (isJourneyEvent rejects them).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeCode } from "@/lib/hc/codes";
import { applyJourneyEvent, isJourneyEvent } from "@/lib/hc/events";
import { hcAudit, partnerAuthorized, siteOrigin } from "@/lib/hc/server";
import { isStandaloneKind } from "@/lib/hc/shop";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!partnerAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isJourneyEvent(body.event) || body.event === "protocol_activated") {
    return NextResponse.json({ error: "bad_event" }, { status: 400 });
  }

  let journeyId: string | null = typeof body.journey_id === "string" ? body.journey_id : null;
  if (!journeyId && body.code) {
    /* Same matching as /activate: old LL-XXXX-XXXX codes normalise, Medalia's
       pool codes are stored as Medalia wrote them, so try those as typed. */
    const raw = String(body.code).trim();
    const candidates = Array.from(new Set([normalizeCode(raw), raw, raw.toUpperCase()].filter(Boolean)));
    const { data } = await supabaseAdmin.from("hc_orders").select("id, journey_id, kind").in("activation_code", candidates).limit(1).maybeSingle();
    /* A code for a product bought on its own (shop: measurement, blood test,
       doctor interview) is not the journey's health check: its events must
       not move the journey's stage. Recorded, nothing else. */
    if (data && isStandaloneKind(data.kind)) {
      await hcAudit("partner:portal", `standalone_event:${body.event}`, data.journey_id, { order_id: data.id, kind: data.kind, at: body.at ?? null });
      return NextResponse.json({ ok: true, standalone: true, stage: null });
    }
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
