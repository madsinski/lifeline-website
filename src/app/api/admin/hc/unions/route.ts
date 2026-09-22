// Unions (stéttarfélög / sjúkrasjóðir) — list + create.
// Schema: supabase/migration-health-journey.sql (hc_unions, hc_union_documents)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const [{ data: unions }, { data: docs }, { data: orders }] = await Promise.all([
    supabaseAdmin.from("hc_unions").select("*").order("name"),
    supabaseAdmin.from("hc_union_documents").select("id, union_id, kind, title, file_name, signed_at, valid_until, created_at").order("created_at", { ascending: false }),
    supabaseAdmin.from("hc_orders").select("union_id").not("union_id", "is", null),
  ]);
  const usage: Record<string, number> = {};
  for (const o of orders || []) usage[o.union_id] = (usage[o.union_id] || 0) + 1;
  const today = new Date().toISOString().slice(0, 10);
  return NextResponse.json({
    unions: (unions || []).map((u) => {
      const d = (docs || []).filter((x) => x.union_id === u.id);
      const agreement = d.find((x) => x.kind === "agreement" && x.signed_at && (!x.valid_until || x.valid_until >= today));
      return {
        ...u,
        documents: d,
        has_rules_doc: d.some((x) => x.kind === "rules"),
        signed_agreement: agreement ?? null,
        listed_at_checkout: u.cooperation_status === "approved" && !!agreement,
        orders: usage[u.id] || 0,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nafn vantar." }, { status: 400 });
  const code = (String(b.code || name))
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const { data, error } = await supabaseAdmin
    .from("hc_unions")
    .insert({ name, code, region: b.region || null, website: b.website || null })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ union: data });
}
