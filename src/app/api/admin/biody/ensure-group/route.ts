import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2, gateError } from "@/lib/auth-helpers";
import { signBiodyHeaders } from "@/lib/biody";

const BIODY_SYNC_URL = process.env.BIODY_SYNC_URL ||
  "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/biody-sync";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }
  // Staff-only + MFA (only caller is /admin/companies).
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") return gateError(user);

  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body?.company_id;
  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const { data: company } = await supabaseAdmin
    .from("companies").select("id").eq("id", companyId).maybeSingle();
  if (!company) return NextResponse.json({ error: "company not found" }, { status: 404 });

  const bodyText = JSON.stringify({ company_id: companyId });
  const res = await fetch(`${BIODY_SYNC_URL}/ensure-group`, {
    method: "POST",
    headers: signBiodyHeaders(bodyText),
    body: bodyText,
  });
  const j = await res.json().catch(() => ({}));
  return NextResponse.json(j, { status: res.ok ? 200 : 500 });
}
