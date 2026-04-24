import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";

// Delete a bespoke staff document. Admin / manage_team only.
// Removes the storage blob + the row.

export const maxDuration = 30;

async function canManage(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("role, permissions, active")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.active && (data.role === "admin" || (Array.isArray(data.permissions) && (data.permissions as string[]).includes("manage_team")));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ staffId: string; docId: string }> },
) {
  const { staffId, docId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canManage(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

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
  if (error) return NextResponse.json({ error: "delete_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
