// Action-plan builder API — used by the nurse workstation (/vinnustod) and
// by Lifeline staff in /admin/coach/plans.
// GET  → { plan | null, client, journey }
// PUT  → save draft (body = plan fields, see plan-sanitize.ts)
// POST { action: "publish" } → publish to the customer's account; sets the
//      re-evaluation due date a year out and emails the customer.
// Actor: workstation session or Lifeline staff (Bearer + AAL2).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { sanitizePlan } from "@/lib/hc/plan-sanitize";
import { getClientProfile, hcAudit, patchJourney, siteOrigin } from "@/lib/hc/server";
import { sameOrigin } from "@/lib/hc/secrets";
import { actorLocationFilter, getHcActor, type HcActor } from "@/lib/hc/ws-auth";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

async function gate(req: NextRequest, journeyId: string, write: boolean): Promise<{ actor: HcActor; journey: HcJourney } | NextResponse> {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (write && actor.kind === "worker" && !sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data } = await supabaseAdmin.from("hc_journeys").select("*").eq("id", journeyId).maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const locs = actorLocationFilter(actor);
  if (locs && (!data.location_id || !locs.includes(data.location_id))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return { actor, journey: data as HcJourney };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ journeyId: string }> }) {
  const g = await gate(req, (await ctx.params).journeyId, false);
  if (g instanceof NextResponse) return g;
  const [{ data: plan }, profile] = await Promise.all([
    supabaseAdmin.from("hc_action_plans").select("*").eq("journey_id", g.journey.id).maybeSingle(),
    getClientProfile(g.journey.client_id),
  ]);
  return NextResponse.json({
    plan,
    client: { full_name: profile?.full_name ?? null, date_of_birth: profile?.date_of_birth ?? null },
    journey: { id: g.journey.id, stage: g.journey.stage, interview_done_at: g.journey.interview_done_at, plan_published_at: g.journey.plan_published_at },
    actor: g.actor.label,
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ journeyId: string }> }) {
  const g = await gate(req, (await ctx.params).journeyId, true);
  if (g instanceof NextResponse) return g;
  const draft = sanitizePlan(await req.json().catch(() => ({})));
  const { data: existing } = await supabaseAdmin.from("hc_action_plans").select("id, version, status").eq("journey_id", g.journey.id).maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("hc_action_plans")
      .update({ ...draft, updated_by: g.actor.label, updated_at: now, version: existing.version + (existing.status === "published" ? 1 : 0) })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plan: data });
  }
  const { data, error } = await supabaseAdmin
    .from("hc_action_plans")
    .insert({ ...draft, journey_id: g.journey.id, client_id: g.journey.client_id, created_by: g.actor.label, updated_by: g.actor.label })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await hcAudit(g.actor.label, "plan_created", g.journey.id);
  return NextResponse.json({ plan: data });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ journeyId: string }> }) {
  const g = await gate(req, (await ctx.params).journeyId, true);
  if (g instanceof NextResponse) return g;
  const body = await req.json().catch(() => ({}));
  if (body.action !== "publish") return NextResponse.json({ error: "unknown_action" }, { status: 400 });

  const { data: plan } = await supabaseAdmin.from("hc_action_plans").select("*").eq("journey_id", g.journey.id).maybeSingle();
  if (!plan) return NextResponse.json({ error: "Vistaðu áætlunina fyrst." }, { status: 409 });
  if (!Array.isArray(plan.modules) || plan.modules.length === 0) return NextResponse.json({ error: "Áætlunin þarf að innihalda minnst eina aðgerð." }, { status: 400 });

  const now = new Date();
  const start = plan.start_date || now.toISOString().slice(0, 10);
  const review = plan.review_date || new Date(now.getTime() + 91 * 86400_000).toISOString().slice(0, 10);
  const { error } = await supabaseAdmin
    .from("hc_action_plans")
    .update({ status: "published", published_at: now.toISOString(), start_date: start, review_date: review, updated_by: g.actor.label })
    .eq("id", plan.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reeval = new Date(now.getTime() + 365 * 86400_000).toISOString().slice(0, 10);
  const firstPublish = !g.journey.plan_published_at;
  await patchJourney(g.journey.id, {
    plan_published_at: g.journey.plan_published_at ?? now.toISOString(),
    reevaluation_due_at: g.journey.reevaluation_due_at ?? reeval,
    // A plan can be written straight after the interview without anyone
    // ticking "interview done" first — publishing implies it.
    interview_done_at: g.journey.interview_done_at ?? now.toISOString(),
  }, g.actor.label, firstPublish ? "plan_published" : "plan_republished", { version: plan.version });

  const { data: u } = await supabaseAdmin.auth.admin.getUserById(g.journey.client_id);
  const email = u?.user?.email;
  if (email) {
    const origin = siteOrigin(req);
    await sendEmail({
      to: email,
      subject: firstPublish ? "Aðgerðaáætlunin þín er tilbúin" : "Aðgerðaáætlunin þín hefur verið uppfærð",
      html: renderBrandedEmail({
        title: firstPublish ? "Aðgerðaáætlunin þín er tilbúin" : "Áætlunin þín var uppfærð",
        accentLabel: "Næstu 3 mánuðir",
        bodyHtml: `<p style="margin:0 0 12px;">${plan.headline ? `<strong>${String(plan.headline).replace(/</g, "&lt;")}</strong><br/>` : ""}Áætlunin nær yfir svefn, hreyfingu, næringu og andlega líðan. Þú getur skoðað hana í síma eða tölvu og prentað hana út.</p>
          <p style="margin:0;">Eftirfylgdarviðtal eftir þrjá mánuði er ráðlagt. Þú getur bókað það á aðganginum þínum.</p>`,
        ctaLabel: "Skoða áætlunina",
        ctaUrl: `${origin}/account/heilsuferd/aaetlun`,
      }),
      text: `Aðgerðaáætlunin þín er tilbúin: ${origin}/account/heilsuferd/aaetlun`,
    });
  }
  return NextResponse.json({ ok: true });
}
