// Public API for the survey form at /survey/[token].
// No session auth — the completion token IS the auth.
//
// GET  /api/feedback/[token]              → survey + questions + status
// POST /api/feedback/[token]              → submit responses

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { QuestionType } from "@/lib/feedback-survey-types";

export const runtime = "nodejs";

interface AssignmentRow {
  id: string;
  survey_id: string;
  client_name: string | null;
  expires_at: string;
  completed_at: string | null;
}

async function loadAssignment(token: string): Promise<AssignmentRow | null> {
  const { data } = await supabaseAdmin
    .from("feedback_assignments")
    .select("id, survey_id, client_name, expires_at, completed_at")
    .eq("completion_token", token)
    .maybeSingle();
  return (data as AssignmentRow) || null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length < 32) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
  }
  const assignment = await loadAssignment(token);
  if (!assignment) {
    return NextResponse.json({ ok: false, error: "Slóð fannst ekki — vinsamlegast athugaðu hvort þú smelltir á rétta slóð úr tölvupóstinum." }, { status: 404 });
  }
  if (new Date(assignment.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Þessi slóð er útrunnin. Hafðu samband við Lifeline ef þú vilt fá nýja." }, { status: 410 });
  }
  if (assignment.completed_at) {
    return NextResponse.json({
      ok: false,
      already_completed: true,
      completed_at: assignment.completed_at,
      error: "Þú hefur þegar svarað þessari könnun. Takk fyrir!",
    }, { status: 409 });
  }

  const { data: survey } = await supabaseAdmin
    .from("feedback_surveys")
    .select("id, title_is, intro_is, outro_is, estimated_minutes")
    .eq("id", assignment.survey_id)
    .maybeSingle();
  if (!survey) {
    return NextResponse.json({ ok: false, error: "Könnun fannst ekki." }, { status: 404 });
  }
  const { data: questions } = await supabaseAdmin
    .from("feedback_questions")
    .select("id, order_index, question_type, label_is, helper_is, options_jsonb, required, allow_skip, skip_label_is")
    .eq("survey_id", assignment.survey_id)
    .order("order_index", { ascending: true });

  return NextResponse.json({
    ok: true,
    assignment_id: assignment.id,
    recipient_name: assignment.client_name,
    survey,
    questions: questions || [],
  });
}

interface SubmitBody {
  answers?: Array<{
    question_id: string;
    value?: string | null;
    values_array?: string[] | null;
    text_value?: string | null;
    skipped?: boolean;
  }>;
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length < 32) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
  }

  let body: SubmitBody = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ ok: false, error: "No answers submitted." }, { status: 400 });
  }

  const assignment = await loadAssignment(token);
  if (!assignment) return NextResponse.json({ ok: false, error: "Slóð fannst ekki." }, { status: 404 });
  if (new Date(assignment.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Slóðin er útrunnin." }, { status: 410 });
  }
  if (assignment.completed_at) {
    return NextResponse.json({ ok: false, error: "Already submitted." }, { status: 409 });
  }

  // Validate against the canonical question list.
  const { data: questions } = await supabaseAdmin
    .from("feedback_questions")
    .select("id, question_type, required, allow_skip")
    .eq("survey_id", assignment.survey_id);
  const qById = new Map<string, { id: string; question_type: QuestionType; required: boolean; allow_skip: boolean }>();
  for (const q of (questions || []) as { id: string; question_type: QuestionType; required: boolean; allow_skip: boolean }[]) {
    qById.set(q.id, q);
  }

  // Required-completeness check
  const seen = new Set(body.answers.map((a) => a.question_id));
  for (const q of qById.values()) {
    if (q.required && !seen.has(q.id)) {
      return NextResponse.json({ ok: false, error: `Vantar svar við spurningu (${q.id}).` }, { status: 400 });
    }
  }

  // Build response rows with light type-aware coercion.
  const rows = body.answers
    .filter((a) => qById.has(a.question_id))
    .map((a) => {
      const q = qById.get(a.question_id)!;
      const skipped = a.skipped === true;
      const row: Record<string, unknown> = {
        assignment_id: assignment.id,
        question_id: a.question_id,
        skipped,
      };
      if (skipped) return row;
      switch (q.question_type) {
        case "likert5":
        case "singleselect":
        case "nps10":
          row.value = a.value ? String(a.value).slice(0, 50) : null;
          break;
        case "multiselect":
          row.values_array = Array.isArray(a.values_array)
            ? a.values_array.map((v) => String(v).slice(0, 50)).slice(0, 30)
            : [];
          break;
        case "open":
          row.text_value = a.text_value ? String(a.text_value).slice(0, 5000) : null;
          break;
        case "consent_optional":
          row.value = a.value === "yes" ? "yes" : "no";
          row.text_value = a.text_value ? String(a.text_value).slice(0, 5000) : null;
          break;
      }
      return row;
    });

  const { error: insErr } = await supabaseAdmin
    .from("feedback_responses")
    .insert(rows);
  if (insErr) {
    return NextResponse.json({ ok: false, error: `Save failed: ${insErr.message}` }, { status: 500 });
  }

  await supabaseAdmin
    .from("feedback_assignments")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", assignment.id);

  return NextResponse.json({ ok: true });
}
