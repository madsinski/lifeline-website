import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

const BUCKET = "company-docs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ companyId: string; docId: string }> },
) {
  const { companyId, docId } = await params;
  const user = await getUserFromRequest(_req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

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
  if (error) return NextResponse.json({ error: "delete_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
