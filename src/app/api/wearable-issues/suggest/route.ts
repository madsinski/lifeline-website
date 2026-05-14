// POST /api/wearable-issues/suggest
//
// Body: { issue_id: string }
//
// Pulls the issue, loads the relevant template gallery (filtered by
// brand+step), and asks the model to either pick a template or write
// a custom reply. Persists the result onto the issue row so:
//   - the admin UI can show the suggestion without re-calling the API
//   - the auto-reply sweep can decide whether to send without humans
//
// Returns the suggestion to the caller too, so the admin UI can
// optimistically display it.

import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  WEARABLE_ISSUE_TEMPLATES,
  relevantTemplates,
  findTemplate,
  renderTemplate,
  type WearableIssueTemplate,
} from "@/lib/wearable-issue-templates";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gpt-5.4";

const suggestionSchema = z.object({
  // null if the model thinks no template fits and a custom reply is needed
  template_id: z.string().nullable(),
  // 0..1, model's self-rated confidence the reply will actually solve it
  confidence: z.number().min(0).max(1),
  // Custom reply body in markdown. When template_id is set, this can
  // mirror the rendered template (with optional tweaks). When
  // template_id is null, this carries the AI's bespoke reply.
  reply_md: z.string(),
  // Short rationale shown in the admin UI so staff can sanity check
  reasoning: z.string(),
});

async function requireStaff(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { ok: false as const, status: 401, error: "Not authenticated" };
  const token = auth.slice("Bearer ".length);
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!userData.user?.email) return { ok: false as const, status: 401, error: "Invalid session" };
  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, role, active")
    .eq("email", userData.user.email)
    .maybeSingle();
  if (!staff || !staff.active) return { ok: false as const, status: 403, error: "Staff required" };
  return { ok: true as const, staffId: staff.id, role: staff.role };
}

export async function POST(req: Request) {
  const auth = await requireStaff(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const issueId = (body?.issue_id as string | undefined) ?? null;
  if (!issueId) return NextResponse.json({ ok: false, error: "issue_id required" }, { status: 400 });

  const suggestion = await suggestForIssueId(issueId);
  if (!suggestion.ok) return NextResponse.json(suggestion, { status: suggestion.status ?? 500 });
  return NextResponse.json({ ok: true, suggestion: suggestion.suggestion });
}

// Shared core — also called by the new-issue webhook so suggestions
// are pre-baked the moment a ticket lands.
export async function suggestForIssueId(issueId: string): Promise<
  | { ok: true; suggestion: z.infer<typeof suggestionSchema> }
  | { ok: false; status?: number; error: string }
> {
  const { data: issue, error } = await supabaseAdmin
    .from("wearable_setup_issues")
    .select("id, brand, step, message, device_platform, device_version, client_id")
    .eq("id", issueId)
    .maybeSingle();
  if (error || !issue) return { ok: false, status: 404, error: error?.message || "Issue not found" };

  let firstName: string | null = null;
  if (issue.client_id) {
    const { data: client } = await supabaseAdmin
      .from("clients_decrypted")
      .select("first_name")
      .eq("auth_user_id", issue.client_id)
      .maybeSingle();
    firstName = (client?.first_name as string | undefined) ?? null;
  }

  const gallery = relevantTemplates(issue.brand, issue.step);
  // If brand isn't covered (e.g. "none"), fall back to the whole catalog
  // so the model can still pick "needs_more_info".
  const galleryFinal = gallery.length > 0 ? gallery : WEARABLE_ISSUE_TEMPLATES;

  const system = `You are triaging a wearable-setup support ticket for Lifeline Health.

You have two outputs:
1. Pick the single best template_id from the supplied gallery, OR set it to null if no template is a clean fit.
2. Provide the reply_md the user will see. If a template fits, use the rendered template body verbatim. If not, write a short custom reply in the same tone — be specific, actionable, and never invent device behaviour.

Confidence calibration:
  0.90+   only when the user's symptom matches a template's 'needs' description and the device/step also match.
  0.75-0.89 when the template is plausibly right but the user description is thin.
  0.5-0.74 when you're guessing — prefer 'needs_more_info' here.
  <0.5    only when you truly have nothing useful to suggest.

Never promise a coach reply unless 'needs_more_info' is chosen. Never reference internal template ids in the reply text. Always address the user by first name when one is given.`;

  const userPrompt = `TICKET
------
brand: ${issue.brand}
wizard_step: ${issue.step}  // 0=brand picker, 1=install apps, 2=permissions, 3=verify data, 4=success
device_platform: ${issue.device_platform || "unknown"}
device_version: ${issue.device_version || "unknown"}
user_first_name: ${firstName || "(unknown)"}
user_complaint: """
${issue.message}
"""

GALLERY (pick one or set template_id = null and write a custom reply_md):
${galleryFinal.map((t) => formatTemplateForPrompt(t, firstName)).join("\n\n----\n\n")}

Return the structured object.`;

  let result;
  try {
    result = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema: suggestionSchema }),
      system,
      prompt: userPrompt,
      maxOutputTokens: 2000,
    });
  } catch (e) {
    Sentry.captureException(e, {
      tags: { route: "/api/wearable-issues/suggest", issue_id: issueId },
      extra: { brand: issue.brand, step: issue.step },
    });
    return { ok: false, error: `Model call failed: ${(e as Error).message}` };
  }
  if (!result.experimental_output) {
    return { ok: false, error: "Model returned no structured output" };
  }
  const parsed = result.experimental_output as z.infer<typeof suggestionSchema>;

  // Defensive: if template_id is set but doesn't exist, drop it.
  if (parsed.template_id && !findTemplate(parsed.template_id)) {
    parsed.template_id = null;
  }
  // Defensive: if a template was picked, ensure reply_md is at least
  // the rendered template (the model is allowed to tweak it but
  // shouldn't be allowed to send nothing).
  if (parsed.template_id && !parsed.reply_md.trim()) {
    const t = findTemplate(parsed.template_id)!;
    parsed.reply_md = renderTemplate(t, { name: firstName }).body_md;
  }

  // Persist onto the row so re-opening the ticket shows the suggestion
  // without re-burning tokens.
  await supabaseAdmin
    .from("wearable_setup_issues")
    .update({
      ai_suggested_template_id: parsed.template_id,
      ai_suggested_reply: parsed.reply_md,
      ai_suggestion_confidence: parsed.confidence,
      ai_suggested_at: new Date().toISOString(),
    })
    .eq("id", issueId);

  return { ok: true, suggestion: parsed };
}

function formatTemplateForPrompt(t: WearableIssueTemplate, firstName: string | null): string {
  const rendered = renderTemplate(t, { name: firstName });
  return `id: ${t.id}
title: ${t.title}
brands: ${t.brands.join(", ")}
steps: ${t.steps.join(", ")}
needs: ${t.needs}
subject: ${rendered.subject}
body_md: |
${rendered.body_md
  .split("\n")
  .map((l) => "  " + l)
  .join("\n")}`;
}
