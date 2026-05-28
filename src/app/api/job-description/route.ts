// /api/job-description
//
// Single source of truth for the Framkvæmdastjóri recruiting document,
// shared by the admin editor (/admin/job-description) and the public
// read-only mirror (/verkefnalysing).
//
// GET — returns the stored `fields`. Open to anyone presenting the shared
//       view key (?key=, the same password as /verkefnalysing) or to any
//       active staff member. The document is a recruiting proposal, not
//       sensitive PII.
// PUT — admin-only, AAL2 (MFA). Upserts the whole fields object.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const DOC_ID = "framkvaemdastjori";
// Cosmetic shared key — matches the password on /verkefnalysing. The gate
// is client-visible by nature; it just keeps the proposal off a trivially
// open endpoint.
const VIEW_KEY = "lifeline";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== VIEW_KEY) {
    const user = await getUserFromRequest(req);
    if (!user || !(await isAnyActiveStaff(user.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("job_descriptions")
    .select("fields, updated_at")
    .eq("id", DOC_ID)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    fields: (data?.fields as Record<string, unknown>) ?? {},
    updated_at: data?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    const status = user === "unauthorized" ? 401 : 403;
    return NextResponse.json({ error: user }, { status });
  }

  let body: { fields?: Record<string, unknown> };
  try {
    body = (await req.json()) as { fields?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body?.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("job_descriptions")
    .upsert(
      { id: DOC_ID, fields: body.fields, updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: "id" }
    )
    .select("fields, updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fields: (data?.fields as Record<string, unknown>) ?? {} });
}
