import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabaseAdmin
    .from("company_members")
    .select("id, company_id, completed_at")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Primary, co-admin, or staff
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("contact_person_id")
    .eq("id", member.company_id)
    .maybeSingle();
  const isPrimary = company?.contact_person_id === user.id;
  const { data: coAdmin } = await supabaseAdmin
    .from("company_admins")
    .select("user_id")
    .eq("company_id", member.company_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const staff = await isStaff(user.id);
  if (!isPrimary && !coAdmin && !staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Record the delete in the audit log before we drop the row
  await supabaseAdmin.rpc("log_kennitala_access", {
    p_actor_role: staff ? "staff" : "contact_person",
    p_scope: "last4",
    p_purpose: "member_delete",
    p_subject_kind: "company_member",
    p_subject_id: memberId,
    p_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
    p_user_agent: req.headers.get("user-agent") || "",
  });

  const { error } = await supabaseAdmin.from("company_members").delete().eq("id", memberId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
