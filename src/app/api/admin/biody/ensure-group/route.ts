import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

const BIODY_SYNC_URL = process.env.BIODY_SYNC_URL ||
  "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/biody-sync";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body?.company_id;
  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  // Contact person for the company OR staff
  const { data: company } = await supabaseAdmin
    .from("companies").select("contact_person_id").eq("id", companyId).maybeSingle();
  if (!company) return NextResponse.json({ error: "company not found" }, { status: 404 });
  if (company.contact_person_id !== user.id && !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const res = await fetch(`${BIODY_SYNC_URL}/ensure-group`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ company_id: companyId }),
  });
  const j = await res.json().catch(() => ({}));
  return NextResponse.json(j, { status: res.ok ? 200 : 500 });
}
