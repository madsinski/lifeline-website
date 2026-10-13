// "I think this one suits you" — a programme offered to one person.
//
// Distinct from publishing a programme to everyone, which is the `active`
// flag on the template. This is narrower and reversible: the client sees it,
// and accepts or declines. A coach pushing a programme straight into
// somebody's plan would work, and would also be the difference between a
// coach and an app that changes under you.
//
// POST   { journeyId, kind, key, note? }  -> suggest (supersedes any open one)
// DELETE ?journeyId=&kind=                -> withdraw
//
// See supabase/migration-hc-program-suggestions.sql.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor, type HcActor } from "@/lib/hc/ws-auth";
import { hcAudit } from "@/lib/hc/server";

export const runtime = "nodejs";

const TABLES: Record<string, string> = {
  exercise: "hc_exercise_templates",
  nutrition: "hc_nutrition_templates",
};

async function journeyFor(actor: HcActor, id: string) {
  let q = supabaseAdmin.from("hc_journeys").select("id, client_id, location_id").eq("id", id);
  const locs = actorLocationFilter(actor);
  if (locs !== null) {
    if (locs.length === 0) return null;
    q = q.in("location_id", locs);
  }
  const { data } = await q.maybeSingle();
  return data;
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  const journeyId = typeof b?.journeyId === "string" ? b.journeyId : "";
  const kind = typeof b?.kind === "string" ? b.kind : "";
  const key = typeof b?.key === "string" ? b.key : "";
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 500) : null;
  if (!journeyId || !TABLES[kind] || !key) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const journey = await journeyFor(actor, journeyId);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  /* The programme has to exist. Suggesting a key that does not resolve
     would show the person a card naming a programme nobody can open. */
  const { data: tpl } = await supabaseAdmin.from(TABLES[kind])
    .select("key, name").eq("key", key).maybeSingle();
  if (!tpl) return NextResponse.json({ error: "Prógrammið fannst ekki." }, { status: 404 });

  /* One open suggestion per slot: a second one means the first no longer
     stands, so it is retired rather than left for the client to choose
     between two things their coach said. */
  await supabaseAdmin.from("hc_program_suggestions")
    .update({ status: "superseded", responded_at: new Date().toISOString() })
    .eq("journey_id", journeyId).eq("kind", kind).eq("status", "open");

  const { error } = await supabaseAdmin.from("hc_program_suggestions").insert({
    journey_id: journeyId,
    client_id: journey.client_id,
    kind, template_key: key, note,
    suggested_by: actor.label,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await hcAudit(actor.label, "program_suggested", journeyId, { kind, key });
  return NextResponse.json({ ok: true, name: tpl.name });
}

export async function DELETE(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const journeyId = req.nextUrl.searchParams.get("journeyId") ?? "";
  const kind = req.nextUrl.searchParams.get("kind") ?? "";
  if (!journeyId || !TABLES[kind]) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!(await journeyFor(actor, journeyId))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabaseAdmin.from("hc_program_suggestions")
    .update({ status: "superseded", responded_at: new Date().toISOString() })
    .eq("journey_id", journeyId).eq("kind", kind).eq("status", "open");
  await hcAudit(actor.label, "program_suggestion_withdrawn", journeyId, { kind });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const journeyId = req.nextUrl.searchParams.get("journeyId") ?? "";
  if (!journeyId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!(await journeyFor(actor, journeyId))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data } = await supabaseAdmin.from("hc_program_suggestions")
    .select("id, kind, template_key, note, status, created_at, responded_at, suggested_by")
    .eq("journey_id", journeyId).order("created_at", { ascending: false }).limit(20);
  return NextResponse.json({ suggestions: data ?? [] });
}
