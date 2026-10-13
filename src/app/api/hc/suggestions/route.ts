// The participant's side of a suggested programme: see it, take it or not.
//
// GET  -> { suggestions: [{ id, kind, name, description, note, suggestedBy }] }
// POST { id, answer: "accept" | "decline" }
//
// Accepting writes the programme into their plan, which is why it goes
// through hc_action_plans_decrypted: that view carries the INSTEAD OF
// trigger that encrypts, and writing to the table would store the plan in
// plaintext.
//
// Declining is a real answer, not a dismissal — it is recorded so the coach
// learns the programme did not suit rather than wondering whether the
// message arrived.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { hcAudit } from "@/lib/hc/server";

export const runtime = "nodejs";

const TABLES: Record<string, string> = {
  exercise: "hc_exercise_templates",
  nutrition: "hc_nutrition_templates",
};

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin.from("hc_program_suggestions")
    .select("id, journey_id, kind, template_key, note, suggested_by, created_at")
    .eq("client_id", user.id).eq("status", "open")
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  if (!rows.length) return NextResponse.json({ suggestions: [] });

  /* The names come from the template tables, so a renamed programme shows
     its current name rather than whatever it was called when suggested. */
  const [ex, nu] = await Promise.all([
    supabaseAdmin.from("hc_exercise_templates").select("key, name, description, goal"),
    supabaseAdmin.from("hc_nutrition_templates").select("key, name, description, goal"),
  ]);
  const byKind: Record<string, Map<string, { name: string; description: string | null; goal: string | null }>> = {
    exercise: new Map((ex.data ?? []).map((r) => [r.key, r])),
    nutrition: new Map((nu.data ?? []).map((r) => [r.key, r])),
  };

  return NextResponse.json({
    suggestions: rows.map((r) => {
      const t = byKind[r.kind]?.get(r.template_key);
      return {
        id: r.id, kind: r.kind, key: r.template_key,
        name: t?.name ?? r.template_key,
        description: t?.description ?? null,
        goal: t?.goal ?? null,
        note: r.note, suggestedBy: r.suggested_by, at: r.created_at,
      };
    /* A suggestion whose template has since been deleted is dropped rather
       than shown as a bare key the person cannot evaluate. */
    }).filter((x) => byKind[x.kind]?.has(x.key)),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  const id = typeof b?.id === "string" ? b.id : "";
  const answer = b?.answer === "accept" ? "accepted" : b?.answer === "decline" ? "declined" : null;
  if (!id || !answer) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: sug } = await supabaseAdmin.from("hc_program_suggestions")
    .select("id, journey_id, kind, template_key, status")
    .eq("id", id).eq("client_id", user.id).maybeSingle();
  if (!sug) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (sug.status !== "open") return NextResponse.json({ error: "already_answered" }, { status: 409 });

  if (answer === "accepted") {
    const { data: tpl } = await supabaseAdmin.from(TABLES[sug.kind])
      .select("*").eq("key", sug.template_key).maybeSingle();
    if (!tpl) return NextResponse.json({ error: "Prógrammið fannst ekki lengur." }, { status: 404 });

    const { data: plan } = await supabaseAdmin.from("hc_action_plans_decrypted")
      .select("id, exercise, nutrition").eq("journey_id", sug.journey_id).maybeSingle();
    if (!plan) return NextResponse.json({ error: "Engin áætlun fannst." }, { status: 409 });

    /* The shape the plan stores is the template minus its bookkeeping: the
       pickers and the adaptive programme both read `key`, and carrying
       active/updated_at into a plan would freeze a copy of a flag that
       belongs to the template. */
    const body = { ...(tpl as Record<string, unknown>) };
    delete body.active;
    delete body.updated_at;
    const patch = sug.kind === "exercise" ? { exercise: body } : { nutrition: body };

    const { error } = await supabaseAdmin.from("hc_action_plans_decrypted")
      .update({ ...patch, edited_by_client_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabaseAdmin.from("hc_program_suggestions")
    .update({ status: answer, responded_at: new Date().toISOString() }).eq("id", id);
  await hcAudit(user.id, answer === "accepted" ? "program_accepted" : "program_declined",
    sug.journey_id, { kind: sug.kind, key: sug.template_key });

  return NextResponse.json({ ok: true, status: answer });
}
