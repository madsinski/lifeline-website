// Monthly accounting report cron — vercel.json: "0 7 1 * *"
// (07:00 UTC on the 1st; Iceland is UTC year-round).
//
// Computes the PREVIOUS month's income/expense overview and emails it
// with the DK-importable CSV to the accounting firm. Idempotent per
// month via accounting_report_runs (a successful 'sent' row short-
// circuits), so a manual re-run of the cron won't double-send. Manual
// re-sends go through /api/admin/accounting/send instead.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import {
  ACCOUNTANT_EMAIL, monthBounds, previousMonth, computeMonthlyReport,
  reportToCsv, reportEmailBodyHtml, icelandicMonthLabel,
} from "@/lib/accounting";

export const maxDuration = 120;

// Protected by CRON_SECRET (Vercel Cron adds Authorization: Bearer <secret>)
function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) return false;
  const a = Buffer.from(auth.slice(prefix.length));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const month = previousMonth();
  const { monthDate } = monthBounds(month);

  const { data: existing } = await supabaseAdmin
    .from("accounting_report_runs")
    .select("id, created_at")
    .eq("month", monthDate)
    .eq("status", "sent")
    .eq("triggered_by", "cron")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, idempotent: true, month, already_sent: existing.created_at });
  }

  const report = await computeMonthlyReport(month);
  const csv = reportToCsv(report);
  const label = icelandicMonthLabel(month);

  const result = await sendEmail({
    to: ACCOUNTANT_EMAIL,
    subject: `Lifeline Health — bókhaldsyfirlit ${label}`,
    html: renderBrandedEmail({
      title: `Bókhaldsyfirlit — ${label}`,
      preheader: `Tekju- og gjaldayfirlit Lifeline Health fyrir ${label}`,
      accentLabel: "Mánaðaruppgjör",
      accentTone: "emerald",
      bodyHtml: reportEmailBodyHtml(report),
    }),
    attachments: [{
      filename: `lifeline-bokhald-${month}.csv`,
      content: Buffer.from(csv, "utf-8").toString("base64"),
      contentType: "text/csv",
    }],
  });

  await supabaseAdmin.from("accounting_report_runs").insert({
    month: monthDate,
    sent_to: ACCOUNTANT_EMAIL,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error || "unknown",
    triggered_by: "cron",
  });

  return NextResponse.json({
    ok: result.ok,
    month,
    sent_to: ACCOUNTANT_EMAIL,
    net_isk: report.totals.net_isk,
    warnings: report.warnings,
    ...(result.ok ? {} : { error: result.error }),
  });
}
