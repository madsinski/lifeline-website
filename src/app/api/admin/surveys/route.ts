// POST /api/admin/surveys
// Create an empty draft survey from scratch. The new-survey wizard
// on /admin/surveys uses this; the user supplies a slug-style key
// + title, the admin then adds questions on the editor page.
//
// Admin-only.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffAAL2, gateError } from "@/lib/auth-helpers";

export const runtime = "nodejs";

interface RequestBody {
  key?: string;
  title_is?: string;
  intro_is?: string | null;
  outro_is?: string | null;
  estimated_minutes?: number;
}

export async function POST(req: Request) {
  const user = await requireStaffAAL2(req, { roles: ["admin"], permission: "manage_team" });
  if (typeof user === "string") return gateError(user);

  let body: RequestBody = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const key = (body.key || "").trim().toLowerCase();
  const title = (body.title_is || "").trim();
  if (!key || !/^[a-z0-9-]+$/.test(key)) {
    return NextResponse.json({ ok: false, error: "key must be slug-style (a-z, 0-9, -)" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ ok: false, error: "title_is required" }, { status: 400 });
  }

  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!staffRow) return gateError("forbidden");

  // Pick the next version for this key. UNIQUE(key, version) on the
  // table will catch any race; this is just a friendlier path.
  const { data: existing } = await supabaseAdmin
    .from("feedback_surveys")
    .select("version")
    .eq("key", key)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = existing && existing.length > 0 ? (existing[0].version as number) + 1 : 1;

  const { data: created, error: insErr } = await supabaseAdmin
    .from("feedback_surveys")
    .insert({
      key,
      version: nextVersion,
      title_is: title,
      intro_is: body.intro_is || null,
      outro_is: body.outro_is || null,
      estimated_minutes: body.estimated_minutes && body.estimated_minutes > 0 ? body.estimated_minutes : 5,
      status: "draft",
      created_by: staffRow.id,
      created_by_name: staffRow.name || user.email,
    })
    .select()
    .single();
  if (insErr || !created) {
    console.error("[surveys]", insErr?.code);
    return NextResponse.json({ ok: false, error: "Aðgerð mistókst. Reyndu aftur." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    survey: created,
    new_id: created.id,
  });
}
