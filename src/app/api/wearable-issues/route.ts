// POST /api/wearable-issues
//
// Endpoint for the in-app "Stuck?" form on the wearable-setup
// wizard. Validates the JWT, then inserts the issue into
// public.wearable_setup_issues. Staff triage via /admin/wearable-issues.
//
// Body shape mirrors the RN client:
//   { brand, step, message, device_platform, device_version }

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { suggestForIssueId } from "@/app/api/wearable-issues/suggest/route";
import { sendEmail } from "@/lib/email";
import { renderTemplate, findTemplate } from "@/lib/wearable-issue-templates";

export const runtime = "nodejs";
// Bumped from 10s — when auto-reply is on we additionally call the
// model and send an email before responding. Both are bounded by
// their own timeouts, but 30s is the safer ceiling.
export const maxDuration = 30;

const requestSchema = z.object({
  brand: z.string().min(1).max(40),
  step: z.number().int().min(0).max(10),
  message: z.string().min(3).max(2000),
  device_platform: z.string().max(20).optional(),
  device_version: z.union([z.string(), z.number()]).optional(),
});

function authToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length);
}

export async function POST(req: Request) {
  const token = authToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 });
  }
  const { brand, step, message, device_platform, device_version } = parsed.data;

  const { data: inserted, error } = await supabaseAdmin
    .from("wearable_setup_issues")
    .insert({
      client_id: userData.user.id,
      brand,
      step,
      message,
      device_platform: device_platform ?? null,
      device_version: device_version ? String(device_version) : null,
    })
    .select("id")
    .single();
  if (error) {
    // Surface the DB failure to the error inbox — staff need to see
    // when /admin/wearable-issues stops receiving reports.
    Sentry.captureException(error, {
      tags: { route: "/api/wearable-issues", brand, step: String(step) },
      extra: { user_id: userData.user.id },
    });
    return NextResponse.json({ ok: false, error: `Insert failed: ${error.message}` }, { status: 500 });
  }
  console.log("[/api/wearable-issues] inserted", { id: inserted?.id, brand, step, user_id: userData.user.id });

  // Pre-bake an AI suggestion + (optionally) auto-reply. We do this
  // best-effort; failures don't block the 200 to the user. The
  // user-facing "Stuck?" form already considers itself "sent" once
  // the row lands in the DB.
  if (inserted?.id) {
    void runAiTriage(inserted.id, userData.user.id);
  }

  return NextResponse.json({ ok: true, id: inserted?.id ?? null });
}

// Pulled out so the work is fire-and-forget; the user's UX completes
// the moment the row is inserted. Errors flow into Sentry; the inbox
// still lights up regardless.
async function runAiTriage(issueId: string, userId: string) {
  try {
    const result = await suggestForIssueId(issueId);
    if (!result.ok) return;

    // Read the auto-reply toggle + confidence floor. Both default to
    // safe values if the rows are missing.
    const { data: settings } = await supabaseAdmin
      .from("system_settings")
      .select("key, value")
      .in("key", ["wearable_auto_reply_enabled", "wearable_auto_reply_min_confidence"]);
    const settingsMap = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]));
    const enabled = settingsMap.wearable_auto_reply_enabled === true;
    const floor = typeof settingsMap.wearable_auto_reply_min_confidence === "number"
      ? settingsMap.wearable_auto_reply_min_confidence
      : 0.85;

    if (!enabled) return;
    if (!result.suggestion.template_id) return; // never auto-reply with a custom AI body
    if (result.suggestion.confidence < floor) return;

    const template = findTemplate(result.suggestion.template_id);
    if (!template) return;

    // Look up email + first name. Use clients_decrypted to get
    // the encrypted columns transparently.
    const { data: client } = await supabaseAdmin
      .from("clients_decrypted")
      .select("email, first_name")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!client?.email) return;

    const rendered = renderTemplate(template, { name: client.first_name as string | null });
    const reply = result.suggestion.reply_md || rendered.body_md;

    const sendResult = await sendEmail({
      to: client.email as string,
      subject: rendered.subject,
      html: markdownToHtml(reply),
      text: reply,
    });
    if (!sendResult.ok) {
      Sentry.captureException(new Error(`Auto-reply email failed: ${sendResult.error}`), {
        tags: { route: "/api/wearable-issues", phase: "auto_reply_email", issue_id: issueId },
      });
      return;
    }

    await supabaseAdmin
      .from("wearable_setup_issues")
      .update({
        staff_reply: reply,
        auto_replied: true,
        replied_at: new Date().toISOString(),
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolution_note: `Auto-replied with template "${template.id}" (confidence ${result.suggestion.confidence.toFixed(2)}).`,
      })
      .eq("id", issueId);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { route: "/api/wearable-issues", phase: "auto_reply", issue_id: issueId },
    });
  }
}

// Cheap markdown→html shim — bullets, bold, line breaks, links.
// Resend tolerates plain text but renders better with this.
function markdownToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}
