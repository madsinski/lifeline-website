// Public: which login audiences are currently offered. Used by the login
// switcher to hide a disabled option. Defaults to enabled when unset.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("key, value")
    .in("key", ["personal_login_enabled", "business_login_enabled"]);
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return NextResponse.json({
    personal: m.personal_login_enabled !== false,
    business: m.business_login_enabled !== false,
  });
}
