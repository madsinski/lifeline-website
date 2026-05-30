// PUT /api/admin/surveys/[id]
// Save survey-level fields + the full question list. Admin-only, and
// only when the survey is in 'draft' or 'pending_approval' state —
// approved/archived surveys are immutable until reset.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { aalFromToken } from "@/lib/auth-helpers";
import type { QuestionType } from "@/lib/feedback-survey-types";

export const runtime = "nodejs";

const VALID_QUESTION_TYPES: QuestionType[] = [
  "likert5", "singleselect", "multiselect", "nps10", "open", "consent_optional",
];

interface SurveyPatch {
  title_is?: string;
  title_en?: string | null;
  intro_is?: string | null;
  intro_en?: string | null;
  outro_is?: string | null;
  outro_en?: string | null;
  estimated_minutes?: number;
  category?: string | null;
}

interface QuestionPayload {
  id: string | null;
  order_index: number;
  section_index: number;
  section_title_is: string | null;
  section_title_en: string | null;
  question_type: QuestionType;
  label_is: string;
  label_en: string | null;
  helper_is: string | null;
  helper_en: string | null;
  options_jsonb: unknown;
  required: boolean;
  allow_skip: boolean;
  skip_label_is: string | null;
  skip_label_en: string | null;
}

interface RequestBody {
  survey?: SurveyPatch;
  questions?: QuestionPayload[];
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;

  let body: RequestBody = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Auth + admin check
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
  if (!staffRow || !staffRow.active || (staffRow.role !== "admin" && staffRow.role !== "medical_advisor")) {
    return NextResponse.json({ ok: false, error: "Admin or medical_advisor role required" }, { status: 403 });
  }

  // Verify survey + status allows editing
  const { data: surveyRow } = await supabaseAdmin
    .from("feedback_surveys")
    .select("id, status")
    .eq("id", surveyId)
    .maybeSingle();
  if (!surveyRow) {
    return NextResponse.json({ ok: false, error: "Survey not found" }, { status: 404 });
  }
  if (surveyRow.status !== "draft" && surveyRow.status !== "pending_approval") {
    return NextResponse.json({ ok: false, error: `Cannot edit a survey with status='${surveyRow.status}'.` }, { status: 409 });
  }

  // Update survey-level fields
  if (body.survey) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowed: (keyof SurveyPatch)[] = [
      "title_is", "title_en", "intro_is", "intro_en", "outro_is", "outro_en", "estimated_minutes", "category",
    ];
    for (const k of allowed) {
      if (k in body.survey) patch[k] = body.survey[k];
    }
    const { error } = await supabaseAdmin
      .from("feedback_surveys")
      .update(patch)
      .eq("id", surveyId);
    if (error) {
      return NextResponse.json({ ok: false, error: `Survey update failed: ${error.message}` }, { status: 500 });
    }
  }

  // Replace question list. We delete-and-reinsert because the editor
  // sends the canonical post-edit ordered list — a position-aware
  // diff would be more efficient but adds complexity for marginal
  // gain on a 20-question form.
  if (Array.isArray(body.questions)) {
    // Validate everything BEFORE we touch the DB.
    for (const q of body.questions) {
      if (!q.label_is || q.label_is.trim().length < 2) {
        return NextResponse.json({ ok: false, error: "Every question needs a label." }, { status: 400 });
      }
      if (!VALID_QUESTION_TYPES.includes(q.question_type)) {
        return NextResponse.json({ ok: false, error: `Invalid question type: ${q.question_type}` }, { status: 400 });
      }
      if (
        (q.question_type === "likert5" || q.question_type === "singleselect" || q.question_type === "multiselect")
        && (!Array.isArray(q.options_jsonb) || (q.options_jsonb as unknown[]).length === 0)
      ) {
        return NextResponse.json({ ok: false, error: `Question "${q.label_is.slice(0, 40)}…" needs at least one option.` }, { status: 400 });
      }
    }

    const { error: delErr } = await supabaseAdmin
      .from("feedback_questions")
      .delete()
      .eq("survey_id", surveyId);
    if (delErr) {
      return NextResponse.json({ ok: false, error: `Question reset failed: ${delErr.message}` }, { status: 500 });
    }
    if (body.questions.length > 0) {
      const rows = body.questions.map((q, i) => ({
        survey_id: surveyId,
        order_index: i + 1,
        section_index: Math.max(1, Math.floor(Number(q.section_index) || 1)),
        section_title_is: q.section_title_is?.trim() || null,
        section_title_en: q.section_title_en?.trim() || null,
        question_type: q.question_type,
        label_is: q.label_is.trim(),
        label_en: q.label_en?.trim() || null,
        helper_is: q.helper_is?.trim() || null,
        helper_en: q.helper_en?.trim() || null,
        options_jsonb: q.options_jsonb || null,
        required: !!q.required,
        allow_skip: !!q.allow_skip,
        skip_label_is: q.skip_label_is?.trim() || "Á ekki við",
        skip_label_en: q.skip_label_en?.trim() || "Not applicable",
      }));
      const { error: insErr } = await supabaseAdmin
        .from("feedback_questions")
        .insert(rows);
      if (insErr) {
        return NextResponse.json({ ok: false, error: `Question insert failed: ${insErr.message}` }, { status: 500 });
      }
    }
  }

  // Return the canonical state
  const { data: refreshedSurvey } = await supabaseAdmin
    .from("feedback_surveys")
    .select("*")
    .eq("id", surveyId)
    .single();
  const { data: refreshedQuestions } = await supabaseAdmin
    .from("feedback_questions")
    .select("*")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: true });

  return NextResponse.json({
    ok: true,
    survey: refreshedSurvey,
    questions: refreshedQuestions || [],
  });
}

