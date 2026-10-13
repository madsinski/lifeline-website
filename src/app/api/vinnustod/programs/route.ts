// Programmes, from the workstation rather than the admin app.
//
// The CRUD already existed at /api/admin/hc/library/[kind], behind adminGate
// — which is right for the admin app and wrong here: a coach is not
// necessarily an admin, and "put together an exercise or nutrition plan" is
// the coach's job. Same tables, workstation auth.
//
// GET                      -> { exercise: [...], nutrition: [...] } incl. inactive
// POST { kind, ...fields } -> upsert by key
// DELETE ?kind=&key=       -> remove
//
// `active` is the "available to everyone" switch that already governs what
// the pickers show. Suggesting one programme to one person is a different
// act and lives in ./suggest.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";
import { hcAudit } from "@/lib/hc/server";

export const runtime = "nodejs";

const TABLES: Record<string, string> = {
  exercise: "hc_exercise_templates",
  nutrition: "hc_nutrition_templates",
};

const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const lines = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => String(x).slice(0, 400)).filter(Boolean).slice(0, 40)
  : typeof v === "string" ? v.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 40)
  : null;

/** Icelandic letters do not survive a naive slug, so they are spelled out. */
const slugify = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [ex, nu] = await Promise.all([
    supabaseAdmin.from("hc_exercise_templates").select("*").order("name"),
    supabaseAdmin.from("hc_nutrition_templates").select("*").order("name"),
  ]);
  return NextResponse.json({ exercise: ex.data ?? [], nutrition: nu.data ?? [] });
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const kind = s(b?.kind, 20) ?? "";
  const table = TABLES[kind];
  if (!table) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const name = s(b?.name, 200);
  if (!name) return NextResponse.json({ error: "Heiti vantar." }, { status: 400 });
  const key = s(b?.key, 100) || slugify(name);
  if (!key) return NextResponse.json({ error: "Heitið gefur ekki gilt lykilorð." }, { status: 400 });

  const row: Record<string, unknown> = {
    key, name,
    active: b?.active === true,
    goal: s(b?.goal, 200),
    description: s(b?.description, 2000),
    principles: lines(b?.principles),
    updated_at: new Date().toISOString(),
  };
  if (kind === "exercise") {
    row.level = s(b?.level, 40);
    row.days_per_week = n(b?.days_per_week);
    row.session_minutes = n(b?.session_minutes);
    /* Sessions come from the session editor and are stored as they arrive;
       validating their shape here would be a second copy of the rules that
       the editor and the adaptive programme already share. */
    if (Array.isArray(b?.sessions)) row.sessions = b.sessions;
    if (b?.progression !== undefined) row.progression = lines(b?.progression);
  } else {
    if (b?.day_example !== undefined) row.day_example = b.day_example;
  }

  const { error } = await supabaseAdmin.from(table).upsert(row, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await hcAudit(actor.label, "program_saved", null, { kind, key, active: row.active });
  return NextResponse.json({ ok: true, key });
}

export async function DELETE(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("kind") ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const table = TABLES[kind];
  if (!table || !key) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  /* Refuse to delete a programme somebody is on. The template key is what
     their plan stores, so removing it would leave a journey pointing at
     nothing — and the symptom would be an empty Æfingar tab weeks later,
     with no clue why. Deactivating is the right move there. */
  /* Through the DECRYPTED view, not the table.
     hc_action_plans.exercise is the legacy plaintext column and is NULL on
     every row — the live value is in exercise_enc — so the same query
     against the table returns nothing every time and the guard silently
     passes. I wrote it that way first and only caught it by running it. */
  const col = kind === "exercise" ? "exercise" : "nutrition";
  const { data: inUse } = await supabaseAdmin.from("hc_action_plans_decrypted")
    .select("journey_id").eq(`${col}->>key`, key).limit(1);
  if (inUse?.length) {
    return NextResponse.json({
      error: "Prógrammið er í notkun hjá skjólstæðingi. Taktu það úr birtingu í staðinn.",
    }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from(table).delete().eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await hcAudit(actor.label, "program_deleted", null, { kind, key });
  return NextResponse.json({ ok: true });
}
