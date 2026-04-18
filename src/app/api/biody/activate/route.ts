import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { activateBiodyForClient } from "@/lib/biody";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetId: string = body?.client_id || user.id;

  // A user can activate themselves; anyone else requires staff
  if (targetId !== user.id && !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await activateBiodyForClient(targetId);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
