import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    const authHeader = req.headers.get("cookie") || "";
    if (!authHeader) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body?.name || "").trim();
  const kennitala = (body?.kennitala || "").replace(/[^0-9]/g, "");
  const agreement_version = body?.agreement_version || "1.0";

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (kennitala.length !== 10) {
    return NextResponse.json({ error: "kennitala must be 10 digits" }, { status: 400 });
  }
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Encrypt kennitala via RPC
  const { data: encData, error: encErr } = await supabaseAdmin.rpc("enc_kennitala", {
    p_text: kennitala,
  });
  if (encErr) {
    console.error("[companies] enc_kennitala failed", encErr);
    return NextResponse.json({ error: "kennitala encryption failed" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("companies")
    .insert({
      name,
      kennitala_encrypted: encData,
      contact_person_id: user.id,
      agreement_version,
      agreement_accepted_at: new Date().toISOString(),
    })
    .select("id, name, created_at")
    .single();

  if (error) {
    console.error("[companies] insert failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id, name, agreement_version, agreement_accepted_at, created_at")
    .eq("contact_person_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ companies: data || [] });
}
