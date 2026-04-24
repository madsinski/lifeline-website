import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

// Admin view of a specific staff member's agreement-acceptance history.
// Used by the team panel: list signed, pending, historical versions.
// Admin-only (we scope visibility — peers don't see each other's PDFs).

export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> },
) {
  const { staffId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Admin or manage_team required.
  const { data: me } = await supabaseAdmin
    .from("staff")
    .select("role, permissions, active")
    .eq("id", user.id)
    .maybeSingle();
  const canManage = !!me?.active && (me.role === "admin" || (Array.isArray(me.permissions) && (me.permissions as string[]).includes("manage_team")));
  if (!canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: rows, error } = await supabaseAdmin
    .from("staff_agreement_acceptances")
    .select("id, document_key, document_version, document_title, text_hash, accepted_at, ip, user_agent, pdf_storage_path, typed_signature")
    .eq("staff_id", staffId)
    .order("accepted_at", { ascending: false });
  if (error) return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });

  // Short-lived signed URLs for any available PDFs so the admin UI can
  // render a direct download link without another round-trip.
  const withUrls = await Promise.all(
    (rows || []).map(async (r) => {
      if (!r.pdf_storage_path) return { ...r, signed_url: null };
      const { data } = await supabaseAdmin.storage
        .from("staff-acceptance-pdfs")
        .createSignedUrl(r.pdf_storage_path, 300);
      return { ...r, signed_url: data?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ ok: true, acceptances: withUrls });
}

// Used for forcing a re-sign (bumping version) or deleting bogus rows.
// Scope: only admin. Deleting an acceptance doesn't delete the underlying
// PDF (keep as audit bread-crumbs); use Supabase Storage directly to
// remove the blob if you really need to.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> },
) {
  const { staffId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: me } = await supabaseAdmin.from("staff").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 });

  const url = new URL(req.url);
  const acceptanceId = url.searchParams.get("id");
  if (!acceptanceId) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("staff_agreement_acceptances")
    .delete()
    .eq("id", acceptanceId)
    .eq("staff_id", staffId);
  if (error) return NextResponse.json({ error: "delete_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
