import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import {
  STAFF_DOC_REGISTRY,
  requiredAgreementsForStaff,
  type StaffRoleLabel,
  type EmploymentType,
} from "@/lib/staff-terms-content";

// List the signing state for the current staff member.
// Returns: { role, required: [...], signed: [...], pending: [...] }
// where pending = required - signed-at-current-version.

export const maxDuration = 30;

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, name, role, employment_type, active")
    .eq("id", user.id)
    .maybeSingle();
  if (!staffRow || !staffRow.active) {
    return NextResponse.json({ error: "not_active_staff" }, { status: 403 });
  }

  const role = (staffRow.role as StaffRoleLabel) || "coach";
  const employmentType = (staffRow.employment_type as EmploymentType | null) || null;
  const required = requiredAgreementsForStaff(role, employmentType);

  const { data: signedRows } = await supabaseAdmin
    .from("staff_agreement_acceptances")
    .select("id, document_key, document_version, text_hash, accepted_at, pdf_storage_path")
    .eq("staff_id", user.id)
    .order("accepted_at", { ascending: false });

  // "Signed" means: there exists a row for this staff_id + document_key
  // at the CURRENT version. Older versions count as historical but not
  // as satisfying the requirement.
  const signedByKey = new Map<string, { id: string; version: string; accepted_at: string; pdf_storage_path: string | null; text_hash: string }>();
  for (const r of signedRows || []) {
    const key = r.document_key as string;
    const version = r.document_version as string;
    const existing = signedByKey.get(key);
    if (!existing || new Date(r.accepted_at).getTime() > new Date(existing.accepted_at).getTime()) {
      signedByKey.set(key, {
        id: r.id as string,
        version,
        accepted_at: r.accepted_at as string,
        pdf_storage_path: r.pdf_storage_path as string | null,
        text_hash: r.text_hash as string,
      });
    }
  }

  const pending: Array<{ key: string; version: string; title: string; text: string; text_hash: string }> = [];
  const signed: Array<{ key: string; version: string; title: string; accepted_at: string; up_to_date: boolean; pdf_storage_path: string | null }> = [];

  for (const req of required) {
    const meta = STAFF_DOC_REGISTRY[req.key];
    const text = meta.render();
    const hash = sha256(text);
    const latest = signedByKey.get(req.key);
    const upToDate = !!latest && latest.version === req.version && latest.text_hash === hash;
    if (!upToDate) {
      pending.push({ key: req.key, version: req.version, title: req.title, text, text_hash: hash });
    }
    if (latest) {
      signed.push({
        key: req.key,
        version: latest.version,
        title: req.title,
        accepted_at: latest.accepted_at,
        up_to_date: upToDate,
        pdf_storage_path: latest.pdf_storage_path,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    role,
    employment_type: employmentType,
    name: staffRow.name,
    required: required.map((r) => ({ key: r.key, version: r.version, title: r.title })),
    pending,
    signed,
  });
}
