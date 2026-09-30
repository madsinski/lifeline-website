// Workstation user: start Google consent.
//   GET  — worker cookie session, so a plain link works (redirects to Google)
//   POST — Lifeline staff (Bearer): returns { url } to navigate to

import { NextResponse } from "next/server";
import { consentUrl, googleConfigured } from "@/lib/google-calendar";
import { calendarWorker, getWorkerSession } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!googleConfigured()) return new Response("Google-dagatal er ekki komið í gagnið enn.", { status: 503 });
  const me = await getWorkerSession();
  if (!me) return NextResponse.redirect(new URL("/vinnustod", req.url));
  return NextResponse.redirect(consentUrl(me.id, "worker", "/vinnustod?cal=1", me.email));
}

export async function POST(req: Request) {
  if (!googleConfigured()) return NextResponse.json({ error: "Google-dagatal er ekki komið í gagnið enn." }, { status: 503 });
  const me = await calendarWorker(req);
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ url: consentUrl(me.id, "worker", me.cookie ? "/vinnustod?cal=1" : "/admin/vinnustod?cal=1", me.email ?? undefined) });
}
