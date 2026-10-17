// The doctor add-on to an Endurmat (check-in) booking, 18.500 kr.
//
// POST { test_code? } → { ok, paid_at }                (test code: done now)
//                     → { ok, pending, checkout_url }  (Straumur's payment page;
//                        marked paid when the payment is confirmed)
//                     → 402 while Straumur is not configured
//
// This used to happen in the browser: a client-side "charge" and then the
// browser itself wrote clients_decrypted.checkin_doctor_addon_paid_at, so
// anybody could mark it paid. The column is now guarded in the DB
// (clients_guard_paid_columns, supabase/migration-test-codes-straumur.sql)
// and only this route — via the service role — sets it.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, siteOrigin, hcAudit } from "@/lib/hc/server";
import { isStraumurConfigured, PAYMENTS_CLOSED_MESSAGE } from "@/lib/straumur-server";
import { startStraumurCheckout } from "@/lib/straumur-checkouts";
import { DOCTOR_ADDON_DESCRIPTION, DOCTOR_ADDON_ISK, markCheckinAddonPaid } from "@/lib/hc/fulfil";
import {
  attachTestCode, CHECKIN_ADDON_TARGET, claimTestCode, normaliseTestCode, releaseTestCode,
  TEST_CODE_INVALID, testCodeRateLimited,
} from "@/lib/hc/test-codes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));

  const { data: c } = await supabaseAdmin.from("clients_decrypted")
    .select("checkin_doctor_addon_paid_at").eq("id", user.id).maybeSingle();
  if (c?.checkin_doctor_addon_paid_at) return NextResponse.json({ ok: true, paid_at: c.checkin_doctor_addon_paid_at, already: true });

  /* Only with a live check-in booking. */
  const { count } = await supabaseAdmin.from("body_comp_bookings").select("id", { count: "exact", head: true })
    .eq("client_id", user.id).eq("package", "checkin").in("status", ["requested", "confirmed"]);
  if (!count) return NextResponse.json({ error: "Viðtal við lækni bætist aðeins við bókað endurmat." }, { status: 409 });

  const rawTest = normaliseTestCode(b?.test_code);
  if (rawTest) {
    if (await testCodeRateLimited(user.id)) return NextResponse.json({ error: "Of margar tilraunir. Reyndu aftur eftir smástund." }, { status: 429 });
    const claim = await claimTestCode(rawTest, user.id, "purchase", CHECKIN_ADDON_TARGET);
    if (!claim) return NextResponse.json({ error: TEST_CODE_INVALID }, { status: 400 });
    try {
      const paidAt = await markCheckinAddonPaid(user.id);
      await attachTestCode(claim, {});
      await hcAudit(`client:${user.id}`, "checkin_addon_test_code", null, { code_id: claim.codeId });
      return NextResponse.json({ ok: true, paid_at: paidAt, test_code: true });
    } catch (e) {
      await releaseTestCode(claim);
      console.error("[checkin-addon] test code fulfil failed", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "Ekki tókst að skrá viðtalið. Reyndu aftur." }, { status: 500 });
    }
  }

  if (!isStraumurConfigured()) return NextResponse.json({ error: PAYMENTS_CLOSED_MESSAGE }, { status: 402 });
  const s = await startStraumurCheckout({
    kind: "checkin_addon", clientId: user.id, email: user.email ?? null, amountIsk: DOCTOR_ADDON_ISK,
    description: DOCTOR_ADDON_DESCRIPTION, payload: {}, origin: siteOrigin(req), returnPath: "/account",
  });
  if (!s.ok) return NextResponse.json({ error: s.error }, { status: 402 });
  return NextResponse.json({ ok: true, pending: true, checkout_url: s.url, reference: s.reference });
}
