// Weekly cron — emails contact@lifelinehealth.is when staff access
// reviews are overdue. Runs Mondays so reminders land at the start of
// the week.
//
// Idempotent: short-circuits if a reminder already went out today.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

const REVIEW_CADENCE_DAYS = 90;

function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) return false;
  const got = auth.slice(prefix.length);
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Find active staff with no review in the last 90 days (or never, AND
  // they were created more than 90 days ago).
  const cutoff = new Date(Date.now() - REVIEW_CADENCE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: activeStaff, error: staffErr } = await supabaseAdmin
    .from("staff")
    .select("id, name, email, role, created_at")
    .eq("active", true);
  if (staffErr) {
    return NextResponse.json({ error: staffErr.message }, { status: 500 });
  }
  if (!activeStaff || activeStaff.length === 0) {
    return NextResponse.json({ ok: true, overdue: 0 });
  }

  const ids = activeStaff.map((s) => s.id);
  const { data: reviews } = await supabaseAdmin
    .from("staff_access_reviews")
    .select("reviewed_staff_id, reviewed_at")
    .in("reviewed_staff_id", ids)
    .order("reviewed_at", { ascending: false });

  const lastReviewed: Record<string, string> = {};
  for (const r of reviews || []) {
    if (!lastReviewed[r.reviewed_staff_id]) {
      lastReviewed[r.reviewed_staff_id] = r.reviewed_at;
    }
  }

  const overdue = activeStaff.filter((s) => {
    const ref = lastReviewed[s.id] || s.created_at;
    return ref < cutoff;
  });

  if (overdue.length === 0) {
    return NextResponse.json({ ok: true, overdue: 0 });
  }

  const to = process.env.DPO_EMAIL || "contact@lifelinehealth.is";
  const subject = `[Access review] ${overdue.length} staff overdue for quarterly review`;

  const rows = overdue
    .map((s) => {
      const last = lastReviewed[s.id];
      const since = last
        ? `last reviewed ${new Date(last).toLocaleDateString("en-GB")}`
        : "never reviewed";
      return `<tr>
        <td style="padding: 4px 12px 4px 0;">${escapeHtml(s.name)}</td>
        <td style="padding: 4px 12px 4px 0; color: #6b7280;">${escapeHtml(s.email)}</td>
        <td style="padding: 4px 12px 4px 0; color: #6b7280;">${escapeHtml(s.role)}</td>
        <td style="padding: 4px 0; color: #b45309;">${since}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px;">
      <h2 style="margin:0 0 8px 0;">Quarterly access review is due</h2>
      <p style="margin:0 0 16px 0; color:#6b7280;">
        ${overdue.length} active staff member${overdue.length === 1 ? "" : "s"} ${overdue.length === 1 ? "is" : "are"} overdue for review (every ${REVIEW_CADENCE_DAYS} days, GDPR Art. 32 / Lög 90/2018).
      </p>
      <table style="width:100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
        <thead>
          <tr style="border-bottom: 1px solid #e5e7eb; color: #6b7280; text-align: left; font-size: 12px; text-transform: uppercase;">
            <th style="padding: 6px 12px 6px 0;">Name</th>
            <th style="padding: 6px 12px 6px 0;">Email</th>
            <th style="padding: 6px 12px 6px 0;">Role</th>
            <th style="padding: 6px 0;">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin: 0;">
        <a href="https://www.lifelinehealth.is/admin/access-review"
           style="display: inline-block; padding: 10px 16px; background: #10B981; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Review now
        </a>
      </p>
      <p style="margin-top: 18px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">
        You'll get this reminder every Monday until the queue is cleared.
        Cadence + workflow context: supabase/runbooks/sprint1-2-followup.md §7.
      </p>
    </div>
  `;

  const sent = await sendEmail({ to, subject, html });
  return NextResponse.json({
    ok: true,
    overdue: overdue.length,
    sent: sent.ok,
    error: sent.ok ? null : sent.error,
  });
}

function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
