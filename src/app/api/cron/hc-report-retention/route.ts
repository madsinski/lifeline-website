// The yearly "do you still want this?" for parsed reports.
//
// Three things happen here, in order:
//   1. Real use is credited as an answer. Somebody whose plan is built on a
//      report and who ticks actions off it is demonstrating necessity;
//      asking them is a nag, and nags train people to dismiss prompts.
//   2. A report nobody has touched for a year is marked for review. The
//      person sees a card next time they open the journey.
//   3. No answer after the grace period removes Lifeline's copy.
//
// Step 3 is only defensible because the original is in Medalia. Removing
// the copy loses nothing: it can be imported again in one step. Without
// that, silence would have to mean keep, and a review where silence means
// keep limits nothing at all.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hcAudit } from "@/lib/hc/server";
import { ACTIVE_WITHIN_DAYS, REMIND_AFTER_DAYS, REMOVE_AFTER_DAYS, REVIEW_AFTER_DAYS } from "@/lib/hc/retention";

export const runtime = "nodejs";

const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: reports } = await supabaseAdmin
    .from("hc_reports")
    .select("id, journey_id, client_id, report_date, retention_asked_at, retention_reminded_at, retention_confirmed_at")
    .not("client_approved_at", "is", null);

  let credited = 0, asked = 0, reminded = 0, removed = 0;
  const activeSince = days(ACTIVE_WITHIN_DAYS).slice(0, 10);

  for (const r of reports ?? []) {
    // 1. Used recently? Then it is needed, and the clock resets quietly.
    const { count } = await supabaseAdmin
      .from("hc_action_logs")
      .select("action_uid", { count: "exact", head: true })
      .eq("journey_id", r.journey_id)
      .gte("done_on", activeSince);
    if ((count ?? 0) > 0) {
      if (r.retention_asked_at || Date.parse(r.retention_confirmed_at ?? "0") < Date.now() - REVIEW_AFTER_DAYS * 86_400_000) {
        await supabaseAdmin.from("hc_reports")
          .update({ retention_confirmed_at: new Date().toISOString(), retention_asked_at: null, retention_reminded_at: null })
          .eq("id", r.id);
        credited++;
      }
      continue;
    }

    const asksAt = Date.parse(r.retention_asked_at ?? "");
    if (!r.retention_asked_at) {
      // 2. Quiet for a year → ask.
      if (Date.parse(r.retention_confirmed_at ?? "0") < Date.now() - REVIEW_AFTER_DAYS * 86_400_000) {
        await supabaseAdmin.from("hc_reports")
          .update({ retention_asked_at: new Date().toISOString() }).eq("id", r.id);
        await hcAudit("system", "report_retention_asked", r.journey_id as string, { report_date: r.report_date });
        asked++;
      }
      continue;
    }

    const since = (Date.now() - asksAt) / 86_400_000;
    if (since >= REMOVE_AFTER_DAYS) {
      // 3. Still nothing. The copy goes; Medalia still has the original.
      await supabaseAdmin.from("hc_reports").delete().eq("id", r.id);
      await hcAudit("system", "report_removed_no_response", r.journey_id as string, {
        report_date: r.report_date, asked_at: r.retention_asked_at, note: "re-importable from Medalia",
      });
      removed++;
    } else if (since >= REMIND_AFTER_DAYS && !r.retention_reminded_at) {
      await supabaseAdmin.from("hc_reports")
        .update({ retention_reminded_at: new Date().toISOString() }).eq("id", r.id);
      reminded++;
    }
  }

  return NextResponse.json({ ok: true, checked: (reports ?? []).length, credited, asked, reminded, removed });
}
