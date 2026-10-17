// Asking for "Lifeline þjálfun" before paying for it.
//
// GET    → { request: CoachingRequestView }
// POST   → send a request (eligibility = a postcode in the region). Evident
//          cases are approved at once (src/lib/hc/coaching-requests.ts).
// DELETE → withdraw a pending request
//
// Auth: the participant's own session. Schema: supabase/migration-coaching-requests.sql

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/hc/server";
import { cancelRequest, createRequest, requestView, viewOf } from "@/lib/hc/coaching-requests";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ request: await requestView(user.id) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const r = await createRequest(user.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, created: r.created, request: viewOf(r.request) });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  await cancelRequest(user.id);
  return NextResponse.json({ ok: true, request: await requestView(user.id) });
}
