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
import { requireStaffAAL2, gateError } from "@/lib/auth-helpers";

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
  const user = await requireStaffAAL2(req, { roles: ["admin"] });
  if (typeof user === "string") return gateError(user);

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

  // Admin-only — lawyer is read-only for drafts they don't author.
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, name, email")
    .eq("id", user.id)
    .maybeSingle();
  const editorEmail = user.email || staffRow?.email || null;

  const text_hash = sha256Hex(text);

  const { data: insertRow, error: insErr } = await supabaseAdmin
    .from("legal_document_drafts")
    .insert({
      document_key,
      language,
      proposed_version,
      text,
      text_hash,
      edited_by: user.id,
      edited_by_email: editorEmail,
      edited_by_name: staffRow?.name || editorEmail,
      source_note,
    })
    .select("id, created_at, text_hash, proposed_version")
    .single();

  if (insErr || !insertRow) {
    console.error("[legal/draft] insert failed", insErr?.code);
    return NextResponse.json(
      { ok: false, error: "Ekki tókst að vista drögin." },
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
