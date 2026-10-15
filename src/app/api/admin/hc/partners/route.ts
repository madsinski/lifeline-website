// The Vera heilsusetur partner register (admin → Heilsuferð → Samstarfsaðilar).
// GET → all partners (staff). POST { name, profession, email, phone?, organization?, note? }
// → add; PATCH { id, ...fields, active? } → edit / deactivate. Writes: admin + MFA.
// Schema: supabase/migration-hc-partners.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import { hcAudit } from "@/lib/hc/server";
import { PARTNER_TARGETS } from "@/lib/hc/referrals";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function fields(b: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  const name = str(b.name, 120), email = str(b.email, 200)?.toLowerCase() ?? null;
  const profession = typeof b.profession === "string" && (PARTNER_TARGETS as readonly string[]).includes(b.profession) ? b.profession : null;
  if (name || !partial) out.name = name;
  if (email || !partial) out.email = email;
  if (profession || !partial) out.profession = profession;
  if ("phone" in b) out.phone = str(b.phone, 40);
  if ("note" in b) out.note = str(b.note, 500);
  if ("organization" in b && str(b.organization, 120)) out.organization = str(b.organization, 120);
  if (typeof b.active === "boolean") out.active = b.active;
  if (!partial && (!out.name || !out.profession || !out.email)) return { error: "Nafn, starfsgrein og netfang þurfa að vera skráð." };
  if (out.email && !EMAIL_RE.test(String(out.email))) return { error: "Netfangið er ekki gilt." };
  return { data: out };
}

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const { data } = await supabaseAdmin.from("hc_partners").select("*").order("profession").order("name");
  return NextResponse.json({ partners: data ?? [] });
}

export async function POST(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const f = fields(await req.json().catch(() => ({})), false);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("hc_partners").insert(f.data).select("*").single();
  if (error) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 400 });
  await hcAudit(`staff:${g.id}`, "partner_added", null, { partner_id: data.id });
  return NextResponse.json({ partner: data });
}

export async function PATCH(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  if (typeof b.id !== "string") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const f = fields(b, true);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("hc_partners")
    .update({ ...f.data, updated_at: new Date().toISOString() }).eq("id", b.id).select("*").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 400 });
  await hcAudit(`staff:${g.id}`, "partner_updated", null, { partner_id: b.id, fields: Object.keys(f.data) });
  return NextResponse.json({ partner: data });
}
