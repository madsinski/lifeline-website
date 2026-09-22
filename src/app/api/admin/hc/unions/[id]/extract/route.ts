// AI-extract a union's reimbursement rules from an uploaded rules document.
// Returns a DRAFT for the admin to review; nothing is saved to hc_unions.rules
// until the admin presses save (PUT /api/admin/hc/unions/[id]).
// POST { document_id }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import { extractUnionRules } from "@/lib/hc/rules-extract";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const unionId = (await ctx.params).id;
  const { document_id } = await req.json().catch(() => ({}));
  const { data: doc } = await supabaseAdmin
    .from("hc_union_documents")
    .select("id, storage_path, mime_type, file_name")
    .eq("id", document_id || "")
    .eq("union_id", unionId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((doc.mime_type || "").startsWith("image/")) {
    return NextResponse.json({ error: "Myndir eru ekki lesnar. Hladdu upp PDF eða DOCX af reglunum." }, { status: 400 });
  }
  const { data: blob, error } = await supabaseAdmin.storage.from("union-documents").download(doc.storage_path);
  if (error || !blob) return NextResponse.json({ error: "download_failed" }, { status: 500 });

  try {
    const out = await extractUnionRules({
      buffer: Buffer.from(await blob.arrayBuffer()),
      mimeType: doc.mime_type || "",
      fileName: doc.file_name || "rules.pdf",
    });
    await supabaseAdmin
      .from("hc_union_documents")
      .update({ extraction: out.extraction, extracted_text: out.text ? out.text.slice(0, 200_000) : null })
      .eq("id", doc.id);
    return NextResponse.json({ draft: out.rules, extraction: out.extraction });
  } catch (e) {
    return NextResponse.json({ error: `Útdráttur tókst ekki: ${(e as Error).message}` }, { status: 502 });
  }
}
