import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

// Bulk-delete payments rows. Admin-only. The payments table is a
// ledger mirror of real charges (PayDay / Straumur / Stripe-style
// providers) so in production you'd almost never wipe these. It's
// exposed here for the one-off "start fresh" cleanup after the PayDay
// integration was landed.

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: me } = await supabaseAdmin.from("staff").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  const all: boolean = body?.all === true;

  if (!all && ids.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }

  let q = supabaseAdmin.from("payments").delete({ count: "exact" });
  if (all) {
    // Match everything — supabase-js requires a filter, so use not-null
    // on the primary key which every row satisfies.
    q = q.not("id", "is", null);
  } else {
    q = q.in("id", ids);
  }
  const { error, count } = await q;
  if (error) return NextResponse.json({ error: "delete_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
