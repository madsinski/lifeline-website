import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { ensurePaydayCustomer, createPaydayInvoice, paydayPdfUrl } from "@/lib/payday";
import { sendEmail as sendResendEmail, renderInvoiceContactEmail } from "@/lib/email";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const overrideQuantity: number | undefined = body?.quantity;
  const overrideUnitPrice: number | undefined = body?.unit_price;
  const notes: string | undefined = body?.notes;
  const createClaim: boolean | undefined = body?.create_claim;
  const createElectronicInvoice: boolean | undefined = body?.create_electronic_invoice;
  const sendEmail: boolean | undefined = body?.send_email;

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, kennitala_encrypted, contact_person_id, assessment_unit_price, payday_customer_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "company_not_found" }, { status: 404 });

  const { data: decKt } = await supabaseAdmin.rpc("dec_kennitala", { p_enc: company.kennitala_encrypted });
  const kennitala = (decKt as string | null) || "";
  if (!kennitala) return NextResponse.json({ error: "company_kennitala_missing" }, { status: 400 });

  const { count: completed } = await supabaseAdmin
    .from("company_members")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .not("completed_at", "is", null);

  const quantity = overrideQuantity ?? (completed || 0);
  const unitPrice = overrideUnitPrice ?? (company.assessment_unit_price || 29900);
  if (quantity <= 0) {
    return NextResponse.json({ error: "nothing_to_invoice", detail: "No completed assessments yet." }, { status: 400 });
  }

  const amountNet = unitPrice * quantity;
  const vatRate = 24;
  const amountTotal = Math.round(amountNet * (1 + vatRate / 100));

  const { data: contactUser } = await supabaseAdmin.auth.admin.getUserById(company.contact_person_id);
  const contactEmail = contactUser?.user?.email || null;

  // Step 1: ensure PayDay customer exists
  const customerRes = await ensurePaydayCustomer({
    companyId,
    kennitala,
    name: company.name,
    email: contactEmail,
    existingPaydayCustomerId: company.payday_customer_id,
  });
  if (!customerRes.ok || !customerRes.customer_id) {
    return NextResponse.json({
      error: "payday_customer_failed",
      detail: customerRes.error,
      raw: customerRes.raw,
    }, { status: 502 });
  }

  // Step 2: create invoice
  const lineDescription = `Lifeline Health Assessment${notes ? ` — ${notes}` : ""}`;
  const invoiceRes = await createPaydayInvoice({
    customerId: customerRes.customer_id,
    description: `Lifeline health assessments for ${company.name}`,
    currencyCode: "ISK",
    createClaim: createClaim ?? true,
    createElectronicInvoice: createElectronicInvoice ?? false,
    sendEmail: sendEmail ?? true,
    reference: `lifeline:company:${companyId}`,
    lines: [
      {
        description: lineDescription,
        quantity,
        unitPriceExcludingVat: unitPrice,
        vatPercentage: vatRate,
      },
    ],
  });

  if (!invoiceRes.ok) {
    return NextResponse.json({
      error: "payday_invoice_failed",
      detail: invoiceRes.error,
      raw: invoiceRes.raw,
    }, { status: 502 });
  }

  const { data: row, error } = await supabaseAdmin
    .from("company_invoices")
    .insert({
      company_id: companyId,
      payday_invoice_id: invoiceRes.invoice_id || null,
      payday_invoice_number: invoiceRes.invoice_number || null,
      status: "sent",
      currency: "ISK",
      unit_price: unitPrice,
      quantity,
      amount_net: amountNet,
      amount_total: amountTotal,
      vat_rate: vatRate,
      line_items: [{
        description: lineDescription,
        quantity,
        unitPriceExcludingVat: unitPrice,
        vatPercentage: vatRate,
      }],
      issued_at: invoiceRes.issued_at || new Date().toISOString(),
      due_at: invoiceRes.due_at || new Date(Date.now() + 14 * 86_400_000).toISOString(),
      pdf_url: invoiceRes.invoice_id ? paydayPdfUrl(invoiceRes.invoice_id) : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[invoice] DB insert failed:", error);
    return NextResponse.json({ error: "db_insert_failed", detail: error.message }, { status: 500 });
  }

  // Mirror into the unified payments ledger so the company's billing panel
  // sees this invoice alongside any card-on-file charges. Status tracks the
  // PayDay invoice lifecycle — issued = pending until paid.
  try {
    await supabaseAdmin.from("payments").insert({
      owner_type: "company",
      owner_id: companyId,
      amount_isk: amountTotal,
      currency: "ISK",
      description: `Lifeline assessments · ${quantity} × ${unitPrice.toLocaleString("is-IS")} ISK`,
      provider: "payday",
      provider_reference: invoiceRes.invoice_number || invoiceRes.invoice_id || null,
      status: "pending",
      related_type: "company_invoice",
      related_id: row?.id || null,
      pdf_url: invoiceRes.invoice_id ? paydayPdfUrl(invoiceRes.invoice_id) : null,
    });
  } catch (e) {
    console.error("[invoice] payments ledger mirror failed:", e);
  }

  // Notify the company contact person with a Lifeline-branded email.
  // PayDay also delivers the invoice itself to the company kennitala via
  // electronic invoicing — this is purely a courtesy heads-up.
  let notify_email: string | null = null;
  let notify_error: string | null = null;
  if (contactEmail) {
    try {
      const { data: contactClient } = await supabaseAdmin
        .from("clients")
        .select("full_name")
        .eq("id", company.contact_person_id)
        .maybeSingle();
      const recipientName = ((contactClient as { full_name?: string } | null)?.full_name?.split(" ")[0]) || "there";
      const email = renderInvoiceContactEmail({
        recipientName,
        companyName: company.name,
        quantity,
        unitPrice,
        amountTotal,
        invoiceNumber: invoiceRes.invoice_number || null,
        pdfUrl: invoiceRes.invoice_id ? paydayPdfUrl(invoiceRes.invoice_id) : null,
      });
      const sendRes = await sendResendEmail({
        to: contactEmail,
        subject: `Lifeline invoice for ${company.name}${invoiceRes.invoice_number ? ` · ${invoiceRes.invoice_number}` : ""}`,
        text: email.text,
        html: email.html,
      });
      if (sendRes.ok) notify_email = contactEmail;
      else notify_error = sendRes.error || null;
    } catch (e) {
      notify_error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    ok: true,
    invoice_id: row?.id,
    payday_invoice_number: invoiceRes.invoice_number,
    quantity,
    unit_price: unitPrice,
    amount_net: amountNet,
    amount_total: amountTotal,
    pdf_url: invoiceRes.invoice_id ? paydayPdfUrl(invoiceRes.invoice_id) : null,
    notify_email,
    notify_error,
  });
}
