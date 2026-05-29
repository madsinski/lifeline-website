// /api/admin/signatures
//
// GET  — any active staff member can read the signatures table.
// PUT  — admin staff only. Upserts the four fields (name/title/phone/email)
//        for one key at a time. Bumps updated_at + updated_by.
//
// Used by /admin/signatures to back the signature builder with shared
// state so every founder sees the same values regardless of browser.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getUserFromRequest, isAnyActiveStaff, isStaff } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Turn a display name into a short url-safe slug for the row key.
function slugifyKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "signature";
}

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

// POST — create a new signature. Generates a unique key from the name
// (a random suffix is appended on collision) and appends it to the end.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { name?: string; title?: string; phone?: string; email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const name = (body.name ?? "").trim() || "New signature";
  const base = slugifyKey(name);
  let key = base;
  const { data: existing } = await supabaseAdmin
    .from("email_signatures").select("key").eq("key", key).maybeSingle();
  if (existing) key = `${base}-${randomBytes(2).toString("hex")}`;

  // Place new rows after the current last one.
  const { data: last } = await supabaseAdmin
    .from("email_signatures").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sortOrder = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from("email_signatures")
    .insert({
      key,
      name,
      title: (body.title ?? "").trim(),
      phone: (body.phone ?? "").trim(),
      email: (body.email ?? "").trim(),
      sort_order: sortOrder,
      updated_by: user.id,
    })
    .select("key, name, title, phone, email, sort_order, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signature: data }, { status: 201 });
}

// DELETE ?key=<key> — remove a signature.
export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "missing_key" }, { status: 400 });
  const { error } = await supabaseAdmin.from("email_signatures").delete().eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
