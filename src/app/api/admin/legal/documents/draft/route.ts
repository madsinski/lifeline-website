// Save an admin-edited revision of a legal document.
//
// Workflow this serves: the lawyer sends Mads a redlined .txt, Mads
// pastes the revised text into the Edit field on the doc card, this
// endpoint stores it. From then on /admin/legal/drafts shows the
// stored draft for that (document_key, language).
//
// Admin-only. The lawyer reads the result via SELECT (RLS allows any
// active staff to read), but only admin can write.

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

interface DraftBody {
  document_key?: string;
  language?: "is" | "en";
  proposed_version?: string;
  text?: string;
  source_note?: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  let body: DraftBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const document_key = (body.document_key || "").trim();
  const language = body.language;
  const proposed_version = (body.proposed_version || "").trim();
  const text = (body.text || "").toString();
  const source_note = (body.source_note || "").toString().slice(0, 500) || null;

  if (!document_key) {
    return NextResponse.json({ ok: false, error: "document_key required" }, { status: 400 });
  }
  if (language !== "is" && language !== "en") {
    return NextResponse.json({ ok: false, error: "language must be 'is' or 'en'" }, { status: 400 });
  }
  if (!proposed_version) {
    return NextResponse.json({ ok: false, error: "proposed_version required" }, { status: 400 });
  }
  if (text.length < 20) {
    return NextResponse.json({ ok: false, error: "text is too short — looks like a paste error" }, { status: 400 });
  }
  if (text.length > 200_000) {
    return NextResponse.json({ ok: false, error: "text exceeds 200KB — split into sections if needed" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user?.email) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  // Admin-only — lawyer is read-only for drafts they don't author.
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, role, name, active")
    .eq("email", userData.user.email)
    .maybeSingle();
  if (!staffRow || !staffRow.active || staffRow.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin role required" }, { status: 403 });
  }

  const text_hash = sha256Hex(text);

  const { data: insertRow, error: insErr } = await supabaseAdmin
    .from("legal_document_drafts")
    .insert({
      document_key,
      language,
      proposed_version,
      text,
      text_hash,
      edited_by: staffRow.id,
      edited_by_email: userData.user.email,
      edited_by_name: staffRow.name || userData.user.email,
      source_note,
    })
    .select("id, created_at, text_hash, proposed_version")
    .single();

  if (insErr || !insertRow) {
    return NextResponse.json(
      { ok: false, error: `Could not save draft: ${insErr?.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: insertRow.id,
    created_at: insertRow.created_at,
    text_hash: insertRow.text_hash,
    proposed_version: insertRow.proposed_version,
  });
}
