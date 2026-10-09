// Ábyrgðarfélagi — the one person who sees how you are doing.
//
// Deliberately NOT a leaderboard. The evidence that argues against ranking
// people against strangers (autonomy predicts continued use; extrinsic
// currency crowds out intrinsic motivation) argues *for* this: one named
// person, chosen by the user, who can be removed at any time.
//
// What the partner sees is the minimum that makes it work: how many of the
// last 14 days the person did something, and nothing else. No action names,
// no pillars, no report, no measurements. A health report is not shared with
// another member by picking them here, and the number below is not health
// data about a condition — it is whether somebody showed up.
//
// Stored on clients.accountability_partner_{id,name,score} — the same three
// columns the app writes, so the two agree. The app only ever wrote name and
// score; this writes the id too, which is what makes a live figure possible.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hcAudit, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

/** Days a person logged at least one action, out of the last 14. */
async function daysActive(clientId: string): Promise<{ days: number; of: number }> {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  const from = since.toISOString().slice(0, 10);

  const [{ data: hc }, { data: app }] = await Promise.all([
    supabaseAdmin.from("hc_action_logs").select("date").eq("client_id", clientId).gte("date", from),
    supabaseAdmin.from("action_completions").select("date").eq("client_id", clientId)
      .eq("status", "done").gte("date", from),
  ]);
  // Either surface counts — the person did the thing, not the screen.
  const days = new Set([...(hc ?? []), ...(app ?? [])].map((r) => String(r.date).slice(0, 10)));
  return { days: days.size, of: 14 };
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { data: me } = await supabaseAdmin
    .from("clients")
    .select("accountability_partner_id, accountability_partner_name")
    .eq("id", user.id)
    .maybeSingle();

  // Who could be chosen: accepted friendships only.
  const { data: fs } = await supabaseAdmin
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  const otherIds = (fs ?? []).map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id) as string);

  const { data: people } = otherIds.length
    ? await supabaseAdmin.from("clients").select("id, full_name").in("id", otherIds)
    : { data: [] };

  const partnerId = me?.accountability_partner_id as string | undefined;
  const partnerName = me?.accountability_partner_name as string | undefined;

  // Resolve by name too: the app never wrote the id.
  const resolvedId = partnerId
    ?? (people ?? []).find((p) => (p.full_name as string) === partnerName)?.id as string | undefined;

  const [mine, theirs] = await Promise.all([
    daysActive(user.id),
    resolvedId ? daysActive(resolvedId) : Promise.resolve(null),
  ]);

  // Who has picked YOU, so the relationship is visible from both ends.
  const { data: watchers } = await supabaseAdmin
    .from("clients")
    .select("full_name")
    .eq("accountability_partner_id", user.id);

  return NextResponse.json({
    partner: partnerName
      ? { id: resolvedId ?? null, name: partnerName, days: theirs?.days ?? null, of: 14 }
      : null,
    me: mine,
    candidates: (people ?? []).map((p) => ({ id: p.id as string, name: (p.full_name as string) ?? "—" })),
    watchedBy: (watchers ?? []).map((w) => (w.full_name as string) ?? "—"),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const partnerId: string | null = typeof body?.partnerId === "string" ? body.partnerId : null;

  if (!partnerId) {
    await supabaseAdmin.from("clients")
      .update({ accountability_partner_id: null, accountability_partner_name: null, accountability_partner_score: null })
      .eq("id", user.id);
    await hcAudit(`self:${user.id}`, "accountability_partner_cleared", null, {});
    return NextResponse.json({ ok: true, partner: null });
  }

  // Accepted friendship in either direction, or nothing. Without this, any
  // id could be written in and that person's activity shown to a stranger.
  const { data: ok } = await supabaseAdmin
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${partnerId}),and(requester_id.eq.${partnerId},addressee_id.eq.${user.id})`)
    .limit(1)
    .maybeSingle();
  if (!ok) return NextResponse.json({ error: "not-a-friend" }, { status: 403 });

  const { data: them } = await supabaseAdmin
    .from("clients").select("full_name").eq("id", partnerId).maybeSingle();

  await supabaseAdmin.from("clients").update({
    accountability_partner_id: partnerId,
    accountability_partner_name: (them?.full_name as string) ?? null,
    accountability_partner_score: 0,
  }).eq("id", user.id);

  // Choosing a partner means another member starts seeing a figure about
  // you, so it is written to the audit trail like any other sharing act.
  await hcAudit(`self:${user.id}`, "accountability_partner_set", null, { partner: partnerId });

  return NextResponse.json({ ok: true });
}
