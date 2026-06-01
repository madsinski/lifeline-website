import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export const maxDuration = 30;

// Staff approve/reject a company's introduction-lecture proposal. Unlike the
// doctor-interview approval, there are no slots to generate — the lecture is a
// single company-wide event, so we just flip the approval status.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const user = auth;

  const body = await req.json().catch(() => ({}));
  const action = body?.action === "reject" ? "reject" : "approve";
  const note = (body?.note || "").trim() || null;

  const { data: lecture } = await supabaseAdmin
    .from("intro_lectures")
    .select("id, approval_status")
    .eq("id", id)
    .maybeSingle();
  if (!lecture) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("intro_lectures")
    .update({
      approval_status: action === "approve" ? "approved" : "rejected",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      admin_note: note,
    })
    .eq("id", id);
  if (error) {
    console.error("[intro-lectures] approve update failed", error);
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, approval_status: action === "approve" ? "approved" : "rejected" });
}
