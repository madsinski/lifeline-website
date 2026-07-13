import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

// Backed by supabase/migration-body-comp-days.sql
// Lyfja walk-in measurement days (mirrors /api/business/blood-test-days).

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body?.company_id;
  const days: string[] = Array.isArray(body?.days) ? body.days : [];
  const notes: string | null = body?.notes || null;
  if (!companyId || !days.length) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, contact_person_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isPrimary = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  let isCoAdmin = false;
  if (!isPrimary && !staff) {
    const { data: ca } = await supabaseAdmin
      .from("company_admins").select("user_id")
      .eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
    isCoAdmin = !!ca;
  }
  if (!isPrimary && !staff && !isCoAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = days.map((day) => ({
    company_id: companyId,
    day,
    notes,
    created_by: user.id,
  }));
  const { error: insErr } = await supabaseAdmin
    .from("body_comp_days")
    .upsert(rows, { onConflict: "company_id, day", ignoreDuplicates: true })
    .select("day");
  if (insErr) {
    console.error("[body-comp-days] insert", insErr);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: days.length });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  const id = url.searchParams.get("id");
  if (!companyId || !id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const { data: company } = await supabaseAdmin
    .from("companies").select("id, contact_person_id").eq("id", companyId).maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isPrimary = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  let isCoAdmin = false;
  if (!isPrimary && !staff) {
    const { data: ca } = await supabaseAdmin
      .from("company_admins").select("user_id")
      .eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
    isCoAdmin = !!ca;
  }
  if (!isPrimary && !staff && !isCoAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("body_comp_days").delete().eq("id", id).eq("company_id", companyId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
