// The customer's published action plan. GET ?journey=<id> (defaults to the
// current journey). Drafts are never returned to the customer.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, getClientProfile, requireUser } from "@/lib/hc/server";
import { upcomingAppointments } from "@/lib/hc/upcoming";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

/**
 * Stamp each module with the part of the day it belongs to.
 *
 * The time lives in hc_plan_modules; the plan payload is a snapshot taken
 * when it was published, and older snapshots predate the column entirely.
 * Joining at read time gives every existing plan the grouping without
 * rewriting one stored payload, and a module that gets retagged reaches
 * every plan using it instead of leaving them on last month's answer.
 *
 * No match keeps "anytime" — the honest answer for anything a nurse typed
 * by hand, and for the many habits that genuinely have no hour.
 */
async function withWhen(modules: unknown): Promise<unknown> {
  if (!Array.isArray(modules) || !modules.length) return modules;
  const keys = [...new Set(modules.map((m) => (m as { key?: unknown }).key).filter((k): k is string => typeof k === "string"))];
  if (!keys.length) return modules;
  const { data } = await supabaseAdmin.from("hc_plan_modules").select("key, when_of_day").in("key", keys);
  const when = new Map((data ?? []).map((r) => [r.key as string, r.when_of_day as string]));
  return modules.map((m) => {
    const k = (m as { key?: unknown }).key;
    return { ...(m as object), when: (typeof k === "string" && when.get(k)) || "anytime" };
  });
}

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
    plan: plan ? { ...plan, modules: await withWhen(plan.modules) } : plan,
    client_name: profile?.full_name ?? null,
    lectures: lectures.map((l) => ({ ...l, completed: doneSlugs.has(l!.slug) })),
    appointments: j ? upcomingAppointments(j as HcJourney, loc) : [],
    has_report: !!j?.report_generated_at,
  });
}
