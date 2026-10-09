// Samfélag — points, badges, events and the feed.
//
// CommunityScreen and its six tabs are the largest surface in the app
// (8,522 lines across eleven screens). This is the read-only core of it:
// where you stand, what you have earned, what is on, and what people have
// been doing. Joining events, friend requests and peer messages are writes
// and are not here yet.
//
// `leaderboard` is a view (id, full_name, avatar_url, total_points), so the
// ranking does not have to be summed here.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const todayIso = new Date().toISOString().slice(0, 10);

  const [{ data: board }, { data: badges }, { data: events }, { data: feed }, { data: joined }] =
    await Promise.all([
      supabaseAdmin
        .from("leaderboard")
        .select("id, full_name, avatar_url, total_points")
        .order("total_points", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("user_badges")
        .select("badge_key, title, description, icon, color, earned_at")
        .eq("client_id", user.id)
        .order("earned_at", { ascending: false }),
      supabaseAdmin
        .from("community_events")
        .select("id, name, type, type_color, date, time, location, cost, reward, max_participants, description, cancelled")
        .eq("cancelled", false)
        .gte("date", todayIso)
        .order("date", { ascending: true })
        .limit(10),
      // The feed is everyone's, as in the app — it is what makes it a feed.
      supabaseAdmin
        .from("activity_feed")
        .select("id, client_id, action, points, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin.from("event_participants").select("event_id").eq("client_id", user.id),
    ]);

  // Names for the feed, resolved in one query rather than per row.
  const ids = Array.from(new Set((feed ?? []).map((f) => f.client_id as string)));
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await supabaseAdmin
      .from("leaderboard")
      .select("id, full_name")
      .in("id", ids);
    for (const p of people ?? []) nameById.set(p.id as string, (p.full_name as string) ?? "");
  }

  const myRank = (board ?? []).findIndex((b) => b.id === user.id);
  const joinedIds = new Set((joined ?? []).map((j) => j.event_id as string));

  return NextResponse.json({
    me: {
      points: Number((board ?? []).find((b) => b.id === user.id)?.total_points ?? 0),
      rank: myRank >= 0 ? myRank + 1 : null,
    },
    leaderboard: (board ?? []).map((b, i) => ({
      rank: i + 1,
      name: (b.full_name as string) ?? "—",
      points: Number(b.total_points ?? 0),
      isMe: b.id === user.id,
    })),
    badges: (badges ?? []).map((b) => ({
      key: b.badge_key as string, title: b.title as string,
      description: (b.description as string) ?? null, icon: (b.icon as string) ?? null,
      colour: (b.color as string) ?? null, at: b.earned_at as string,
    })),
    events: (events ?? []).map((e) => ({
      id: e.id as string, name: e.name as string, type: (e.type as string) ?? null,
      colour: (e.type_color as string) ?? null, date: e.date as string,
      time: (e.time as string) ?? null, location: (e.location as string) ?? null,
      cost: (e.cost as string | number) ?? null, reward: (e.reward as string | number) ?? null,
      joined: joinedIds.has(e.id as string),
    })),
    feed: (feed ?? []).map((f) => ({
      id: f.id as string,
      who: nameById.get(f.client_id as string) || "—",
      isMe: f.client_id === user.id,
      action: f.action as string,
      points: Number(f.points ?? 0),
      at: f.created_at as string,
    })),
  });
}
