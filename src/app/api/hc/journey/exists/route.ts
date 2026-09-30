// Does this user have a health-check journey? Read-only (unlike GET
// /api/hc/journey, which creates one). /account uses it to send participants
// to their heilsuferð instead of the legacy dashboard.

import { NextRequest, NextResponse } from "next/server";
import { currentJourney, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const j = await currentJourney(user.id);
  return NextResponse.json({ exists: !!j });
}
