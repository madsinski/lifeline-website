// POST /api/admin/surveys/[id]/clone
// Clone an existing survey into a new draft version. Used when the
// medical advisor has approved a survey and you need to make
// changes — approved surveys are immutable, so the only way to
// edit is to create v+1 (or v.bumped) as a fresh draft.
//
// Admin-only.
//
// Body (all optional):
//   { new_key?: string, new_version?: number, copy_questions?: boolean }
// Defaults: new_key = source.key, new_version = max(version)+1 for
// that key, copy_questions = true.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

interface RequestBody {
  new_key?: string;
  new_version?: number;
  copy_questions?: boolean;
}

interface FeedbackQuestionRow {
  id: string;
  survey_id: string;
  order_index: number;
  section_index: number;
  section_title_is: string | null;
  section_title_en: string | null;
  question_type: string;
  label_is: string;
  label_en: string | null;
  helper_is: string | null;
  helper_en: string | null;
  options_jsonb: unknown;
  required: boolean;
  allow_skip: boolean;
  skip_label_is: string | null;
  skip_label_en: string | null;
  created_at: string;
  updated_at: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: sourceId } = await ctx.params;

  let body: RequestBody = {};
  try { body = await req.json(); } catch {
    // empty body is fine — we'll use defaults
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user?.email) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, role, name, active")
    .eq("email", userData.user.email)
    .maybeSingle();
  if (!staffRow || !staffRow.active || staffRow.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin role required" }, { status: 403 });
  }

  // Load source survey
  const { data: source } = await supabaseAdmin
    .from("feedback_surveys")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();
  if (!source) {
    return NextResponse.json({ ok: false, error: "Source survey not found" }, { status: 404 });
  }

  const newKey = (body.new_key || source.key).trim();
  if (!newKey) {
    return NextResponse.json({ ok: false, error: "new_key cannot be empty" }, { status: 400 });
  }

  // Resolve next version: explicit if provided, otherwise max(version)+1
  // for that key.
  let newVersion: number;
  if (typeof body.new_version === "number" && body.new_version > 0) {
    newVersion = body.new_version;
  } else {
    const { data: existing } = await supabaseAdmin
      .from("feedback_surveys")
      .select("version")
      .eq("key", newKey)
      .order("version", { ascending: false })
      .limit(1);
    const maxVersion = existing && existing.length > 0 ? (existing[0].version as number) : 0;
    newVersion = maxVersion + 1;
  }

  // Pre-check for collision (would also be caught by UNIQUE constraint
  // but a clean error is friendlier than the Postgres one).
  const { data: collision } = await supabaseAdmin
    .from("feedback_surveys")
    .select("id")
    .eq("key", newKey)
    .eq("version", newVersion)
    .maybeSingle();
  if (collision) {
    return NextResponse.json({
      ok: false,
      error: `${newKey} v${newVersion} already exists. Pick a different version number.`,
    }, { status: 409 });
  }

  // Create the new survey row in draft state.
  const { data: cloned, error: insErr } = await supabaseAdmin
    .from("feedback_surveys")
    .insert({
      key: newKey,
      version: newVersion,
      title_is: source.title_is,
      title_en: source.title_en,
      intro_is: source.intro_is,
      intro_en: source.intro_en,
      outro_is: source.outro_is,
      outro_en: source.outro_en,
      estimated_minutes: source.estimated_minutes,
      status: "draft",
      created_by: staffRow.id,
      created_by_name: staffRow.name || userData.user.email,
    })
    .select()
    .single();
  if (insErr || !cloned) {
    return NextResponse.json({ ok: false, error: `Clone failed: ${insErr?.message}` }, { status: 500 });
  }

  // Copy questions unless explicitly disabled.
  const copyQuestions = body.copy_questions !== false;
  if (copyQuestions) {
    const { data: sourceQuestions } = await supabaseAdmin
      .from("feedback_questions")
      .select("*")
      .eq("survey_id", sourceId)
      .order("order_index", { ascending: true });
    const sourceList = (sourceQuestions || []) as FeedbackQuestionRow[];
    if (sourceList.length > 0) {
      const rows = sourceList.map((q, i) => ({
        survey_id: cloned.id,
        order_index: i + 1,
        section_index: q.section_index ?? 1,
        section_title_is: q.section_title_is,
        section_title_en: q.section_title_en,
        question_type: q.question_type,
        label_is: q.label_is,
        label_en: q.label_en,
        helper_is: q.helper_is,
        helper_en: q.helper_en,
        options_jsonb: q.options_jsonb,
        required: q.required,
        allow_skip: q.allow_skip,
        skip_label_is: q.skip_label_is,
        skip_label_en: q.skip_label_en,
      }));
      const { error: qInsErr } = await supabaseAdmin
        .from("feedback_questions")
        .insert(rows);
      if (qInsErr) {
        // Roll back the survey row so we don't leave a draft with no
        // questions while reporting failure.
        try {
          await supabaseAdmin.from("feedback_surveys").delete().eq("id", cloned.id);
        } catch {}
        return NextResponse.json({ ok: false, error: `Question copy failed: ${qInsErr.message}` }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    survey: cloned,
    new_id: cloned.id,
  });
}
