import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

// Create a draft company from the admin side. Used for:
//   • Pre-existing customers who haven't onboarded themselves yet
//   • Staging a Biody patient group before bulk-uploading placeholder
//     clients for a company that will formally onboard later
//
// The draft sits with status='draft' and contact_person_id=null until
// /api/admin/companies/[id]/invite-contact sends the claim email and
// the contact signs the TOS + DPA via /business/claim/[token].

export const maxDuration = 30;

type Body = {
  name?: string;
  kennitala?: string;                  // 10 digits, with or without hyphen
  company_address?: string;
  company_phone?: string;
  default_tier?: "standard" | "plus" | "custom" | null;
  assessment_unit_price?: number | null; // ISK per employee
  contact_draft_name?: string;
  contact_draft_email?: string;
  contact_draft_phone?: string;
  contact_draft_role?: string;
  admin_notes?: string;
  // Parent company (null for top-level). When set, the billing
  // contact fields are ignored — billing walks up to the parent.
  parent_company_id?: string | null;
  // Billing contact (only meaningful on top-level / parent rows).
  billing_contact_name?: string;
  billing_contact_email?: string;
  billing_contact_phone?: string;
  billing_contact_role?: string;
  billing_address?: string;
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body: Body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const kennitala = (body.kennitala || "").replace(/\D/g, "");
  const contactEmail = (body.contact_draft_email || "").trim().toLowerCase();
  const parentIdRaw = (body.parent_company_id || "").trim();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  // Kennitala is required for top-level companies only. Sub-companies
  // (municipal schools, departments, etc.) use the parent's kennitala
  // for billing and don't have one of their own.
  if (!parentIdRaw && kennitala.length !== 10) {
    return NextResponse.json({ error: "kennitala must be 10 digits for top-level companies" }, { status: 400 });
  }
  if (parentIdRaw && kennitala && kennitala.length !== 10) {
    return NextResponse.json({ error: "kennitala must be 10 digits if provided" }, { status: 400 });
  }
  if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    return NextResponse.json({ error: "invalid_contact_email" }, { status: 400 });
  }

  // Encrypt company kennitala via existing RPC for consistency with
  // self-serve signups. Skipped when the sub didn't provide one.
  let encData: unknown = null;
  if (kennitala) {
    const { data, error: encErr } = await supabaseAdmin.rpc("enc_kennitala", {
      p_text: kennitala,
    });
    if (encErr) {
      return NextResponse.json({ error: "kennitala_encrypt_failed", detail: encErr.message }, { status: 500 });
    }
    encData = data;
  }

  // Validate parent_company_id (if provided) — must exist and be top-level.
  const parentId = parentIdRaw || null;
  if (parentId) {
    const { data: parent } = await supabaseAdmin
      .from("companies")
      .select("id, parent_company_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) return NextResponse.json({ error: "parent_not_found" }, { status: 400 });
    if (parent.parent_company_id) {
      return NextResponse.json({ error: "parent_is_itself_a_sub", detail: "Only one level of nesting is allowed." }, { status: 400 });
    }
  }

  const insertPayload: Record<string, unknown> = {
    name,
    kennitala_encrypted: encData,
    contact_person_id: null,
    status: "draft",
    parent_company_id: parentId,
    company_address: body.company_address?.trim() || null,
    company_phone: body.company_phone?.trim() || null,
    default_tier: body.default_tier || null,
    contact_draft_name: body.contact_draft_name?.trim() || null,
    contact_draft_email: contactEmail || null,
    contact_draft_phone: body.contact_draft_phone?.trim() || null,
    contact_draft_role: body.contact_draft_role?.trim() || null,
    admin_notes: body.admin_notes?.trim() || null,
    created_by_admin_id: user.id,
  };
  // Billing contact is only meaningful on top-level companies. Subs
  // inherit via walk-up to their parent, so we silently drop those
  // fields when parent is set.
  if (!parentId) {
    insertPayload.billing_contact_name = body.billing_contact_name?.trim() || null;
    insertPayload.billing_contact_email = body.billing_contact_email?.trim().toLowerCase() || null;
    insertPayload.billing_contact_phone = body.billing_contact_phone?.trim() || null;
    insertPayload.billing_contact_role = body.billing_contact_role?.trim() || null;
    insertPayload.billing_address = body.billing_address?.trim() || null;
  }
  if (typeof body.assessment_unit_price === "number" && body.assessment_unit_price >= 0) {
    insertPayload.assessment_unit_price = body.assessment_unit_price;
  }

  const { data, error } = await supabaseAdmin
    .from("companies")
    .insert(insertPayload)
    .select("id, name, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "create_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, company: data });
}
