import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { syncInvoiceStatuses } from "@/lib/payday";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await syncInvoiceStatuses();
  return NextResponse.json(result);
}
