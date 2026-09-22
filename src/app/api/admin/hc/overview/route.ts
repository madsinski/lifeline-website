// Admin overview of the health-check journey: stage funnel, recent
// journeys, packages and locations. PUT updates a package or a location.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const [{ data: journeys }, { data: packages }, { data: locations }, { data: orders }] = await Promise.all([
    supabaseAdmin.from("hc_journeys").select("id, client_id, location_id, stage, entry, created_at, updated_at, paid_at, report_sms_sent_at, referral_to_heilsugaesla").is("cancelled_at", null).order("updated_at", { ascending: false }).limit(500),
    supabaseAdmin.from("hc_packages").select("*").order("sort"),
    supabaseAdmin.from("hc_locations").select("*").order("name"),
    supabaseAdmin.from("hc_orders").select("payment_route, amount_charged_isk, price_isk, union_reimbursement_isk, created_at").eq("status", "paid"),
  ]);
  const ids = Array.from(new Set((journeys || []).map((j) => j.client_id)));
  const names: Record<string, string | null> = {};
  if (ids.length) {
    const { data } = await supabaseAdmin.from("clients_decrypted").select("id, full_name").in("id", ids);
    for (const c of data || []) names[c.id] = c.full_name;
  }
  const funnel: Record<string, number> = {};
  for (const j of journeys || []) funnel[j.stage] = (funnel[j.stage] || 0) + 1;
  const revenue = { self: 0, union: 0, company: 0, count: 0 };
  for (const o of orders || []) {
    revenue.count++;
    const k = o.payment_route as "self" | "union" | "company";
    if (k in revenue) revenue[k] += k === "company" ? o.price_isk : o.amount_charged_isk;
  }
  return NextResponse.json({
    funnel,
    revenue,
    journeys: (journeys || []).slice(0, 100).map((j) => ({ ...j, client_name: names[j.client_id] ?? null })),
    packages: packages || [],
    locations: locations || [],
  });
}

export async function PUT(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  if (b.type === "package" && typeof b.key === "string") {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof b.name === "string") patch.name = b.name.trim();
    if (typeof b.tagline === "string") patch.tagline = b.tagline.trim() || null;
    if (typeof b.description === "string") patch.description = b.description.trim() || null;
    if (Array.isArray(b.includes)) patch.includes = b.includes.map(String).filter(Boolean).slice(0, 20);
    if (Number.isFinite(Number(b.price_isk))) patch.price_isk = Math.max(0, Math.round(Number(b.price_isk)));
    if (typeof b.active === "boolean") patch.active = b.active;
    const { data, error } = await supabaseAdmin.from("hc_packages").update(patch).eq("key", b.key).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ package: data });
  }
  if (b.type === "location" && typeof b.id === "string") {
    const patch: Record<string, unknown> = {};
    for (const k of ["name", "region", "blood_test_site", "blood_test_address", "blood_test_info", "measurement_site", "measurement_address", "measurement_info", "interview_site", "interview_address", "patient_portal_url"]) {
      if (typeof b[k] === "string") patch[k] = b[k].trim() || null;
    }
    if (typeof b.active === "boolean") patch.active = b.active;
    const { data, error } = await supabaseAdmin.from("hc_locations").update(patch).eq("id", b.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ location: data });
  }
  if (b.type === "new_location" && typeof b.slug === "string" && typeof b.name === "string") {
    const { data, error } = await supabaseAdmin.from("hc_locations").insert({ slug: b.slug.trim().toLowerCase(), name: b.name.trim() }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ location: data });
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
