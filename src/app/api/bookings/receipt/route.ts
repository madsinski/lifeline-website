import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { renderBookingReceiptPdf } from "@/lib/pdf-booking-receipt";

// Generate (or return a cached) PDF receipt for a paid body_comp_booking.
// Stored in the booking-receipts bucket at <client_id>/<booking_id>.pdf.
// Returns a short-lived signed URL. Called from handlePay (auto-generate)
// and from the BillingPanel (retroactive for older bookings).

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bookingId = (body?.bookingId || "").trim();
  if (!bookingId) return NextResponse.json({ error: "bookingId_required" }, { status: 400 });

  const { data: booking } = await supabaseAdmin
    .from("body_comp_bookings")
    .select("id, client_id, scheduled_at, location, package, amount_isk, payment_status, payment_provider, payment_reference, paid_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Caller must own the booking OR be staff
  const staff = await isStaff(user.id);
  if (booking.client_id !== user.id && !staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (booking.payment_status !== "paid" && booking.payment_status !== "refunded") {
    return NextResponse.json({ error: "not_paid" }, { status: 400 });
  }

  // Use existing receipt URL on the payments row if present
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, pdf_url, amount_isk, provider, provider_reference, paid_at, status, refunded_at")
    .eq("related_type", "body_comp_booking")
    .eq("related_id", bookingId)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  // If a PDF already exists and the caller didn't ask to regenerate, return it.
  const force = body?.force === true;
  if (!force && payment?.pdf_url) {
    return NextResponse.json({ ok: true, url: payment.pdf_url });
  }

  const { data: client } = await supabaseAdmin
    .from("clients_decrypted")
    .select("full_name, email, address")
    .eq("id", booking.client_id)
    .maybeSingle();
  if (!client?.email) return NextResponse.json({ error: "no_client_email" }, { status: 400 });

  const pkgLabel = booking.package === "foundational" ? "Foundational Health assessment"
    : booking.package === "checkin" ? "Check-in round"
    : booking.package === "self-checkin" ? "Self Check-in"
    : booking.package || "Lifeline service";

  const receiptNumber = `LL-${new Date(booking.paid_at || new Date()).getFullYear()}-${bookingId.slice(0, 8).toUpperCase()}`;
  const refundedIsk = payment?.status === "refunded" ? payment.amount_isk : 0;

  // Render PDF
  let pdfBytes: Buffer;
  try {
    pdfBytes = await renderBookingReceiptPdf({
      bookingId,
      receiptNumber,
      issuedAtIso: new Date().toISOString(),
      paidAtIso: booking.paid_at || payment?.paid_at || null,
      packageName: pkgLabel,
      scheduledAtIso: booking.scheduled_at,
      location: booking.location,
      amountIsk: booking.amount_isk ?? 0,
      refundedIsk,
      client: {
        fullName: client.full_name || client.email,
        email: client.email,
        addressLine: (client as { address?: string | null }).address || null,
      },
      provider: {
        name: booking.payment_provider === "straumur" ? "Straumur" : (booking.payment_provider || "—"),
        reference: booking.payment_reference || payment?.provider_reference || null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "pdf_render_failed", detail: (e as Error).message }, { status: 500 });
  }

  // Upload
  const storagePath = `${booking.client_id}/${bookingId}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("booking-receipts")
    .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) {
    return NextResponse.json({ error: "upload_failed", detail: upErr.message }, { status: 500 });
  }

  // Signed URL — 1 year. The client can re-request anytime; staff can
  // also regenerate with force=true after a refund.
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from("booking-receipts")
    .createSignedUrl(storagePath, 365 * 24 * 3600);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "sign_failed", detail: signErr?.message }, { status: 500 });
  }

  // Stamp the payments row so BillingPanel shows the PDF link
  if (payment?.id) {
    await supabaseAdmin
      .from("payments")
      .update({ pdf_url: signed.signedUrl })
      .eq("id", payment.id);
  }

  return NextResponse.json({ ok: true, url: signed.signedUrl, receiptNumber });
}
