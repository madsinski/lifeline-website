import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sameOrigin } from "@/lib/hc/secrets";
import { endWsSession } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await endWsSession(await cookies());
  return NextResponse.json({ ok: true });
}
