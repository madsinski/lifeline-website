// POST /api/wearable-issues
//
// Endpoint for the in-app "Stuck?" form on the wearable-setup
// wizard. Validates the JWT, then inserts the issue into
// public.wearable_setup_issues. Staff triage via /admin/wearable-issues.
//
// Body shape mirrors the RN client:
//   { brand, step, message, device_platform, device_version }

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 10;

const requestSchema = z.object({
  brand: z.string().min(1).max(40),
  step: z.number().int().min(0).max(10),
  message: z.string().min(3).max(2000),
  device_platform: z.string().max(20).optional(),
  device_version: z.union([z.string(), z.number()]).optional(),
});

function authToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length);
}

export async function POST(req: Request) {
  const token = authToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 });
  }
  const { brand, step, message, device_platform, device_version } = parsed.data;

  const { data: inserted, error } = await supabaseAdmin
    .from("wearable_setup_issues")
    .insert({
      client_id: userData.user.id,
      brand,
      step,
      message,
      device_platform: device_platform ?? null,
      device_version: device_version ? String(device_version) : null,
    })
    .select("id")
    .single();
  if (error) {
    // Surface the DB failure to the error inbox — staff need to see
    // when /admin/wearable-issues stops receiving reports.
    Sentry.captureException(error, {
      tags: { route: "/api/wearable-issues", brand, step: String(step) },
      extra: { user_id: userData.user.id },
    });
    return NextResponse.json({ ok: false, error: `Insert failed: ${error.message}` }, { status: 500 });
  }
  console.log("[/api/wearable-issues] inserted", { id: inserted?.id, brand, step, user_id: userData.user.id });
  return NextResponse.json({ ok: true, id: inserted?.id ?? null });
}
