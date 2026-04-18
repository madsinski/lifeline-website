import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

export const maxDuration = 60;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const deleteEmployees = url.searchParams.get("delete_employees") === "true";

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Load employee client_ids before we wipe the company_members (which would
  // cascade-delete) if the caller asked to purge employee accounts too.
  let employeeCount = 0;
  let employeeAuthDeleted = 0;
  if (deleteEmployees) {
    const { data: members } = await supabaseAdmin
      .from("company_members")
      .select("client_id")
      .eq("company_id", companyId)
      .not("client_id", "is", null);
    for (const m of members || []) {
      if (!m.client_id) continue;
      employeeCount++;
      const { error } = await supabaseAdmin.auth.admin.deleteUser(m.client_id);
      if (!error) employeeAuthDeleted++;
    }
  }

  // Audit: one row per delete, scoped to the company
  await supabaseAdmin.rpc("log_kennitala_access", {
    p_actor_role: "staff",
    p_scope: "full",
    p_purpose: deleteEmployees ? "company_delete_with_employees" : "company_delete",
    p_subject_kind: "company",
    p_subject_id: companyId,
    p_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
    p_user_agent: req.headers.get("user-agent") || "",
  });

  // Delete the company — cascade-deletes company_members + company_admins.
  const { error } = await supabaseAdmin.from("companies").delete().eq("id", companyId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    company_id: companyId,
    company_name: company.name,
    employees_found: employeeCount,
    employees_deleted: employeeAuthDeleted,
  });
}
