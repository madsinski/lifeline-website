import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffAAL2, gateError } from "@/lib/auth-helpers";

// Bulk-delete platform_agreement_acceptances rows. Admin-only.
// Also removes any PDF certificate from the platform-acceptance-pdfs
// bucket. Destructive — the row is legal proof that a user clicked
// through a specific version of ToS/DPA/Employee-ToS/Health-consent.

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await requireStaffAAL2(req, { roles: ["admin"] });
  if (typeof user === "string") return gateError(user);

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  const all: boolean = body?.all === true;

  if (!all && ids.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }

  let targetIds: string[] = ids;
  if (all) {
    const { data } = await supabaseAdmin.from("platform_agreement_acceptances").select("id");
    targetIds = (data || []).map((r) => r.id as string);
  }

  const { data: toDelete } = await supabaseAdmin
    .from("platform_agreement_acceptances")
    .select("id, pdf_storage_path")
    .in("id", targetIds);

  const { error, count } = await supabaseAdmin
    .from("platform_agreement_acceptances")
    .delete({ count: "exact" })
    .in("id", targetIds);
  if (error) {
    console.error("[legal/acceptances/bulk-delete]", error?.code);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  const paths = (toDelete || []).map((r) => r.pdf_storage_path).filter((p): p is string => !!p);
  if (paths.length > 0) {
    await supabaseAdmin.storage.from("platform-acceptance-pdfs").remove(paths).catch((e) => {
      console.error("[acceptances bulk-delete] storage cleanup partial fail", e);
    });
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0, blobs_removed: paths.length });
}
