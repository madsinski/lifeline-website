// Daily PayDay invoice status sync — vercel.json: "30 7 * * *".
//
// Pulls invoice statuses from PayDay (paid / cancelled / sent) into
// company_invoices + the payments ledger, so the Companies Financials
// line, the Accounting per-company table, and the receivables strip
// stay current without anyone pressing the sync button. Inbound only:
// PayDay is the source of truth for invoice payment.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { syncInvoiceStatuses } from "@/lib/payday";

export const maxDuration = 300;

function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) return false;
  const a = Buffer.from(auth.slice(prefix.length));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await syncInvoiceStatuses();
  return NextResponse.json({ ok: true, ...result });
}
