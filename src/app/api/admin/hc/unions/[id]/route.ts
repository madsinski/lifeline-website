// One union: update rules/contact/status, or delete.
// Approving (cooperation_status = 'approved') requires a signed agreement on
// file — the checkout gate checks it too, this just gives a clear error.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import { hcAudit } from "@/lib/hc/server";
import type { UnionRules } from "@/lib/hc/reimbursement";

export const runtime = "nodejs";

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function cleanRules(r: unknown): UnionRules {
  const src = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
  const cats = (src.categories && typeof src.categories === "object" ? src.categories : {}) as Record<string, Record<string, unknown>>;
  const categories: UnionRules["categories"] = {};
  for (const [k, v] of Object.entries(cats)) {
    if (!v || typeof v !== "object") continue;
    categories[k] = {
      percent: num(v.percent),
      max_isk: num(v.max_isk),
      fixed_isk: num(v.fixed_isk),
      period_months: num(v.period_months),
      min_membership_months: num(v.min_membership_months),
      notes: typeof v.notes === "string" ? v.notes.slice(0, 1000) : null,
    };
  }
  return {
    categories,
    requires_receipt: !!src.requires_receipt,
    application_notes: typeof src.application_notes === "string" ? src.application_notes.slice(0, 2000) : null,
  };
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const id = (await ctx.params).id;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["name", "kennitala", "region", "website", "contact_name", "contact_role", "contact_email", "contact_phone", "rules_summary", "notes"]) {
    if (k in b) patch[k] = typeof b[k] === "string" && b[k].trim() ? b[k].trim() : null;
  }
  if ("rules" in b) {
    patch.rules = cleanRules(b.rules);
    patch.rules_verified_at = new Date().toISOString().slice(0, 10);
  }
  if ("settlement" in b && ["reimbursement", "direct"].includes(b.settlement)) patch.settlement = b.settlement;
  if ("cooperation_status" in b && ["none", "negotiating", "approved", "paused"].includes(b.cooperation_status)) {
    if (b.cooperation_status === "approved") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: docs } = await supabaseAdmin.from("hc_union_documents").select("signed_at, valid_until").eq("union_id", id).eq("kind", "agreement");
      const signed = (docs || []).some((d) => d.signed_at && (!d.valid_until || d.valid_until >= today));
      if (!signed) return NextResponse.json({ error: "Hlaða þarf upp undirrituðum samningi (með undirritunardegi) áður en félagið er samþykkt." }, { status: 409 });
    }
    patch.cooperation_status = b.cooperation_status;
  }
  if (typeof patch.contact_email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.contact_email)) {
    return NextResponse.json({ error: "Netfang móttakanda er ekki gilt." }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from("hc_unions").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await hcAudit(`staff:${g.email}`, "union_updated", null, { union_id: id, fields: Object.keys(patch) });
  return NextResponse.json({ union: data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const id = (await ctx.params).id;
  const { count } = await supabaseAdmin.from("hc_orders").select("id", { count: "exact", head: true }).eq("union_id", id);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "Félagið tengist pöntunum. Settu það í bið í stað þess að eyða því." }, { status: 409 });
  const { data: docs } = await supabaseAdmin.from("hc_union_documents").select("storage_path").eq("union_id", id);
  if (docs?.length) await supabaseAdmin.storage.from("union-documents").remove(docs.map((d) => d.storage_path));
  const { error } = await supabaseAdmin.from("hc_unions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
