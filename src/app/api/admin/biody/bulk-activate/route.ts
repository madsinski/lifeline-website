import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { activateBiodyForClient } from "@/lib/biody";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const staff = await isStaff(user.id);
  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body?.company_id;
  const clientIds: string[] = Array.isArray(body?.client_ids) ? body.client_ids : [];

  if (!companyId && !clientIds.length) {
    return NextResponse.json({ error: "company_id or client_ids required" }, { status: 400 });
  }

  // Contact persons can bulk-activate their own company; staff can do anyone.
  let targets: Array<{ id: string }> = [];
  if (companyId) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, contact_person_id")
      .eq("id", companyId)
      .maybeSingle();
    if (!company) return NextResponse.json({ error: "company not found" }, { status: 404 });
    if (company.contact_person_id !== user.id && !staff) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { data: rows } = await supabaseAdmin
      .from("clients_decrypted")
      .select("id")
      .eq("company_id", companyId)
      .is("biody_patient_id", null);
    targets = rows || [];
  } else {
    if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    targets = clientIds.map((id) => ({ id }));
  }

  if (!targets.length) {
    return NextResponse.json({ ok: true, processed: 0, succeeded: 0, failed: 0, results: [] });
  }

  const CONCURRENCY = 3; // Biody backend can be slow; be gentle
  const results: Array<{ client_id: string; ok: boolean; error?: string }> = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const slice = targets.slice(i, i + CONCURRENCY);
    const slicedResults = await Promise.all(slice.map(async (t) => {
      const r = await activateBiodyForClient(t.id);
      return { client_id: t.id, ok: r.ok, error: r.ok ? undefined : String(r.error || "error") };
    }));
    results.push(...slicedResults);
  }

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
