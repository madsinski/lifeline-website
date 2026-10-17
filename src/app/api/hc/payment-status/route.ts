// Where a Straumur payment stands, for the page the person returns to.
//
// GET ?ref=<our reference> → { status: pending|paid|expired|failed, fulfilled, kind, order? }
//
// Only the person who started the session can ask. While it is pending this
// asks Straumur's status endpoint itself (server-to-server, with our API
// key) and settles a paid session whose webhook has not arrived yet — the
// browser's word is never what marks anything paid.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";
import { refreshStraumurCheckout, type StraumurCheckoutRow } from "@/lib/straumur-checkouts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const ref = (req.nextUrl.searchParams.get("ref") || "").slice(0, 80);
  if (!ref) return NextResponse.json({ error: "missing_ref" }, { status: 400 });
  const { data } = await supabaseAdmin.from("straumur_checkouts").select("*")
    .eq("reference", ref).eq("client_id", user.id).maybeSingle<StraumurCheckoutRow>();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const row = await refreshStraumurCheckout(data);
  let order: Record<string, unknown> | null = null;
  if (row.order_id) {
    const { data: o } = await supabaseAdmin.from("hc_orders").select("*").eq("id", row.order_id).maybeSingle();
    order = o ?? null;
  }
  return NextResponse.json({
    status: row.status,
    fulfilled: !!row.fulfilled_at,
    kind: row.kind,
    amount_isk: row.amount_isk,
    order,
  });
}
