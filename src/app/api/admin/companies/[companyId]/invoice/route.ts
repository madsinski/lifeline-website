import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { createPaydayInvoice } from "@/lib/payday";

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

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, kennitala_encrypted, contact_person_id, assessment_unit_price, payday_customer_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "company_not_found" }, { status: 404 });

  // Decrypt kennitala for invoicing
  const { data: decKt } = await supabaseAdmin.rpc("dec_kennitala", { p_enc: company.kennitala_encrypted });
  const kennitala = (decKt as string | null) || "";
  if (!kennitala) return NextResponse.json({ error: "company_kennitala_missing" }, { status: 400 });

  // Completed-assessment count (roster members who finished onboarding)
  const { count: completed } = await supabaseAdmin
    .from("company_members")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .not("completed_at", "is", null);

  const quantity = overrideQuantity ?? (completed || 0);
  const unitPrice = overrideUnitPrice ?? (company.assessment_unit_price || 29900);
  if (quantity <= 0) return NextResponse.json({ error: "nothing_to_invoice", detail: "No completed assessments yet." }, { status: 400 });

  const amountNet = unitPrice * quantity;
  const vatRate = 24;
  const amountTotal = Math.round(amountNet * (1 + vatRate / 100));

  // Contact email
  const { data: contactUser } = await supabaseAdmin.auth.admin.getUserById(company.contact_person_id);
  const contactEmail = contactUser?.user?.email || null;

  const lineDescription = `Lifeline Health Assessment${notes ? ` — ${notes}` : ""} (${quantity} employee${quantity === 1 ? "" : "s"})`;

  const invoiceResult = await createPaydayInvoice({
    customer_kennitala: kennitala,
    customer_name: company.name,
    customer_email: contactEmail,
    currency: "ISK",
    reference: `company:${companyId}`,
    lines: [
      {
        description: lineDescription,
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
      },
    ],
  });

  if (!invoiceResult.ok) {
    return NextResponse.json({ error: "payday_failed", detail: invoiceResult.error, raw: invoiceResult.raw }, { status: 502 });
  }

  const { data: row, error } = await supabaseAdmin
    .from("company_invoices")
    .insert({
      company_id: companyId,
      payday_invoice_id: invoiceResult.invoice_id || null,
      payday_invoice_number: invoiceResult.invoice_number || null,
      status: "sent",
      currency: "ISK",
      unit_price: unitPrice,
      quantity,
      amount_net: amountNet,
      amount_total: amountTotal,
      vat_rate: vatRate,
      line_items: [{ description: lineDescription, quantity, unit_price: unitPrice, vat_rate: vatRate }],
      issued_at: invoiceResult.issued_at || new Date().toISOString(),
      due_at: invoiceResult.due_at || new Date(Date.now() + 14 * 86_400_000).toISOString(),
      pdf_url: invoiceResult.pdf_url || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[invoice] DB insert failed:", error);
    return NextResponse.json({ error: "db_insert_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    invoice_id: row?.id,
    payday_invoice_number: invoiceResult.invoice_number,
    quantity,
    unit_price: unitPrice,
    amount_net: amountNet,
    amount_total: amountTotal,
    pdf_url: invoiceResult.pdf_url,
  });
}
