// POST /api/admin/accounting/send — { month: "YYYY-MM" }
//
// Manually send the month's income/expense overview to the accounting
// firm (same email + CSV the monthly cron sends). Every send is logged
// in accounting_report_runs; re-sending is allowed (the accountant may
// need a corrected version after adjustments).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import {
  ACCOUNTANT_EMAIL, MONTH_RE, monthBounds, computeMonthlyReport,
  reportToCsv, reportEmailBodyHtml, icelandicMonthLabel,
} from "@/lib/accounting";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const month = String(body?.month || "");
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "bad_month" }, { status: 400 });

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
    month: monthBounds(month).monthDate,
    sent_to: ACCOUNTANT_EMAIL,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error || "unknown",
    triggered_by: "manual",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent_to: ACCOUNTANT_EMAIL });
}
