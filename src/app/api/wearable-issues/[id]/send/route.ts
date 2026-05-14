// POST /api/wearable-issues/:id/send
//
// Staff endpoint to deliver a reply for one ticket. Body:
//   { reply_md: string, subject?: string, resolution_note?: string }
//
// Sends the reply by email (Resend), then marks the ticket resolved
// with replied_at + staff_reply persisted. Auto_replied stays false
// since a human is in the loop.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  reply_md: z.string().min(3).max(8000),
  subject: z.string().max(150).optional(),
  resolution_note: z.string().max(500).optional(),
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
  return { ok: true as const, staffId: staff.id };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const { data: issue, error: loadErr } = await supabaseAdmin
    .from("wearable_setup_issues")
    .select("id, client_id")
    .eq("id", id)
    .maybeSingle();
  if (loadErr || !issue) return NextResponse.json({ ok: false, error: "Issue not found" }, { status: 404 });

  if (!issue.client_id) {
    return NextResponse.json({ ok: false, error: "No client linked to this issue" }, { status: 400 });
  }

  const { data: client } = await supabaseAdmin
    .from("clients_decrypted")
    .select("email, first_name")
    .eq("auth_user_id", issue.client_id)
    .maybeSingle();
  if (!client?.email) return NextResponse.json({ ok: false, error: "Client has no email on file" }, { status: 400 });

  const subject = parsed.data.subject || "Following up on your wearable-setup question";
  const result = await sendEmail({
    to: client.email as string,
    subject,
    html: markdownToHtml(parsed.data.reply_md),
    text: parsed.data.reply_md,
  });
  if (!result.ok) {
    Sentry.captureException(new Error(`Manual reply email failed: ${result.error}`), {
      tags: { route: "/api/wearable-issues/[id]/send", issue_id: id, staff_id: auth.staffId },
    });
    return NextResponse.json({ ok: false, error: result.error || "Email send failed" }, { status: 500 });
  }

  const { error: updErr } = await supabaseAdmin
    .from("wearable_setup_issues")
    .update({
      staff_reply: parsed.data.reply_md,
      replied_at: new Date().toISOString(),
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: auth.staffId,
      resolution_note: parsed.data.resolution_note ?? null,
    })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: `Update failed: ${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function markdownToHtml(md: string): string {
  const escaped = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}
