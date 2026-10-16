import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2, gateError } from "@/lib/auth-helpers";
import { activateBiodyForClient } from "@/lib/biody";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Staff-only + MFA. (Company contact persons used to be allowed here, but
  // the only caller is /admin/companies; the business portal never used it.)
  const gate = await requireAdminAAL2(req);
  if (typeof gate === "string") return gateError(gate);
  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body?.company_id;
  const clientIds: string[] = Array.isArray(body?.client_ids) ? body.client_ids : [];

  if (!companyId && !clientIds.length) {
    return NextResponse.json({ error: "company_id or client_ids required" }, { status: 400 });
  }

  let targets: Array<{ id: string }> = [];
  if (companyId) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();
    if (!company) return NextResponse.json({ error: "company not found" }, { status: 404 });
    const { data: rows } = await supabaseAdmin
      .from("clients_decrypted")
      .select("id")
      .eq("company_id", companyId)
      .is("biody_patient_id", null);
    targets = rows || [];
  } else {
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
