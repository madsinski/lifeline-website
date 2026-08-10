// Admin: read / set the master coming-soon gate for the public website.
//   GET  — any active staff: { gated: boolean }
//   POST — admin + AAL2: { gated: boolean } → writes system_settings.public_site_gated
// The proxy (src/proxy.ts) reads the value via the public_site_gated() RPC.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

export const runtime = "nodejs";

async function currentGated(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "public_site_gated")
    .maybeSingle();
  // Default to gated (true) when unset.
  return data?.value !== false;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ gated: await currentGated() });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (typeof body?.gated !== "boolean") {
    return NextResponse.json({ error: "gated must be a boolean" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("system_settings")
    .upsert(
      { key: "public_site_gated", value: body.gated, updated_at: new Date().toISOString(), updated_by: auth.id },
      { onConflict: "key" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, gated: body.gated });
}
