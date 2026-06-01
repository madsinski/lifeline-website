import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";

export const maxDuration = 30;

// A co-admin saves their own identifying details (phone, position,
// kennitala) at /business/co-admin-setup — mirroring the primary contact
// at company signup. Persisted onto every company_admins row for this
// user (their profile is the same wherever they're a co-admin). Kennitala
// is encrypted server-side via the same enc_kennitala RPC the primary
// contact uses; only the last 4 digits are kept in clear for display.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const phone = (body?.phone || "").trim();
  const position = (body?.position || "").trim();
  const kennitala = (body?.kennitala || "").replace(/[^0-9]/g, "");

  if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
  if (!position) return NextResponse.json({ error: "position is required" }, { status: 400 });
  if (kennitala.length !== 10) {
    return NextResponse.json({ error: "kennitala must be 10 digits" }, { status: 400 });
  }

  const { data: enc, error: encErr } = await supabaseAdmin.rpc("enc_kennitala", { p_text: kennitala });
  if (encErr) {
    console.error("[co-admin-profile] enc_kennitala failed", encErr);
    return NextResponse.json({ error: "profile_save_failed" }, { status: 500 });
  }

  const { error: updErr } = await supabaseAdmin
    .from("company_admins")
    .update({
      phone,
      position,
      kennitala_encrypted: enc,
      kennitala_last4: kennitala.slice(-4),
    })
    .eq("user_id", user.id);
  if (updErr) {
    console.error("[co-admin-profile] update failed", updErr);
    return NextResponse.json({ error: "profile_save_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
