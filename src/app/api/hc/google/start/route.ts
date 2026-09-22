// Customer: start Google consent. POST (Bearer) → { url } — the browser then
// navigates there. A plain GET link can't carry the Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { consentUrl, googleConfigured } from "@/lib/google-calendar";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  if (!googleConfigured()) return NextResponse.json({ error: "Google-dagatal er ekki komið í gagnið enn." }, { status: 503 });
  return NextResponse.json({ url: consentUrl(user.id, "client", "/account/heilsuferd?cal=1", user.email) });
}
