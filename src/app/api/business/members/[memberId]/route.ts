import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

// Edit a roster member's contact details (name / email / phone). Same
// authorization as DELETE below: company primary contact, co-admin, or
// staff. Kennitala edits are deliberately not supported here — remove
// and re-add the member if the kennitala itself was wrong.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabaseAdmin
    .from("company_members")
    .select("id, company_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "not_found" }, { status: 404 });

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

  const body = await req.json().catch(() => ({}));
  const update: Record<string, string | null> = {};
  if (typeof body.full_name === "string") {
    const v = body.full_name.trim();
    if (!v) return NextResponse.json({ error: "name_required" }, { status: 400 });
    update.full_name = v;
  }
  if (typeof body.email === "string") {
    const v = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    update.email = v;
  }
  if (typeof body.phone === "string" || body.phone === null) {
    const v = typeof body.phone === "string" ? body.phone.trim() : "";
    update.phone = v || null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("company_members")
    .update(update)
    .eq("id", memberId)
    .select("id, full_name, email, phone")
    .single();
  if (error) {
    const msg = error.code === "23505" ? "email_taken" : "update_failed";
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, member: updated });
}

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
