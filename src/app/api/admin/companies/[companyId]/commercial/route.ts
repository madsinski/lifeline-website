import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export const maxDuration = 30;

// Per-company commercial settings set by Lifeline staff:
//   • assessment_unit_price  — custom per-assessment price shown on /sign + invoices
//   • app_enabled            — offer the Lifeline app subscription on the order
//   • app_price_isk_monthly  — monthly per-employee app price
//   • default_tier           — subscription tier employees get on onboarding (app access)
//
// Columns added by supabase/migration-b2b-app-subscription.sql. Mutations are
// AAL2-gated per the admin-write convention.

const ALLOWED_TIERS = ["free-trial", "self-maintained", "premium", "full-access"] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const patch: Record<string, unknown> = {};

  if ("assessment_unit_price" in body) {
    const v = body.assessment_unit_price;
    if (v === null) {
      patch.assessment_unit_price = null;
    } else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      patch.assessment_unit_price = Math.round(v);
    } else {
      return NextResponse.json({ error: "invalid_assessment_unit_price" }, { status: 400 });
    }
  }

  if ("app_enabled" in body) {
    if (typeof body.app_enabled !== "boolean") {
      return NextResponse.json({ error: "invalid_app_enabled" }, { status: 400 });
    }
    patch.app_enabled = body.app_enabled;
  }

  if ("app_price_isk_monthly" in body) {
    const v = body.app_price_isk_monthly;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: "invalid_app_price" }, { status: 400 });
    }
    patch.app_price_isk_monthly = Math.round(v);
  }

  if ("default_tier" in body) {
    const v = body.default_tier;
    if (v === null || v === "") {
      patch.default_tier = null;
    } else if (typeof v === "string" && (ALLOWED_TIERS as readonly string[]).includes(v)) {
      patch.default_tier = v;
    } else {
      return NextResponse.json({ error: "invalid_default_tier" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("companies")
    .update(patch)
    .eq("id", companyId)
    .select("id, assessment_unit_price, app_enabled, app_price_isk_monthly, default_tier")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, company: data });
}
