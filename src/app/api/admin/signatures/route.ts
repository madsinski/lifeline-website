// /api/admin/signatures
//
// GET  — any active staff member can read the signatures table.
// PUT  — admin staff only. Upserts the four fields (name/title/phone/email)
//        for one key at a time. Bumps updated_at + updated_by.
//
// Used by /admin/signatures to back the signature builder with shared
// state so every founder sees the same values regardless of browser.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff, isStaff } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("email_signatures")
    .select("key, name, title, phone, email, sort_order, updated_at")
    .order("sort_order", { ascending: true })
    .order("key", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signatures: data ?? [] });
}

interface SignaturePatch {
  key: string;
  name?: string;
  title?: string;
  phone?: string;
  email?: string;
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: SignaturePatch;
  try { body = (await req.json()) as SignaturePatch; } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body?.key || typeof body.key !== "string") {
    return NextResponse.json({ error: "missing_key" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  for (const field of ["name", "title", "phone", "email"] as const) {
    if (typeof body[field] === "string") patch[field] = body[field];
  }

  const { data, error } = await supabaseAdmin
    .from("email_signatures")
    .update(patch)
    .eq("key", body.key)
    .select("key, name, title, phone, email, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ signature: data });
}
