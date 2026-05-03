import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

// Deferred: convert admin-created Biody placeholder clients into the
// full B2B onboarding flow so they complete the Icelandic consent +
// questionnaire wizard and overwrite the placeholder height / sex /
// activity with real data.
//
// Right now this endpoint is a preview — it LISTS the clients that
// would be converted (biody_placeholder_data = true AND
// company_id = target) but does not yet create company_members rows
// or send invites. Wiring the actual invite batch is a follow-up.

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("clients_decrypted")
    .select("id, email, full_name, phone, kennitala_last4, biody_patient_id, created_at")
    .eq("company_id", companyId)
    .eq("biody_placeholder_data", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pending: data || [] });
}

export async function POST() {
  // Placeholder — the actual conversion flow (creates company_members
  // rows with encrypted kennitala + sends B2B onboarding invites) will
  // be added when the team is ready to collect the real data from the
  // people already bulk-created with placeholders.
  return NextResponse.json(
    { error: "not_implemented", detail: "B2B conversion is planned — for now run the placeholder import and use the standard company roster flow to send invites." },
    { status: 501 },
  );
}
