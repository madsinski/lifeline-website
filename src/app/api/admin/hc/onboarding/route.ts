// The onboarding flows an admin arranges.
//
// GET                       -> { flows, lectures }  (lectures so the composer
//                              can offer them without a second request)
// POST  { slug, name, audience, steps, active }  -> upsert by slug
// DELETE ?slug=             -> remove
//
// Steps are validated against the registry on write, not on read: a flow
// that cannot work should be refused while the person who arranged it is
// still looking at it, rather than failing in front of somebody signing up.
// See supabase/migration-hc-onboarding-flows.sql.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import { flowProblems, moduleDef, type FlowStep, type ModuleKind } from "@/lib/hc/onboarding-modules";

export const runtime = "nodejs";

const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Only the fields the registry knows about survive a write. */
function cleanSteps(raw: unknown): FlowStep[] | string {
  if (!Array.isArray(raw)) return "Steps vantar.";
  if (raw.length > 40) return "Of mörg skref.";
  const out: FlowStep[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const kind = s(r.kind, 30) as ModuleKind | null;
    if (!kind || !moduleDef(kind)) return `Óþekkt eining: ${kind ?? "—"}`;
    out.push({
      id: s(r.id, 40) ?? `${kind}-${out.length}`,
      kind,
      lectureSlug: s(r.lectureSlug, 120),
      questionKey: (["goal", "move", "age"] as const).includes(r.questionKey as never)
        ? (r.questionKey as "goal" | "move" | "age") : null,
      title: s(r.title, 200),
      body: s(r.body, 2000),
      skippable: r.skippable === true,
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const gate = await adminGate(req, false);
  if (gate) return gate;
  const [flows, lectures] = await Promise.all([
    supabaseAdmin.from("hc_onboarding_flows").select("*").order("audience").order("name"),
    supabaseAdmin.from("hc_lectures").select("slug, title, kind, duration_min").order("title"),
  ]);
  return NextResponse.json({ flows: flows.data ?? [], lectures: lectures.data ?? [] });
}

export async function POST(req: NextRequest) {
  const gate = await adminGate(req, true);
  if (gate) return gate;

  const b = await req.json().catch(() => null);
  const name = s(b?.name, 120);
  const slug = s(b?.slug, 80);
  if (!name || !slug) return NextResponse.json({ error: "Heiti og slug vantar." }, { status: 400 });
  const audience = ["all", "check", "coach"].includes(b?.audience) ? b.audience : "all";

  const steps = cleanSteps(b?.steps);
  if (typeof steps === "string") return NextResponse.json({ error: steps }, { status: 400 });

  /* An unusable order is refused on publish only. Saving a draft that is
     half-arranged is the normal state of arranging something. */
  const active = b?.active === true;
  if (active) {
    const problems = flowProblems(steps);
    if (problems.length) {
      return NextResponse.json({
        error: "Ferlið gengur ekki upp í þessari röð.", problems,
      }, { status: 400 });
    }
    /* One live flow per audience, matching the partial unique index — done
       here as well so the admin gets a sensible message instead of 23505. */
    await supabaseAdmin.from("hc_onboarding_flows")
      .update({ active: false }).eq("audience", audience).neq("slug", slug);
  }

  const { error } = await supabaseAdmin.from("hc_onboarding_flows").upsert({
    slug, name, audience, steps, active,
    updated_by: typeof gate === "object" ? null : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, slug });
}

export async function DELETE(req: NextRequest) {
  const gate = await adminGate(req, true);
  if (gate) return gate;
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!slug) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  /* A live flow is not deleted out from under the people walking it. */
  const { data: row } = await supabaseAdmin.from("hc_onboarding_flows")
    .select("active").eq("slug", slug).maybeSingle();
  if (row?.active) {
    return NextResponse.json({ error: "Ferlið er í notkun. Taktu það úr birtingu fyrst." }, { status: 409 });
  }
  await supabaseAdmin.from("hc_onboarding_flows").delete().eq("slug", slug);
  return NextResponse.json({ ok: true });
}
