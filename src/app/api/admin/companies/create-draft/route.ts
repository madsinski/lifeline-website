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
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body: Body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const kennitala = (body.kennitala || "").replace(/\D/g, "");
  const contactEmail = (body.contact_draft_email || "").trim().toLowerCase();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (kennitala.length !== 10) {
    return NextResponse.json({ error: "kennitala must be 10 digits" }, { status: 400 });
  }
  if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    return NextResponse.json({ error: "invalid_contact_email" }, { status: 400 });
  }

  // Encrypt company kennitala via existing RPC for consistency with
  // self-serve signups.
  const { data: encData, error: encErr } = await supabaseAdmin.rpc("enc_kennitala", {
    p_text: kennitala,
  });
  if (encErr) {
    return NextResponse.json({ error: "kennitala_encrypt_failed", detail: encErr.message }, { status: 500 });
  }

  const insertPayload: Record<string, unknown> = {
    name,
    kennitala_encrypted: encData,
    contact_person_id: null,
    status: "draft",
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
