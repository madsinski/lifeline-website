// POST /api/admin/payments/mark — { id, action: 'paid' | 'refunded' }
//
// Marks a payments-ledger row paid/refunded AND cascades to the source
// record so every surface stays consistent: a payment tied to a
// company_invoice flips the invoice to 'paid' (or back to 'sent' on
// refund), which is what the Companies tab Financials line and the
// Accounting per-company table read. The old UI updated only the
// payments row, so invoices stayed "outstanding" forever.
//
// Note: this does NOT push the status to PayDay — PayDay learns about
// payments through Iceland's banking/claim system. Use this for
// payments that arrived outside PayDay (manual bank transfer, etc.).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const action = body?.action === "paid" ? "paid" : body?.action === "refunded" ? "refunded" : null;
  if (!id || !action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: payment, error: fetchErr } = await supabaseAdmin
    .from("payments")
    .select("id, related_type, related_id, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !payment) {
    return NextResponse.json({ error: fetchErr?.message || "not_found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const ledgerUpdate = action === "paid"
    ? { status: "succeeded", paid_at: now }
    : { status: "refunded", refunded_at: now };
  const { error: updErr } = await supabaseAdmin.from("payments").update(ledgerUpdate).eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  let cascaded = false;
  if (payment.related_type === "company_invoice" && payment.related_id) {
    const invoiceUpdate = action === "paid"
      ? { status: "paid", paid_at: now }
      : { status: "sent", paid_at: null };
    const { error: invErr } = await supabaseAdmin
      .from("company_invoices")
      .update(invoiceUpdate)
      .eq("id", payment.related_id);
    cascaded = !invErr;
    if (invErr) {
      return NextResponse.json({ ok: true, cascaded: false, warning: `invoice update failed: ${invErr.message}` });
    }
  }
  return NextResponse.json({ ok: true, cascaded });
}
