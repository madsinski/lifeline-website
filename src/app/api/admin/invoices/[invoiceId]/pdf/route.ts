import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

const PAYDAY_BASE_URL = process.env.PAYDAY_BASE_URL || "https://api.payday.is";

// Reuse the token logic from payday.ts
async function getPaydayToken(): Promise<string | null> {
  const { getToken } = await import("@/lib/payday");
  return (getToken as () => Promise<string | null>)();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    // Import payday fetch helper
    const { paydayFetchRaw } = await import("@/lib/payday");
    const res = await paydayFetchRaw(`/invoices/${invoiceId}/pdf`);
    if (!res.ok) {
      return NextResponse.json({ error: "pdf_fetch_failed", status: res.status }, { status: 502 });
    }

    const pdfBuffer = await res.arrayBuffer();
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${invoiceId}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
