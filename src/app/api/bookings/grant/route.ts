import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { PACKAGES } from "@/lib/assessment-packages";
import { cleanKennitala, isValidKennitala } from "@/lib/kennitala";
import {
  UNION_FUNDS,
  OTHER_UNION_CODE,
  UNION_GRANT_CONSENT_VERSION,
  findUnionFund,
  grantForBooking,
} from "@/lib/union-grants";
import type { PackageKey } from "@/lib/assessment-packages";

// Records the union grant claim for a booking — see the grant stage in
// /account/book. Everything that matters about this endpoint is that the
// browser is NOT trusted for the money: the client sends the union code and
// the kennitala, and the server recomputes the grant from the fund registry
// and the booking's own package. A tampered request can't mint a discount.
//
// Kennitala is written through record_union_grant_claim (see
// supabase/migration-union-grants.sql), which encrypts it inside the
// database. It never lands in a plaintext column and never comes back out
// of this route.

export const maxDuration = 20;

/**
 * Undo a grant the member applied and then backed out of: void the claim and
 * put the booking back to list price. Without this, stepping back through the
 * grant stage would leave a discounted booking with no fund to bill.
 */
async function clearGrant(bookingId: string, userId: string) {
  const { data: booking } = await supabaseAdmin
    .from("body_comp_bookings")
    .select("id, client_id, package, payment_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.client_id !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (booking.payment_status === "paid") return NextResponse.json({ error: "already_paid" }, { status: 409 });

  await supabaseAdmin.rpc("void_union_grant_claim_for_booking", { p_booking_id: bookingId });

  const grossIsk = PACKAGES.find((p) => p.key === booking.package)?.priceIsk ?? 0;
  const { error } = await supabaseAdmin
    .from("body_comp_bookings")
    .update({ amount_isk: grossIsk })
    .eq("id", bookingId)
    .eq("payment_status", "pending");
  if (error) {
    Sentry.captureException(new Error(`union grant: clear failed — ${error.message}`), { extra: { bookingId } });
    return NextResponse.json({ error: "clear_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, grantIsk: 0, netIsk: grossIsk, grossIsk });
}

type Body = {
  bookingId?: string;
  unionCode?: string;
  kennitala?: string;
  consent?: boolean;
  /** Set when the member backs out of the grant stage after applying one. */
  clear?: boolean;
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const bookingId = (body.bookingId || "").trim();
  const unionCode = (body.unionCode || "").trim();
  const kennitala = cleanKennitala(body.kennitala || "");

  if (!bookingId) return NextResponse.json({ error: "bookingId_required" }, { status: 400 });

  if (body.clear) return clearGrant(bookingId, user.id);

  if (!unionCode) return NextResponse.json({ error: "unionCode_required" }, { status: 400 });

  const isKnownFund = UNION_FUNDS.some((f) => f.code === unionCode);
  if (!isKnownFund && unionCode !== OTHER_UNION_CODE) {
    return NextResponse.json({ error: "unknown_union" }, { status: 400 });
  }
  const { data: booking } = await supabaseAdmin
    .from("body_comp_bookings")
    .select("id, client_id, package, amount_isk, status, payment_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.client_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (booking.status === "cancelled") return NextResponse.json({ error: "booking_cancelled" }, { status: 400 });
  if (booking.payment_status === "paid") {
    // The discount has to be settled before the charge, otherwise the
    // payments ledger and the fund invoice disagree about what was owed.
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }

  // Recompute the grant server-side. `amount_isk` on a draft booking is
  // already the net figure the browser proposed, so we work from the
  // package's list price instead — the browser has no say in it.
  const fund = findUnionFund(unionCode);
  const packageKey = (booking.package as PackageKey | null) ?? null;
  const grossIsk = PACKAGES.find((p) => p.key === packageKey)?.priceIsk ?? 0;
  const grantIsk = grantForBooking(fund, packageKey, grossIsk);
  const netIsk = grossIsk - grantIsk;

  // Kennitala and consent are only required when money actually moves. For a
  // fund we haven't signed with yet the grant is 0 and we are just recording
  // which union the member belongs to — that tells us where to negotiate
  // next, and asking for a kennitala to buy nothing would be friction for
  // data we have no use for yet.
  if (grantIsk > 0) {
    if (!isValidKennitala(kennitala)) {
      return NextResponse.json({ error: "invalid_kennitala" }, { status: 400 });
    }
    if (!body.consent) {
      return NextResponse.json({ error: "consent_required" }, { status: 400 });
    }
  }

  if (kennitala) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const ua = req.headers.get("user-agent") || "";
    await supabaseAdmin.rpc("log_kennitala_access", {
      p_actor_role: "client",
      p_scope: "full",
      p_purpose: "union_grant_claim",
      p_subject_kind: "client",
      p_subject_id: user.id,
      p_ip: ip,
      p_user_agent: ua,
    });
  }

  const { data: claimId, error } = await supabaseAdmin.rpc("record_union_grant_claim", {
    p_booking_id: bookingId,
    p_union_code: unionCode,
    p_union_name: fund?.name ?? "Annað stéttarfélag",
    p_settlement: fund?.settlement ?? "reimbursement",
    p_gross_isk: grossIsk,
    p_grant_isk: grantIsk,
    p_kennitala: kennitala,
    p_consent_version: UNION_GRANT_CONSENT_VERSION,
  });
  if (error) {
    Sentry.captureException(new Error(`union grant: claim write failed — ${error.message}`), {
      extra: { bookingId, unionCode, grossIsk, grantIsk, netIsk },
    });
    return NextResponse.json({ error: "claim_write_failed", detail: error.message }, { status: 500 });
  }

  // Only now drop the price. amount_isk is both what the client is charged
  // and what refund_and_cancel_booking pays back, so it must equal the net
  // figure — but it must never drop before the claim exists, or a failure
  // here would leave a discounted booking with nothing to bill the fund for.
  // If this write fails we void the claim so the booking falls back to full
  // price rather than stranding money between us and the fund.
  if (booking.amount_isk !== netIsk) {
    const { error: syncErr } = await supabaseAdmin
      .from("body_comp_bookings")
      .update({ amount_isk: netIsk })
      .eq("id", bookingId)
      .eq("payment_status", "pending");
    if (syncErr) {
      await supabaseAdmin.rpc("void_union_grant_claim_for_booking", { p_booking_id: bookingId });
      Sentry.captureException(new Error(`union grant: booking amount sync failed — ${syncErr.message}`), {
        extra: { bookingId, unionCode, grossIsk, grantIsk, netIsk },
      });
      return NextResponse.json({ error: "booking_sync_failed", detail: syncErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, claimId, grantIsk, netIsk, grossIsk });
}
