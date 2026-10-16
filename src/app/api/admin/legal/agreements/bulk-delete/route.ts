import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffAAL2, gateError } from "@/lib/auth-helpers";

// Bulk-delete commercial B2B agreements. Also removes any per-
// agreement purchase orders + storage blob. Admin-only.
//
// NOTE: deleting agreements is destructive — the row is the legal
// evidence that a company signed a specific version of the service
// contract. Use for cleanup/test data; don't mass-delete live rows.

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await requireStaffAAL2(req, { roles: ["admin"], permission: "manage_team" });
  if (typeof user === "string") return gateError(user);

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  const all: boolean = body?.all === true;

  if (!all && ids.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }

  // Pull storage paths so we can clean up blobs after the delete.
  let targetIds: string[] = ids;
  if (all) {
    const { data } = await supabaseAdmin.from("b2b_agreements").select("id");
    targetIds = (data || []).map((r) => r.id as string);
  }
  const { data: toDelete } = await supabaseAdmin
    .from("b2b_agreements")
    .select("id, pdf_storage_path")
    .in("id", targetIds);

  // Child rows first — POs reference agreements.
  await supabaseAdmin.from("b2b_purchase_orders").delete().in("agreement_id", targetIds);

  const { error, count } = await supabaseAdmin
    .from("b2b_agreements")
    .delete({ count: "exact" })
    .in("id", targetIds);
  if (error) {
    console.error("[legal/agreements/bulk-delete]", error?.code);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // Storage cleanup best-effort. Bucket name "b2b-signed-documents"
  // per the existing download path in /admin/legal.
  const paths = (toDelete || []).map((r) => r.pdf_storage_path).filter((p): p is string => !!p);
  if (paths.length > 0) {
    await supabaseAdmin.storage.from("b2b-signed-documents").remove(paths).catch((e) => {
      console.error("[agreements bulk-delete] storage cleanup partial fail", e);
    });
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0, blobs_removed: paths.length });
}
