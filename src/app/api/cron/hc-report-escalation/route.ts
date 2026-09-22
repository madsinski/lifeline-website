// Every minute: blood results are in but no doctor has confirmed the report
// within 5 minutes → SMS the on-call Lifeline doctor(s). One SMS per journey.
//
// Recipients: active hc_workers with role doctor/admin and
// receives_report_sms = true, plus HC_ONCALL_DOCTOR_PHONE as a fallback.
// Scheduled in vercel.json. Auth: CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/sms";
import { hcAudit } from "@/lib/hc/server";

export const runtime = "nodejs";

const WAIT_MINUTES = 5;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - WAIT_MINUTES * 60_000).toISOString();
  const { data: due } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, location_id, blood_results_at")
    .lte("blood_results_at", cutoff)
    .is("report_generated_at", null)
    .is("report_sms_sent_at", null)
    .is("cancelled_at", null)
    .limit(50);
  if (!due?.length) return NextResponse.json({ ok: true, due: 0 });

  const { data: doctors } = await supabaseAdmin
    .from("hc_workers")
    .select("id, name, phone, location_ids")
    .in("role", ["doctor", "admin"])
    .eq("active", true)
    .eq("receives_report_sms", true);
  const fallback = process.env.HC_ONCALL_DOCTOR_PHONE;
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.lifelinehealth.is").replace(/\/$/, "");

  let sent = 0;
  for (const j of due) {
    // Claim first so two overlapping cron runs never double-send.
    const { data: claimed } = await supabaseAdmin
      .from("hc_journeys")
      .update({ report_sms_sent_at: new Date().toISOString() })
      .eq("id", j.id)
      .is("report_sms_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    const phones = new Set<string>();
    for (const d of doctors || []) {
      const locs: string[] = d.location_ids || [];
      if (d.phone && (!locs.length || (j.location_id && locs.includes(j.location_id)))) phones.add(d.phone);
    }
    if (!phones.size && fallback) phones.add(fallback);

    const body = `Lifeline: Blodprufusvor eru komin og skyrsla bidur stadfestingar. Opnadu vinnustodina: ${origin}/vinnustod`;
    const results = await Promise.all([...phones].map((to) => sendSms({ to, body })));
    sent += results.filter((r) => r.ok).length;
    await hcAudit("system:cron", "report_sms_escalation", j.id, { recipients: phones.size, ok: results.filter((r) => r.ok).length });
  }
  return NextResponse.json({ ok: true, due: due.length, sent });
}
