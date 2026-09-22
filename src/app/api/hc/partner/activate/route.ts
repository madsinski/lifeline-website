// Patient-portal partner API: redeem an activation code.
//
// The customer receives the code after payment in their Lifeline account and
// enters it in the patient portal (Medalia). The portal calls this endpoint
// to verify it, receives what it needs to open the protocol, and the journey
// advances to "protocol active" by itself.
//
// Auth: header `x-api-key: $HC_PARTNER_API_KEY`.
// POST { code, kennitala? } → { journey_id, kind, package, patient, location }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeCode } from "@/lib/hc/codes";
import { applyJourneyEvent } from "@/lib/hc/events";
import { clientIp, throttle } from "@/lib/hc/secrets";
import { decryptKennitala, getClientProfile, hcAudit, partnerAuthorized, siteOrigin } from "@/lib/hc/server";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!partnerAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await throttle(`partner:${clientIp(req)}`, 300, 60))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const code = normalizeCode(String(body.code || ""));
  const { data: order } = await supabaseAdmin
    .from("hc_orders")
    .select("id, journey_id, client_id, package_key, kind, status, activation_redeemed_at")
    .eq("activation_code", code)
    .maybeSingle();
  if (!order || order.status !== "paid") return NextResponse.json({ error: "invalid_code" }, { status: 404 });

  const profile = await getClientProfile(order.client_id);
  const kennitala = await decryptKennitala(profile?.kennitala_encrypted ?? null, {
    actorRole: "partner_portal", purpose: "activation", subjectId: order.client_id, req,
  });
  if (body.kennitala && kennitala && String(body.kennitala).replace(/\D/g, "") !== kennitala) {
    return NextResponse.json({ error: "kennitala_mismatch" }, { status: 409 });
  }

  const { data: journey } = await supabaseAdmin.from("hc_journeys").select("*").eq("id", order.journey_id).single();
  if (!order.activation_redeemed_at) {
    await supabaseAdmin.from("hc_orders").update({ activation_redeemed_at: new Date().toISOString() }).eq("id", order.id);
    if (journey && (order.kind === "health_check" || order.kind === "reevaluation") && !journey.protocol_activated_at) {
      await applyJourneyEvent(journey as HcJourney, "protocol_activated", { actor: "partner:portal", origin: siteOrigin(req) });
    } else {
      await hcAudit("partner:portal", `activated:${order.kind}`, order.journey_id, { order_id: order.id });
    }
  }

  const [{ data: pkg }, { data: loc }] = await Promise.all([
    supabaseAdmin.from("hc_packages").select("key, name, kind").eq("key", order.package_key).maybeSingle(),
    journey?.location_id
      ? supabaseAdmin.from("hc_locations").select("slug, name, blood_test_site, measurement_site").eq("id", journey.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    ok: true,
    journey_id: order.journey_id,
    kind: order.kind,
    already_redeemed: !!order.activation_redeemed_at,
    package: pkg,
    patient: {
      full_name: profile?.full_name ?? null,
      kennitala,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
    },
    location: loc,
  });
}
