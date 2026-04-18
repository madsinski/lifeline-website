import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, contact_person_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not found" }, { status: 404 });

  const isOwner = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  if (!isOwner && !staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Contact persons get last-4 only; staff get the full value.
  const fullAccess = staff;

  const { data: members } = await supabaseAdmin
    .from("company_members")
    .select("id, full_name, email, phone, kennitala_encrypted, invited_at, completed_at, created_at")
    .eq("company_id", companyId)
    .order("created_at");

  const rows: string[] = [
    ["name", fullAccess ? "kennitala" : "kennitala_last4", "email", "phone", "invited_at", "completed_at", "created_at"].join(","),
  ];

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ua = req.headers.get("user-agent") || "";

  for (const m of members || []) {
    let kt = "";
    if (m.kennitala_encrypted) {
      const rpc = fullAccess ? "dec_kennitala" : "kennitala_last4";
      const { data: dec } = await supabaseAdmin.rpc(rpc, { p_enc: m.kennitala_encrypted });
      kt = (dec as string) || "";
      await supabaseAdmin.rpc("log_kennitala_access", {
        p_actor_role: staff ? "staff" : "contact_person",
        p_scope: fullAccess ? "full" : "last4",
        p_purpose: "csv_export",
        p_subject_kind: "company_member",
        p_subject_id: m.id,
        p_ip: ip,
        p_user_agent: ua,
      });
    }
    rows.push([
      csv(m.full_name),
      csv(kt),
      csv(m.email),
      csv(m.phone || ""),
      csv(m.invited_at || ""),
      csv(m.completed_at || ""),
      csv(m.created_at || ""),
    ].join(","));
  }

  // Prefix UTF-8 BOM so Excel opens Icelandic characters correctly.
  return new NextResponse("\ufeff" + rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(company.name)}-roster.csv"`,
    },
  });
}

function csv(v: string): string {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}