// DELETE /api/admin/surveys/[id]
// Hard-deletes the survey, its questions (CASCADE), its assignments, and
// all collected responses (assignments → responses CASCADE).
//
// Security:
//   - Admin role (medical_advisor cannot delete).
//   - AAL2 (MFA) required — destructive.
//   - The caller must echo the survey's `key` in the request body as a
//     typed confirmation so accidental fetch()s can't wipe the record.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* allow empty body */ }

  // ── Auth ──────────────────────────────────────────────────────
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
    return NextResponse.json({ ok: false, error: "Admin role required to delete a survey." }, { status: 403 });
  }
  if (aalFromToken(token) !== "aal2") {
    return NextResponse.json({ ok: false, error: "MFA step-up required to delete a survey." }, { status: 403 });
  }

  // ── Load survey + counts; require typed confirmation ──────────
  const { data: surveyRow } = await supabaseAdmin
    .from("feedback_surveys")
    .select("id, key, title_is, status")
    .eq("id", surveyId)
    .maybeSingle();
  if (!surveyRow) {
    return NextResponse.json({ ok: false, error: "Survey not found" }, { status: 404 });
  }
  if (!body.confirm || body.confirm !== surveyRow.key) {
    return NextResponse.json(
      { ok: false, error: `Confirmation mismatch: send { confirm: "${surveyRow.key}" } to delete.` },
      { status: 400 },
    );
  }

  // ── Tally what's being destroyed (for the audit log + UI) ─────
  const { count: assignmentCount } = await supabaseAdmin
    .from("feedback_assignments")
    .select("id", { count: "exact", head: true })
    .eq("survey_id", surveyId);
  const { count: responseCount } = await supabaseAdmin
    .from("feedback_responses")
    .select("id", { count: "exact", head: true })
    .in("assignment_id",
      // PostgREST `in` needs a literal list; we build it via a sub-select alternative:
      // safer to count via a join — but PostgREST has no join in REST. Do a 2-step.
      ((await supabaseAdmin
        .from("feedback_assignments")
        .select("id")
        .eq("survey_id", surveyId)
      ).data ?? []).map((r) => r.id),
    );

  // ── Delete in order. Assignments lack ON DELETE CASCADE from
  //    surveys (responses → assignments DO cascade), so wipe
  //    assignments first to take responses with them; questions
  //    cascade-delete from the survey row. ────────────────────────
  const { error: aErr } = await supabaseAdmin
    .from("feedback_assignments")
    .delete()
    .eq("survey_id", surveyId);
  if (aErr) {
    return NextResponse.json({ ok: false, error: `Assignment delete failed: ${aErr.message}` }, { status: 500 });
  }
  const { error: sErr } = await supabaseAdmin
    .from("feedback_surveys")
    .delete()
    .eq("id", surveyId);
  if (sErr) {
    return NextResponse.json({ ok: false, error: `Survey delete failed: ${sErr.message}` }, { status: 500 });
  }

  console.warn(
    `[surveys:delete] survey=${surveyRow.key} (${surveyId}) by staff=${staffRow.id} (${userData.user.email}) — removed ${assignmentCount ?? 0} assignment(s), ${responseCount ?? 0} response(s)`,
  );

  return NextResponse.json({
    ok: true,
    deleted: {
      survey_id: surveyId,
      key: surveyRow.key,
      assignments: assignmentCount ?? 0,
      responses: responseCount ?? 0,
    },
  });
}
