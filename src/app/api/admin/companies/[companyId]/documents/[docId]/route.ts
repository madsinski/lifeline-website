import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2, gateError } from "@/lib/auth-helpers";

const BUCKET = "company-docs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string; docId: string }> },
) {
  const { companyId, docId } = await params;
  const user = await requireAdminAAL2(_req);
  if (typeof user === "string") return gateError(user);

  const { data: doc } = await supabaseAdmin
    .from("company_documents")
    .select("id, storage_path")
    .eq("id", docId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Best-effort storage delete first; row delete must still happen if the
  // blob was already gone.
  await supabaseAdmin.storage.from(BUCKET).remove([doc.storage_path]).catch(() => {});
  const { error } = await supabaseAdmin
    .from("company_documents")
    .delete()
    .eq("id", docId);
  if (error) {
    console.error("[companies/[companyId]/documents/[docId]]", error?.code);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
