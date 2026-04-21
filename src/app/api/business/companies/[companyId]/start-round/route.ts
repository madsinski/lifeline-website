import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;

  // Verify caller is contact person or staff
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Check permission: contact person or staff
  const [{ data: company }, { data: staffRow }] = await Promise.all([
    supabaseAdmin.from("companies").select("id, contact_person_id, name").eq("id", companyId).maybeSingle(),
    supabaseAdmin.from("staff").select("id").eq("id", user.id).eq("active", true).maybeSingle(),
  ]);
  if (!company) return NextResponse.json({ error: "company_not_found" }, { status: 404 });
  if (company.contact_person_id !== user.id && !staffRow) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const packageType = body?.package || "checkin";

  // Get the latest round number
  const { data: lastRound } = await supabaseAdmin
    .from("assessment_rounds")
    .select("round_number")
    .eq("company_id", companyId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextRoundNumber = (lastRound?.round_number || 0) + 1;

  // Create the new round
  const { data: newRound, error } = await supabaseAdmin
    .from("assessment_rounds")
    .insert({
      company_id: companyId,
      round_number: nextRoundNumber,
      package: packageType,
      status: "scheduling",
      started_at: new Date().toISOString(),
    })
    .select("id, round_number, package, status")
    .single();

  if (error) {
    return NextResponse.json({ error: "create_round_failed", detail: error.message }, { status: 500 });
  }

  // Update company's current round
  await supabaseAdmin.from("companies").update({
    current_round_id: newRound.id,
  }).eq("id", companyId);

  return NextResponse.json({
    ok: true,
    round: newRound,
  });
}
