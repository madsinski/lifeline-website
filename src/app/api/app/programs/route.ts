// The programme picker — one programme per pillar.
//
// HealthCoachScreen collapses this into each pillar tab so "everything about
// one pillar lives in one place" (its own comment at :1748). Four categories
// in program_categories (exercise, nutrition, sleep, mental) and 36
// programmes between them, 24 of which are exercise.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const [{ data: cats }, { data: progs }, { data: mine }] = await Promise.all([
    supabaseAdmin.from("program_categories").select("id, key, label, icon, color, sort_order").order("sort_order"),
    supabaseAdmin
      .from("programs")
      .select("id, category_id, key, name, description, tagline, duration, level, exercise_type, target_audience, weekly_focus, sort_order")
      .order("sort_order"),
    supabaseAdmin.from("client_programs").select("category_key, program_key, week_number, started_at").eq("client_id", user.id),
  ]);

  const byId = new Map((cats ?? []).map((c) => [c.id as string, c.key as string]));
  const chosen = new Map((mine ?? []).map((m) => [m.category_key as string, m]));

  return NextResponse.json({
    categories: (cats ?? []).map((c) => {
      const pick = chosen.get(c.key as string);
      return {
        key: c.key as string,
        label: c.label as string,
        colour: (c.color as string) ?? null,
        current: pick
          ? { programKey: pick.program_key as string, week: Number(pick.week_number ?? 1), startedAt: pick.started_at as string }
          : null,
        programs: (progs ?? [])
          .filter((p) => byId.get(p.category_id as string) === c.key)
          .map((p) => ({
            key: p.key as string, name: p.name as string,
            tagline: (p.tagline as string) ?? null,
            description: (p.description as string) ?? null,
            duration: (p.duration as number) ?? null,
            level: (p.level as string) ?? null,
            exerciseType: (p.exercise_type as string) ?? null,
            current: pick?.program_key === p.key,
          })),
      };
    }),
  });
}

/** Switch the programme for one pillar. Mirrors api.ts:selectProgram. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const categoryKey = typeof body?.categoryKey === "string" ? body.categoryKey : null;
  const programKey = typeof body?.programKey === "string" ? body.programKey : null;
  if (!categoryKey || !programKey) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // Both must exist — a typo here would otherwise write a programme that
  // resolves to no actions at all, which looks like an empty day.
  const [{ data: cat }, { data: prog }] = await Promise.all([
    supabaseAdmin.from("program_categories").select("key").eq("key", categoryKey).maybeSingle(),
    supabaseAdmin.from("programs").select("key").eq("key", programKey).maybeSingle(),
  ]);
  if (!cat || !prog) return NextResponse.json({ error: "unknown programme" }, { status: 404 });

  // One row per client per category. Week resets to 1 on a switch, which is
  // what starting a new programme means.
  await supabaseAdmin.from("client_programs").delete().eq("client_id", user.id).eq("category_key", categoryKey);
  const { error } = await supabaseAdmin.from("client_programs").insert({
    client_id: user.id, category_key: categoryKey, program_key: programKey,
    week_number: 1, started_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
