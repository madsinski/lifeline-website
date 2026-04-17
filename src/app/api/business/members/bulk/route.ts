import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { generatePassword } from "@/lib/parse-roster";
import { cleanKennitala, isValidKennitala } from "@/lib/kennitala";

interface IncomingRow {
  full_name: string;
  email: string;
  phone?: string | null;
  kennitala: string;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body?.company_id;
  const rows: IncomingRow[] = Array.isArray(body?.rows) ? body.rows : [];

  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });
  if (!rows.length) return NextResponse.json({ error: "rows required" }, { status: 400 });

  // Verify caller owns the company (or is staff)
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, contact_person_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "company not found" }, { status: 404 });
  const isOwner = company.contact_person_id === user.id;
  if (!isOwner) {
    const { data: staff } = await supabaseAdmin.from("staff").select("id").eq("id", user.id).eq("active", true).maybeSingle();
    if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const results: Array<{ email: string; id?: string; password?: string; error?: string }> = [];

  for (const r of rows) {
    const kennitala = cleanKennitala(r.kennitala);
    if (!isValidKennitala(kennitala)) {
      results.push({ email: r.email, error: "invalid kennitala" });
      continue;
    }
    if (!r.full_name?.trim() || !r.email?.trim()) {
      results.push({ email: r.email, error: "missing name or email" });
      continue;
    }

    // Encrypt + hash
    const { data: enc, error: encErr } = await supabaseAdmin.rpc("enc_kennitala", { p_text: kennitala });
    if (encErr) {
      results.push({ email: r.email, error: encErr.message });
      continue;
    }
    const password = generatePassword();

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("company_members")
      .insert({
        company_id: companyId,
        full_name: r.full_name.trim(),
        email: r.email.trim().toLowerCase(),
        phone: r.phone || null,
        kennitala_encrypted: enc,
        invite_password_hash: "pending",
      })
      .select("id")
      .single();

    if (insErr) {
      results.push({ email: r.email, error: insErr.message });
      continue;
    }

    const { error: pwErr } = await supabaseAdmin.rpc("set_member_invite_password", {
      p_member_id: inserted.id,
      p_password: password,
    });
    if (pwErr) {
      results.push({ email: r.email, error: pwErr.message });
      continue;
    }
    results.push({ email: r.email, id: inserted.id, password });
  }

  return NextResponse.json({
    inserted: results.filter((r) => r.id).length,
    failed: results.filter((r) => r.error).length,
    results,
  });
}
