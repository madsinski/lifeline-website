import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getWorkerSession } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET() {
  const me = await getWorkerSession();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: locations } = await supabaseAdmin.from("hc_locations").select("id, slug, name").eq("active", true).order("name");
  return NextResponse.json({ me, locations: locations || [] });
}
