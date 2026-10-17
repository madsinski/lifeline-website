// „Næsta skref“ on Í dag: whether the optional setup card is finished for good.
//
// GET  → { finished: boolean }
// POST → record that every step that applied is done (idempotent)
//
// Once the person has done every optional step that applied to them, the
// card says „Allt klárt“ once and never comes back — not when a calendar is
// later disconnected, not on another device. A UI flag this small does not
// earn a column, so it is one row in hc_audit (append-only, already the
// house record of what a person did), read back by actor + action.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hcAudit, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

const ACTION = "next_step_finished";

async function finished(userId: string): Promise<boolean> {
  const { count } = await supabaseAdmin.from("hc_audit").select("id", { count: "exact", head: true })
    .eq("actor", `self:${userId}`).eq("action", ACTION);
  return (count ?? 0) > 0;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ finished: await finished(user.id) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  if (!(await finished(user.id))) await hcAudit(`self:${user.id}`, ACTION, null, {});
  return NextResponse.json({ ok: true, finished: true });
}
