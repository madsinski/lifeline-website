import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { generatePassword } from "@/lib/parse-roster";
import { cleanKennitala, isValidKennitala } from "@/lib/kennitala";

export const maxDuration = 60; // seconds — give Vercel room for bigger batches

interface IncomingRow {
  full_name: string;
  email: string;
  phone?: string | null;
  kennitala: string;
}

interface RowResult {
  email: string;
  id?: string;
  password?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body?.company_id;
  const rows: IncomingRow[] = Array.isArray(body?.rows) ? body.rows : [];

  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });
  if (!rows.length) return NextResponse.json({ error: "rows required" }, { status: 400 });
  if (rows.length > 500) return NextResponse.json({ error: "max 500 rows per import" }, { status: 400 });

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

  // Process rows in parallel with controlled concurrency (10 at a time).
  const CONCURRENCY = 10;
  const results: RowResult[] = new Array(rows.length);

  async function processRow(r: IncomingRow, idx: number): Promise<void> {
    const email = (r.email || "").trim().toLowerCase();
    const kennitala = cleanKennitala(r.kennitala);
    if (!isValidKennitala(kennitala)) {
      results[idx] = { email, error: "invalid kennitala" };
      return;
    }
    if (!r.full_name?.trim() || !email) {
      results[idx] = { email, error: "missing name or email" };
      return;
    }

    const { data: enc, error: encErr } = await supabaseAdmin.rpc("enc_kennitala", { p_text: kennitala });
    if (encErr) {
      results[idx] = { email, error: encErr.message };
      return;
    }
    const password = generatePassword();

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("company_members")
      .insert({
        company_id: companyId,
        full_name: r.full_name.trim(),
        email,
        phone: r.phone || null,
        kennitala_encrypted: enc,
        invite_password_hash: "pending",
      })
      .select("id")
      .single();

    if (insErr) {
      const msg = insErr.code === "23505"
        ? `already on roster (${email})`
        : insErr.message;
      results[idx] = { email, error: msg };
      return;
    }

    const { error: pwErr } = await supabaseAdmin.rpc("set_member_invite_password", {
      p_member_id: inserted.id,
      p_password: password,
    });
    if (pwErr) {
      results[idx] = { email, error: pwErr.message };
      return;
    }
    results[idx] = { email, id: inserted.id, password };
  }

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const slice = rows.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map((r, j) => processRow(r, i + j)));
  }

  return NextResponse.json({
    inserted: results.filter((r) => r.id).length,
    failed: results.filter((r) => r.error).length,
    results,
  });
}
