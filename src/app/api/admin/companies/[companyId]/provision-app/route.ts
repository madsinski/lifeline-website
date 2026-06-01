import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export const maxDuration = 60;

// Grant app access to a company's already-onboarded employees by creating an
// active subscription for each, using the company's default_tier. Employees
// who onboard *after* this is set get their subscription automatically at
// onboarding (see /api/business/onboard/[token]/complete). This endpoint
// backfills the ones who already have a client account (client_id set).
//
// Mirrors the subscriptions.upsert in the onboarding route. AAL2-gated.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, default_tier")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!company.default_tier) {
    return NextResponse.json(
      { error: "no_tier", detail: "Set a default tier (e.g. premium) on the company before provisioning app access." },
      { status: 400 },
    );
  }

  // Onboarded employees only — those with a client account.
  const { data: members, error: memErr } = await supabaseAdmin
    .from("company_members")
    .select("client_id")
    .eq("company_id", companyId)
    .not("client_id", "is", null);
  if (memErr) return NextResponse.json({ error: "members_query_failed", detail: memErr.message }, { status: 500 });

  const clientIds = Array.from(new Set((members || []).map((m) => m.client_id as string).filter(Boolean)));
  if (clientIds.length === 0) {
    return NextResponse.json({ ok: true, tier: company.default_tier, provisioned: 0, eligible: 0 });
  }

  const now = new Date().toISOString();
  const rows = clientIds.map((client_id) => ({
    client_id,
    tier: company.default_tier as string,
    status: "active",
    current_period_start: now,
  }));

  const { error: upErr } = await supabaseAdmin
    .from("subscriptions")
    .upsert(rows, { onConflict: "client_id" });
  if (upErr) return NextResponse.json({ error: "provision_failed", detail: upErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    tier: company.default_tier,
    eligible: clientIds.length,
    provisioned: clientIds.length,
  });
}
