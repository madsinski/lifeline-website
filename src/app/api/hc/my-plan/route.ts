// The participant shapes their own action plan.
//
// GET  → the library they may pick from (no referrals or supplements — those
//        stay with staff), fræðsla, their current plan, and suggestions built
//        locally from their own report (src/lib/hc/self-plan.ts; no model).
// POST { items, goals, lecture_slugs } → saves and publishes their plan.
//
// Rules: library actions are copied from the library (the participant cannot
// rewrite them, only add a note); an action staff put in is kept as staff
// wrote it; own actions are plain text with limits. Action uids survive, so
// the ticks in hc_action_logs stay attached. Every save is a version in
// hc_plan_versions and a line in the audit (migration-hc-self-service.sql).
// A plan staff are still drafting is not touched.

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, patchJourney, requireUser } from "@/lib/hc/server";
import { loadReport } from "@/lib/hc/report-store";
import { pillarPriorities, selfServiceModule, suggestModules } from "@/lib/hc/self-plan";
import { PILLARS, type Pillar, type PlanGoal, type PlanItem, type PlanModule } from "@/lib/hc/types";

export const runtime = "nodejs";

const isPillar = (p: unknown): p is Pillar => PILLARS.includes(p as Pillar);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function library() {
  const [{ data: modules }, { data: lectures }] = await Promise.all([
    supabaseAdmin.from("hc_plan_modules").select("*").eq("active", true).order("pillar").order("sort"),
    supabaseAdmin.from("hc_lectures").select("slug, title, subtitle, kind, duration_min, pillar").eq("published", true).order("sort"),
  ]);
  return { modules: ((modules || []) as PlanModule[]).filter(selfServiceModule), lectures: lectures || [] };
}

