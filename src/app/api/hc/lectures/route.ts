// The whole fræðsla library, for the account viewer.
//
// The Fræðsla page showed the lectures in this participant's plan and
// nothing else, so anything not assigned was invisible — including the
// lectures that would answer whatever they were curious about today. This
// is the catalogue: everything published, with their own progress on it and
// a flag for which ones their plan asked for.
//
// GET → { lectures[] }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);

  const [{ data: all }, { data: progress }, { data: plan }] = await Promise.all([
    supabaseAdmin
      .from("hc_lectures")
      .select("slug, title, subtitle, kind, duration_min, pillar, sort")
      .eq("published", true)
      .order("pillar")
      .order("sort"),
    supabaseAdmin
      .from("hc_lecture_progress")
      .select("completed_at, hc_lectures!inner(slug)")
      .eq("client_id", user.id),
    // Which ones the plan asked for, so the catalogue can say so rather
      // than making "assigned" and "available" look like the same thing.
    journey
      ? supabaseAdmin.from("hc_action_plans_decrypted")
          .select("lecture_slugs").eq("journey_id", journey.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const done = new Set(
    (progress ?? [])
      .filter((p) => p.completed_at)
      .map((p) => (p.hc_lectures as unknown as { slug: string } | null)?.slug)
      .filter(Boolean) as string[],
  );
  const mine = new Set(
    ((plan?.lecture_slugs as string[] | null) ?? []).filter(Boolean),
  );

  return NextResponse.json({
    lectures: (all ?? []).map((l) => ({
      slug: l.slug,
      title: l.title,
      subtitle: l.subtitle,
      kind: l.kind,
      duration_min: l.duration_min,
      pillar: l.pillar,
      completed: done.has(l.slug as string),
      inPlan: mine.has(l.slug as string),
    })),
  });
}
