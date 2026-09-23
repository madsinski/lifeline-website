// Client groups — companies, from the nurse's side.
//
// The full commercial record (agreements, tiers, pricing, rounds) is
// /admin/business and stays there. What a nurse needs is narrower: which
// groups exist, who is in them, and the ability to enter a new one when a
// workplace turns up without having been set up first.
//
// GET  → groups with their members
// POST { name, contact_name?, contact_email?, contact_phone?, address? }
//        → a new group, status 'draft', for /admin/business to finish
//
// Actor: workstation session or Lifeline staff.
// Reference: src/app/admin/business (the same companies table).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";
import { hcAudit } from "@/lib/hc/server";

export const runtime = "nodejs";

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: companies } = await supabaseAdmin
    .from("companies")
    .select("id, name, status, company_phone, contact_draft_name, contact_draft_email, contact_phone, created_at")
    .order("name");

  // Members come off clients.company_id, which is what marks a B2B employee.
  const { data: members } = await supabaseAdmin
    .from("clients_decrypted")
    .select("id, full_name, company_id")
    .not("company_id", "is", null)
    .limit(2000);

  const byCompany = new Map<string, { id: string; full_name: string | null }[]>();
  for (const m of members ?? []) {
    if (!m.company_id) continue;
    const list = byCompany.get(m.company_id) ?? [];
    list.push({ id: m.id, full_name: m.full_name });
    byCompany.set(m.company_id, list);
  }

  const groups = (companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    contact: c.contact_draft_name ?? null,
    email: c.contact_draft_email ?? null,
    phone: c.contact_phone ?? c.company_phone ?? null,
    members: (byCompany.get(c.id) ?? []).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "is")),
  }));
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = str(body.name, 200);
  if (!name) return NextResponse.json({ error: "Nafn hópsins vantar." }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from("companies").select("id").ilike("name", name).maybeSingle();
  if (existing) return NextResponse.json({ error: "Hópur með þessu nafni er þegar til." }, { status: 409 });

  // 'draft' on purpose: the commercial side is filled in on /admin/business,
  // and a nurse should not be setting prices.
  const { data, error } = await supabaseAdmin
    .from("companies")
    .insert({
      name,
      status: "draft",
      contact_draft_name: str(body.contact_name, 200),
      contact_draft_email: str(body.contact_email, 200)?.toLowerCase() ?? null,
      contact_phone: str(body.contact_phone, 40),
      company_address: str(body.address, 300),
    })
    .select("id, name, status")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await hcAudit(actor.label, "client_group_created", null, { company: data?.id, name });
  return NextResponse.json({ group: { ...data, contact: str(body.contact_name, 200), members: [] } });
}