/** exercise_key / nutrition_key from the body → library copies ({} when not sent, null to remove). */
async function programsFrom(body: Record<string, unknown>): Promise<{ exercise?: Record<string, unknown> | null; nutrition?: Record<string, unknown> | null }> {
  const out: { exercise?: Record<string, unknown> | null; nutrition?: Record<string, unknown> | null } = {};
  if ("exercise_key" in body) {
    const k = typeof body.exercise_key === "string" ? body.exercise_key : null;
    if (!k) out.exercise = null;
    else {
      const { data } = await supabaseAdmin.from("hc_exercise_templates").select("key, name, level, goal, days_per_week, session_minutes, description, sessions, principles, progression").eq("key", k).eq("active", true).maybeSingle();
      if (data) out.exercise = data;
    }
  }
  if ("nutrition_key" in body) {
    const k = typeof body.nutrition_key === "string" ? body.nutrition_key : null;
    if (!k) out.nutrition = null;
    else {
      const { data } = await supabaseAdmin.from("hc_nutrition_templates").select("key, name, goal, description, principles, day_example").eq("key", k).eq("active", true).maybeSingle();
      if (data) out.nutrition = data;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [lib, { data: plan }] = await Promise.all([
    library(),
    supabaseAdmin.from("hc_action_plans_decrypted").select("id, status, goals, modules, lecture_slugs, headline, version, edited_by_client_at, exercise, nutrition").eq("journey_id", journey.id).maybeSingle(),
  ]);
  const canSee = !!(journey.report_generated_at || journey.own_report_at);
  const stored = canSee ? await loadReport(journey.id, user.id) : null;
  // Planning lights, so a domain whose components are flagged is not treated
  // as settled just because its composite score is good.
  const priorities = pillarPriorities(stored?.report ?? null, stored?.actionSignals ?? {});

  // The traffic lights again, keyed by hc_knowledge slug rather than by report
  // row, which is what hc_plan_modules.addresses points at. With the row
  // titles alongside, the editor can score each action against this person's
  // own report and say which rows it is aimed at.
  const signals: Record<string, string> = {};
  const markerTitles: Record<string, string> = {};
  for (const item of stored?.report.items ?? []) {
    if (!item.slug) continue;
    // The planning light, not the printed one: a domain with red components
    // under a good composite is a need, not "í góðu lagi".
    const sig = stored?.actionSignals[item.key];
    if (sig) signals[item.slug] = sig;
    markerTitles[item.slug] = item.title;
  }

  return NextResponse.json({
    ...lib,
    plan: plan?.status === "published" ? plan : null,
    staff_drafting: plan?.status === "draft",
    has_report: !!stored,
    priorities,
    signals,
    marker_titles: markerTitles,
    suggestions: suggestModules(lib.modules, priorities, !!stored, stored?.report ?? null),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const [{ modules: lib, lectures }, { data: existing }] = await Promise.all([
    library(),
    supabaseAdmin.from("hc_action_plans_decrypted").select("*").eq("journey_id", journey.id).maybeSingle(),
  ]);
  if (existing?.status === "draft") {
    return NextResponse.json({ error: "Hjúkrunarfræðingur er að ganga frá áætluninni þinni. Þú getur breytt henni þegar hún er birt." }, { status: 409 });
  }
  // Programmes chosen from the library (copied here, never taken from the client).
  const programs = await programsFrom(body);
  const label0 = `self:${user.id}`;

  // Only a programme change: keep the actions as they are.
  if (!Array.isArray(body.items) && (programs.exercise !== undefined || programs.nutrition !== undefined)) {
    if (!existing) return NextResponse.json({ error: "Engin áætlun til að breyta." }, { status: 404 });
    const version = existing.version + 1;
    const patch = { ...programs, version, updated_by: label0, updated_at: new Date().toISOString(), edited_by_client_at: new Date().toISOString() };
    const { data: plan, error } = await supabaseAdmin.from("hc_action_plans_decrypted").update(patch).eq("id", existing.id).select("*").single();
    if (error || !plan) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 500 });
    await supabaseAdmin.from("hc_plan_versions").insert({ plan_id: existing.id, journey_id: journey.id, version, by_kind: "self", by_label: label0, goals: plan.goals, modules: plan.modules, lecture_slugs: plan.lecture_slugs });
    await hcAudit(label0, "plan_self_program", journey.id, { version, exercise: programs.exercise?.key ?? undefined, nutrition: programs.nutrition?.key ?? undefined });
    return NextResponse.json({ ok: true, plan });
  }

  const byKey = new Map(lib.map((m) => [m.key, m]));
  const before = new Map(((existing?.modules ?? []) as PlanItem[]).map((m) => [m.uid, m]));

  const items: PlanItem[] = [];
  for (const raw of (Array.isArray(body.items) ? body.items : []).slice(0, 24)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const note = str(r.note, 300) || null;
    const prev = typeof r.uid === "string" ? before.get(r.uid) : undefined;
    const uid = prev?.uid ?? randomUUID();
    const key = typeof r.key === "string" ? r.key : prev?.key ?? null;
    const m = key ? byKey.get(key) : undefined;
    if (m) {
      items.push({ uid, key: m.key, pillar: m.pillar, title: m.title, summary: m.summary, details: m.details, frequency: m.frequency, note });
    } else if (prev && !prev.key?.startsWith("own:")) {
      // Staff wrote this one (their own text, a referral, a retired library
      // item): kept exactly as written; the participant can move, remove or note it.
      items.push({ ...prev, note });
    } else {
      // The participant's own action, new or edited.
      const title = str(r.title, 80);
      if (!isPillar(r.pillar) || title.length < 3) continue;
      items.push({ uid, key: prev?.key ?? `own:${uid.slice(0, 8)}`, pillar: r.pillar, title, summary: str(r.summary, 300), details: null, frequency: str(r.frequency, 40) || null, note });
    }
  }
  if (!items.length) return NextResponse.json({ error: "Veldu minnst eina aðgerð." }, { status: 400 });

  const goals: PlanGoal[] = (Array.isArray(body.goals) ? body.goals : [])
    .map((g) => (g && typeof g === "object" ? g as Record<string, unknown> : {}))
    .map((g) => ({ pillar: g.pillar as Pillar, text: str(g.text, 160) }))
    .filter((g) => isPillar(g.pillar) && g.text)
    .slice(0, 6);
  const published = new Set(lectures.map((l) => l.slug));
  const lecture_slugs = (Array.isArray(body.lecture_slugs) ? body.lecture_slugs : [])
    .filter((s): s is string => typeof s === "string" && published.has(s)).slice(0, 12);

  const now = new Date();
  const label = `self:${user.id}`;
  let planId: string;
  let version: number;
  if (existing) {
    version = existing.version + 1;
    const { error } = await supabaseAdmin.from("hc_action_plans_decrypted")
      .update({ goals, modules: items, lecture_slugs, ...programs, version, updated_by: label, updated_at: now.toISOString(), edited_by_client_at: now.toISOString() })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 500 });
    planId = existing.id;
  } else {
    version = 1;
    const { data, error } = await supabaseAdmin.from("hc_action_plans_decrypted").insert({
      journey_id: journey.id, client_id: user.id, status: "published", published_at: now.toISOString(),
      headline: "Áætlunin mín", goals, modules: items, lecture_slugs, ...programs,
      start_date: now.toISOString().slice(0, 10), review_date: new Date(now.getTime() + 91 * 86400_000).toISOString().slice(0, 10),
      version, created_by: label, updated_by: label, edited_by_client_at: now.toISOString(),
    }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 500 });
    planId = data.id;
    await patchJourney(journey.id, {
      plan_published_at: journey.plan_published_at ?? now.toISOString(),
      reevaluation_due_at: journey.reevaluation_due_at ?? new Date(now.getTime() + 365 * 86400_000).toISOString().slice(0, 10),
    }, label, "plan_self_created");
  }
  await supabaseAdmin.from("hc_plan_versions").insert({ plan_id: planId, journey_id: journey.id, version, by_kind: "self", by_label: label, goals, modules: items, lecture_slugs });
  const added = items.filter((i) => !before.has(i.uid)).length;
  const removed = [...before.keys()].filter((u) => !items.some((i) => i.uid === u)).length;
  await hcAudit(label, existing ? "plan_self_edit" : "plan_self_created", journey.id, { version, items: items.length, added, removed });

  const { data: plan } = await supabaseAdmin.from("hc_action_plans_decrypted").select("*").eq("id", planId).single();
  return NextResponse.json({ ok: true, plan });
}
