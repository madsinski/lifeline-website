// Daily cron — emails contact@lifelinehealth.is a digest of the
// previous 24 hours of errors mirrored from Sentry into app_errors.
// Skips entirely on quiet days (zero errors) so Mads only sees the
// reminder on days where there's actually something to fix.
//
// Errors are grouped by message + pathname + runtime so a recurring
// 502 doesn't drown the email — one row per distinct fingerprint
// with the count + last-seen timestamp + a link straight to the
// admin error log filtered to the matching window.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

interface AppErrorRow {
  id: string;
  message: string;
  pathname: string | null;
  runtime: string | null;
  level: string | null;
  fingerprint: string | null;
  occurred_at: string;
  user_email: string | null;
}

interface GroupedError {
  sample: AppErrorRow;
  count: number;
  lastSeen: string;
  affectedUsers: Set<string>;
}

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

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("app_errors")
    .select("id, message, pathname, runtime, level, fingerprint, occurred_at, user_email")
    .gte("occurred_at", cutoff)
    .order("occurred_at", { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const errors = (rows || []) as AppErrorRow[];

  if (errors.length === 0) {
    // Quiet day — explicitly skip the email.
    return NextResponse.json({ ok: true, total: 0, sent: false, reason: "no_errors" });
  }

  // Group by (message, pathname, runtime).
  const groups = new Map<string, GroupedError>();
  for (const e of errors) {
    const key = `${e.message.slice(0, 200)}::${e.pathname || ""}::${e.runtime || ""}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        sample: e,
        count: 1,
        lastSeen: e.occurred_at,
        affectedUsers: new Set(e.user_email ? [e.user_email] : []),
      });
    } else {
      existing.count += 1;
      if (e.occurred_at > existing.lastSeen) existing.lastSeen = e.occurred_at;
      if (e.user_email) existing.affectedUsers.add(e.user_email);
    }
  }

  // Sort: fatals first, then by count desc, then by last-seen desc.
  const grouped = Array.from(groups.values()).sort((a, b) => {
    const aFatal = a.sample.level === "fatal" ? 0 : 1;
    const bFatal = b.sample.level === "fatal" ? 0 : 1;
    if (aFatal !== bFatal) return aFatal - bFatal;
    if (a.count !== b.count) return b.count - a.count;
    return a.lastSeen < b.lastSeen ? 1 : -1;
  });

  const fatalCount = errors.filter((e) => e.level === "fatal").length;
  const distinctIssues = grouped.length;
  const totalEvents = errors.length;

  const to = process.env.DPO_EMAIL || "contact@lifelinehealth.is";
  const subject = fatalCount > 0
    ? `[Errors] ${fatalCount} fatal · ${distinctIssues} issues · ${totalEvents} events (24h)`
    : `[Errors] ${distinctIssues} issues · ${totalEvents} events (24h)`;

  const rowsHtml = grouped.slice(0, 30).map((g) => {
    const e = g.sample;
    const lvl = e.level || "error";
    const lvlColor = lvl === "fatal" ? "#7f1d1d" : lvl === "error" ? "#b91c1c" : lvl === "warning" ? "#92400e" : "#1e40af";
    const lvlBg = lvl === "fatal" ? "#fecaca" : lvl === "error" ? "#fee2e2" : lvl === "warning" ? "#fef3c7" : "#dbeafe";
    const userCount = g.affectedUsers.size;
    return `<tr>
      <td style="padding:8px 12px 8px 0;font-size:13px;color:#374151;vertical-align:top;">
        <span style="display:inline-block;padding:2px 6px;border-radius:4px;background:${lvlBg};color:${lvlColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${lvl}</span>
        <span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#f3f4f6;color:#6b7280;font-size:11px;font-weight:600;margin-left:4px;">${escapeHtml(e.runtime || "—")}</span>
      </td>
      <td style="padding:8px 12px 8px 0;font-size:13px;color:#111827;vertical-align:top;">
        <div style="font-weight:600;">${escapeHtml(e.message.slice(0, 160))}${e.message.length > 160 ? "…" : ""}</div>
        <div style="color:#6b7280;font-family:monospace;font-size:11px;margin-top:2px;">${escapeHtml(e.pathname || "—")}</div>
      </td>
      <td style="padding:8px 0;font-size:13px;color:#374151;vertical-align:top;text-align:right;white-space:nowrap;">
        <div style="font-weight:700;color:${g.count > 5 ? "#b91c1c" : "#374151"};">${g.count}×</div>
        ${userCount > 0 ? `<div style="color:#6b7280;font-size:11px;">${userCount} user${userCount === 1 ? "" : "s"}</div>` : ""}
      </td>
    </tr>`;
  }).join("");

  const moreHtml = grouped.length > 30
    ? `<p style="margin:8px 0;color:#6b7280;font-size:12px;">+ ${grouped.length - 30} more groups — see the full list at the link below.</p>`
    : "";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;">
      <h2 style="margin:0 0 8px 0;color:#0f172a;">Daily error log digest</h2>
      <p style="margin:0 0 18px 0;color:#475569;font-size:14px;line-height:1.55;">
        Past 24 hours: <strong>${totalEvents}</strong> error event${totalEvents === 1 ? "" : "s"} across <strong>${distinctIssues}</strong> distinct issue${distinctIssues === 1 ? "" : "s"}${fatalCount > 0 ? `, including <strong style="color:#b91c1c;">${fatalCount} fatal</strong>` : ""}.
      </p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;">
        <tbody>${rowsHtml}</tbody>
      </table>
      ${moreHtml}
      <p style="margin:18px 0 0;">
        <a href="https://www.lifelinehealth.is/admin/errors"
           style="display:inline-block;padding:10px 18px;background:#10B981;color:white;text-decoration:none;border-radius:6px;font-weight:600;">
          Open error log
        </a>
      </p>
      <p style="margin-top:18px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">
        Tip: open any error in the admin UI and click <em>Copy for Claude</em> to paste the message + stack into a Claude prompt and ask for a fix.
        This digest is sent every morning; it stays silent on quiet days (zero errors in the past 24h).
      </p>
    </div>
  `;

  const sent = await sendEmail({ to, subject, html });
  return NextResponse.json({
    ok: true,
    total: totalEvents,
    issues: distinctIssues,
    fatal: fatalCount,
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
