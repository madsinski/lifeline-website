// POST /api/admin/surveys/[id]/transition
// Status transitions for a survey. Each transition has its own
// allowed-from set and required role:
//
//   submit_for_approval  draft → pending_approval     (admin)
//   reset_to_draft       pending_approval → draft     (admin)
//   approve              pending_approval → approved  (medical_advisor)
//   request_changes      pending_approval → draft     (medical_advisor)
//   archive              approved → archived          (admin)

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Action = "submit_for_approval" | "reset_to_draft" | "approve" | "request_changes" | "archive";

const ACTIONS: Action[] = ["submit_for_approval", "reset_to_draft", "approve", "request_changes", "archive"];

interface TransitionMatrix {
  from: ("draft" | "pending_approval" | "approved" | "archived")[];
  to: "draft" | "pending_approval" | "approved" | "archived";
  role: "admin" | "medical_advisor";
  noteRequired?: boolean;
}

const MATRIX: Record<Action, TransitionMatrix> = {
  submit_for_approval: { from: ["draft"], to: "pending_approval", role: "admin" },
  reset_to_draft:      { from: ["pending_approval"], to: "draft", role: "admin" },
  approve:             { from: ["pending_approval"], to: "approved", role: "medical_advisor" },
  request_changes:     { from: ["pending_approval"], to: "draft", role: "medical_advisor", noteRequired: true },
  archive:             { from: ["approved"], to: "archived", role: "admin" },
};

interface RequestBody {
  action?: string;
  note?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;

  let body: RequestBody = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }
  const note = (body.note || "").toString().slice(0, 1000) || null;
  const rule = MATRIX[action];
  if (rule.noteRequired && !note) {
    return NextResponse.json({ ok: false, error: "Note required for this action." }, { status: 400 });
  }

  // Auth
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
  if (!staffRow || !staffRow.active) {
    return NextResponse.json({ ok: false, error: "No active staff record" }, { status: 403 });
  }
  if (staffRow.role !== rule.role) {
    return NextResponse.json({
      ok: false,
      error: `Action '${action}' requires role '${rule.role}', but you are '${staffRow.role}'.`,
    }, { status: 403 });
  }

  // Verify current status
  const { data: surveyRow } = await supabaseAdmin
    .from("feedback_surveys")
    .select("id, status")
    .eq("id", surveyId)
    .maybeSingle();
  if (!surveyRow) {
    return NextResponse.json({ ok: false, error: "Survey not found" }, { status: 404 });
  }
  if (!rule.from.includes(surveyRow.status as typeof rule.from[number])) {
    return NextResponse.json({
      ok: false,
      error: `Action '${action}' requires status in [${rule.from.join(", ")}], but survey is '${surveyRow.status}'.`,
    }, { status: 409 });
  }

  // Apply
  const patch: Record<string, unknown> = {
    status: rule.to,
    approval_note: note,
    updated_at: new Date().toISOString(),
  };
  if (action === "approve") {
    patch.approved_by = staffRow.id;
    patch.approved_by_name = staffRow.name || userData.user.email;
    patch.approved_at = new Date().toISOString();
  } else if (action === "reset_to_draft" || action === "request_changes") {
    // Clear prior approval metadata if any.
    patch.approved_by = null;
    patch.approved_by_name = null;
    patch.approved_at = null;
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("feedback_surveys")
    .update(patch)
    .eq("id", surveyId)
    .select()
    .single();
  if (updErr || !updated) {
    return NextResponse.json({ ok: false, error: `Status change failed: ${updErr?.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, survey: updated });
}
