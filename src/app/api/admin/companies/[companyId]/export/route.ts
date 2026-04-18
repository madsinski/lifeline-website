import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

export const maxDuration = 30;

interface ExportRow {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  kennitala?: string | null;         // staff full
  kennitala_last4?: string | null;   // contact person
  invited_at: string | null;
  completed_at: string | null;
  created_at: string | null;
}

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

  // M4: one SQL call that decrypts server-side + logs a single audit row.
  // Route via a user-JWT supabase client so auth.uid() resolves inside the
  // security-definer RPC and the audit log ties the export to the caller.
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const { createClient } = await import("@supabase/supabase-js");
  const userSupabase = createClient(
    process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmliZnh6bHR4aXJpcXh2dnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQxMDgsImV4cCI6MjA5MDQ1MDEwOH0.LHBADsUdW7SBtrxZ9KikTmAl5brBGPb3gFTMuPYrmD8",
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );

  const rpc = staff ? "export_company_members_full" : "export_company_members_last4";
  const { data, error } = await userSupabase.rpc(rpc, { p_company_id: companyId });
  if (error) {
    console.error("[export] rpc failed", error);
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }

  const members = (data || []) as ExportRow[];
  const rows: string[] = [
    ["name", staff ? "kennitala" : "kennitala_last4", "email", "phone", "invited_at", "completed_at", "created_at"].join(","),
  ];
  for (const m of members) {
    rows.push([
      csv(m.full_name || ""),
      csv((staff ? m.kennitala : m.kennitala_last4) || ""),
      csv(m.email || ""),
      csv(m.phone || ""),
      csv(m.invited_at || ""),
      csv(m.completed_at || ""),
      csv(m.created_at || ""),
    ].join(","));
  }

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
