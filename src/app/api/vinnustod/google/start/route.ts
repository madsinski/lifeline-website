// Workstation user: start Google consent (cookie session, so a plain link works).

import { NextResponse } from "next/server";
import { consentUrl, googleConfigured } from "@/lib/google-calendar";
import { getWorkerSession } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!googleConfigured()) return new Response("Google-dagatal er ekki komið í gagnið enn.", { status: 503 });
  const me = await getWorkerSession();
  if (!me) return NextResponse.redirect(new URL("/vinnustod", req.url));
  return NextResponse.redirect(consentUrl(me.id, "worker", "/vinnustod?cal=1", me.email));
}
