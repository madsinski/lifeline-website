// Choosing an accountability partner.
//
// Three columns on clients — accountability_partner_id / _name / _score —
// set in the app by picking a friend and confirming (PeopleTab.tsx:285).
// Writing all three keeps the shape the app reads.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const partnerId: string | null = typeof body?.partnerId === "string" ? body.partnerId : null;

  // null clears it.
  if (!partnerId) {
    const { error } = await supabaseAdmin
      .from("clients")
      .update({ accountability_partner_id: null, accountability_partner_name: null, accountability_partner_score: null })
      .eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, partner: null });
  }

  // It has to be an accepted friend. Without this check any id could be
  // written in, and that person's points then shown to a stranger.
  const { data: friendship } = await supabaseAdmin
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${partnerId}),and(requester_id.eq.${partnerId},addressee_id.eq.${user.id})`)
    .limit(1)
    .maybeSingle();
  if (!friendship) return NextResponse.json({ error: "not-a-friend" }, { status: 403 });

  const { data: them } = await supabaseAdmin
    .from("leaderboard")
    .select("full_name, total_points")
    .eq("id", partnerId)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("clients")
    .update({
      accountability_partner_id: partnerId,
      accountability_partner_name: (them?.full_name as string) ?? null,
      accountability_partner_score: Number(them?.total_points ?? 0),
    })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    partner: { id: partnerId, name: (them?.full_name as string) ?? null, points: Number(them?.total_points ?? 0) },
  });
}
