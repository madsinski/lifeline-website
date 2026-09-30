// The customer's published action plan. GET ?journey=<id> (defaults to the
// current journey). Drafts are never returned to the customer.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, getClientProfile, requireUser } from "@/lib/hc/server";
import { upcomingAppointments } from "@/lib/hc/upcoming";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journeyId = req.nextUrl.searchParams.get("journey") || (await currentJourney(user.id))?.id;
  if (!journeyId) return NextResponse.json({ plan: null });
  const { data: plan } = await supabaseAdmin
    .from("hc_action_plans_decrypted")
    .select("*")
    .eq("journey_id", journeyId)
    .eq("client_id", user.id)
    .eq("status", "published")
    .maybeSingle();
  const profile = await getClientProfile(user.id);
  // Fræðsla attached to the plan, in the order the nurse picked it.
  const slugs: string[] = plan?.lecture_slugs ?? [];
  const { data: lecs } = slugs.length
    ? await supabaseAdmin.from("hc_lectures").select("slug, title, subtitle, kind, duration_min, pillar").in("slug", slugs).eq("published", true)
    : { data: [] };
  const lectures = slugs.map((s) => (lecs || []).find((l) => l.slug === s)).filter(Boolean);
  const { data: done } = lectures.length
    ? await supabaseAdmin.from("hc_lecture_progress").select("lecture_id, hc_lectures!inner(slug)").eq("client_id", user.id)
    : { data: [] };
  const doneSlugs = new Set((done || []).map((d) => (d as unknown as { hc_lectures: { slug: string } }).hc_lectures.slug));
  // The same journey's upcoming appointments, for the "Í dag" screen.
  const { data: j } = await supabaseAdmin.from("hc_journeys").select("*").eq("id", journeyId).eq("client_id", user.id).maybeSingle();
  const { data: loc } = j?.location_id ? await supabaseAdmin.from("hc_locations").select("*").eq("id", j.location_id).maybeSingle() : { data: null };
  return NextResponse.json({
    plan, client_name: profile?.full_name ?? null,
    lectures: lectures.map((l) => ({ ...l, completed: doneSlugs.has(l!.slug) })),
    appointments: j ? upcomingAppointments(j as HcJourney, loc) : [],
    has_report: !!j?.report_generated_at,
  });
}
