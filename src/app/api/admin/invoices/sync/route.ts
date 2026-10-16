import { NextRequest, NextResponse } from "next/server";
import { requireAdminAAL2, gateError } from "@/lib/auth-helpers";
import { syncInvoiceStatuses } from "@/lib/payday";

export async function POST(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") return gateError(user);

  const result = await syncInvoiceStatuses();
  return NextResponse.json(result);
}
