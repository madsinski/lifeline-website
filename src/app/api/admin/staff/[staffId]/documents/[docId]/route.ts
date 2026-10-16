import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffAAL2, gateError } from "@/lib/auth-helpers";

// Delete a bespoke staff document. Admin / manage_team only.
// Removes the storage blob + the row.

export const maxDuration = 30;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ staffId: string; docId: string }> },
) {
  const { staffId, docId } = await params;
  // admin or manage_team permission, + AAL2
  const user = await requireStaffAAL2(req, { roles: ["admin"], permission: "manage_team" });
  if (typeof user === "string") return gateError(user);

  const { data: doc } = await supabaseAdmin
    .from("staff_documents")
    .select("id, storage_path")
    .eq("id", docId)
    .eq("staff_id", staffId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabaseAdmin.storage.from("staff-documents").remove([doc.storage_path]).catch((e) => {
    console.error("[staff-documents DELETE] storage remove failed", e);
  });

  const { error } = await supabaseAdmin
    .from("staff_documents")
    .delete()
    .eq("id", docId)
    .eq("staff_id", staffId);
  if (error) {
    console.error("[staff-documents DELETE] row delete failed", error.code);
    return NextResponse.json({ error: "Ekki tókst að eyða skjalinu." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
