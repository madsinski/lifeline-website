// Serve the stored PDF of a manually-attached external invoice.
// pdf_url on the company_invoices row points here; openAuthedPdf in the
// admin UI fetches it with the staff bearer token and opens the blob.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

const BUCKET = "company-invoice-pdfs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ companyId: string; invoiceId: string }> }) {
  const { companyId, invoiceId } = await params;
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: row } = await supabaseAdmin
    .from("company_invoices").select("pdf_storage_path").eq("id", invoiceId).eq("company_id", companyId).maybeSingle();
  if (!row?.pdf_storage_path) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(row.pdf_storage_path as string);
  if (error || !data) return NextResponse.json({ error: error?.message || "download_failed" }, { status: 502 });
  const buffer = Buffer.from(await data.arrayBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoiceId}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
