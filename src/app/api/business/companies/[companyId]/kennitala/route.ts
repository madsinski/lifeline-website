import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

// Returns the company's formatted kennitala (XXXXXX-XXXX) to the contact
// person or active staff. Used by the signing page to show what they are
// committing on behalf of.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, contact_person_id, kennitala_encrypted")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isPrimary = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  if (!isPrimary && !staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: raw } = await supabaseAdmin.rpc("dec_kennitala", { p_enc: company.kennitala_encrypted });
  const kn = (raw as string | null) || "";
  const formatted = kn.length === 10 ? `${kn.slice(0, 6)}-${kn.slice(6)}` : kn;
  return NextResponse.json({ kennitala: formatted });
}
