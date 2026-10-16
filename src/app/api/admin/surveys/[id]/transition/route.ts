// POST /api/admin/surveys/[id]/transition
// Status transitions for a survey. Each transition has its own
// allowed-from set and allowed roles:
//
//   submit_for_approval  draft → pending_approval     (admin)
//   reset_to_draft       pending_approval → draft     (admin)
//   approve              pending_approval → approved  (admin OR medical_advisor)
//   request_changes      pending_approval → draft     (admin OR medical_advisor)
//   archive              approved → archived          (admin)
//   reopen               approved → draft             (admin) — edit after approval

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffAAL2, gateError } from "@/lib/auth-helpers";

export const runtime = "nodejs";

type Action = "submit_for_approval" | "reset_to_draft" | "approve" | "request_changes" | "archive" | "reopen";
type StaffRole = "admin" | "medical_advisor";

const ACTIONS: Action[] = ["submit_for_approval", "reset_to_draft", "approve", "request_changes", "archive", "reopen"];

interface TransitionMatrix {
  from: ("draft" | "pending_approval" | "approved" | "archived")[];
  to: "draft" | "pending_approval" | "approved" | "archived";
  roles: StaffRole[];
  noteRequired?: boolean;
}

const MATRIX: Record<Action, TransitionMatrix> = {
  submit_for_approval: { from: ["draft"], to: "pending_approval", roles: ["admin"] },
  reset_to_draft:      { from: ["pending_approval"], to: "draft", roles: ["admin"] },
  approve:             { from: ["pending_approval"], to: "approved", roles: ["admin", "medical_advisor"] },
  request_changes:     { from: ["pending_approval"], to: "draft", roles: ["admin", "medical_advisor"], noteRequired: true },
  archive:             { from: ["approved"], to: "archived", roles: ["admin"] },
  // Edit an already-approved survey: send it back to draft so the same
  // editor flow works. Clears the prior approval metadata, so the survey
  // must be re-approved before it can be assigned again.
  reopen:              { from: ["approved"], to: "draft", roles: ["admin"] },
};

interface RequestBody {
  action?: string;
  note?: string;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;
  const user = await requireStaffAAL2(req, { roles: ["admin", "medical_advisor"] });
  if (typeof user === "string") return gateError(user);

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

  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, role, name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!staffRow) return gateError("forbidden");
  if (!rule.roles.includes(staffRow.role as StaffRole)) {
    return NextResponse.json({
      ok: false,
      error: `Action '${action}' requires role in [${rule.roles.join(", ")}], but you are '${staffRow.role}'.`,
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
    patch.approved_by_name = staffRow.name || user.email;
    patch.approved_at = new Date().toISOString();
  } else if (action === "reset_to_draft" || action === "request_changes" || action === "reopen") {
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
    console.error("[surveys/[id]/transition]", updErr?.code);
    return NextResponse.json({ ok: false, error: "Aðgerð mistókst. Reyndu aftur." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, survey: updated });
}
