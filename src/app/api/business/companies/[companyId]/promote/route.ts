import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const newPrimary: string | undefined = body?.user_id;
  if (!newPrimary) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  // Either current primary, or staff
  const { data: company } = await supabaseAdmin
    .from("companies").select("contact_person_id").eq("id", companyId).maybeSingle();
  if (!company) return NextResponse.json({ error: "company not found" }, { status: 404 });

  const isPrimary = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  if (!isPrimary && !staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Call the SECURITY DEFINER RPC, which re-validates and swaps atomically
  const { error } = await supabaseAdmin.rpc("promote_company_admin", {
    p_company_id: companyId,
    p_new_primary: newPrimary,
  });
  if (error) {
    return NextResponse.json({
      error: error.message.startsWith("target_not_co_admin") ? "target_not_co_admin" : "promote_failed",
    }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
