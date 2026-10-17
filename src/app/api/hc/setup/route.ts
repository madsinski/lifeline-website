// The opt-in guided setup (/app/uppsetning): progress that follows the
// person across devices, and what is already true about them so finished
// things are not asked again.
//
// GET  → { progress, context }   (progress is EMPTY_PROGRESS before "Byrja")
// POST { action: "start" | "dismiss" | "complete" | "restart" }
//      { step, status: "done" | "skipped", next? }   record one step
//      { current }                                    where to resume
//      { data: { days?, hour?, scenario? } }          small reused answers
//
// Table: hc_setup_progress (supabase/migration-hc-setup-progress.sql),
// client access blocked by RLS — this route is the only writer.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";
import { reportOnFile } from "@/lib/hc/stages";
import { loadReport } from "@/lib/hc/report-store";
import { portalFor } from "@/lib/hc/portal";
import {
  EMPTY_PROGRESS, isSetupStep, type SetupContext, type SetupProgress, type StepStatus,
} from "@/lib/hc/setup-steps";

export const runtime = "nodejs";

const COLS = "steps, data, current, started_at, dismissed_at, completed_at";

function shape(row: Partial<SetupProgress> | null): SetupProgress {
  if (!row) return EMPTY_PROGRESS;
  return {
    steps: (row.steps && typeof row.steps === "object" ? row.steps : {}) as SetupProgress["steps"],
    data: (row.data && typeof row.data === "object" ? row.data : {}) as SetupProgress["data"],
    current: isSetupStep(row.current) ? row.current : null,
    started_at: row.started_at ?? null,
    dismissed_at: row.dismissed_at ?? null,
    completed_at: row.completed_at ?? null,
  };
}

async function contextFor(userId: string): Promise<SetupContext> {
  const journey = await currentJourney(userId);
  const [{ data: client }, { data: nudge }] = await Promise.all([
    supabaseAdmin.from("clients_decrypted").select("terms_accepted_at, address").eq("id", userId).maybeSingle<{ terms_accepted_at: string | null; address: string | null }>(),
    supabaseAdmin.from("hc_nudge_prefs").select("channels").eq("client_id", userId).maybeSingle<{ channels: string[] | null }>(),
  ]);
  let hasPlan = false, trainingSaved = false, portal: string | null = null, reportAddress: string | null = null;
  const hasReport = !!(journey && reportOnFile(journey));
  if (journey) {
    const [{ data: plan }, { data: t }, { data: loc }, stored] = await Promise.all([
      supabaseAdmin.from("hc_action_plans_decrypted").select("status").eq("journey_id", journey.id).maybeSingle<{ status: string }>(),
      supabaseAdmin.from("hc_training_settings").select("journey_id").eq("journey_id", journey.id).maybeSingle(),
      journey.location_id
        ? supabaseAdmin.from("hc_locations").select("patient_portal_url").eq("id", journey.location_id).maybeSingle<{ patient_portal_url: string | null }>()
        : Promise.resolve({ data: null }),
      hasReport && !client?.address ? loadReport(journey.id, userId, true).catch(() => null) : Promise.resolve(null),
    ]);
    hasPlan = plan?.status === "published";
    trainingSaved = !!t;
    portal = loc?.patient_portal_url ?? null;
    reportAddress = stored?.report?.patient?.address ?? null;
  }
  return {
    entry: journey?.entry ?? null,
    has_journey: !!journey,
    has_plan: hasPlan,
    has_report: hasReport,
    terms_accepted: !!client?.terms_accepted_at,
    training_saved: trainingSaved,
    address: client?.address ?? null,
    report_address: reportAddress,
    portal_url: portalFor(portal),
    nudges_on: (nudge?.channels?.length ?? 0) > 0,
  };
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const [{ data: row }, context] = await Promise.all([
    supabaseAdmin.from("hc_setup_progress").select(COLS).eq("client_id", user.id).maybeSingle(),
    contextFor(user.id),
  ]);
  return NextResponse.json({ progress: shape(row as Partial<SetupProgress> | null), context });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { data: cur } = await supabaseAdmin.from("hc_setup_progress").select(COLS).eq("client_id", user.id).maybeSingle();
  const p = shape(cur as Partial<SetupProgress> | null);
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { client_id: user.id, updated_at: now };

  const action = typeof b.action === "string" ? b.action : null;
  if (action === "start") {
    row.started_at = p.started_at ?? now;
    row.dismissed_at = null;
  } else if (action === "dismiss") {
    row.dismissed_at = now;
  } else if (action === "complete") {
    row.completed_at = p.completed_at ?? now;
    row.current = null;
  } else if (action === "restart") {
    row.completed_at = null;
    row.dismissed_at = null;
    row.current = null;
    row.started_at = p.started_at ?? now;
  } else if (action) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (b.step !== undefined) {
    if (!isSetupStep(b.step) || (b.status !== "done" && b.status !== "skipped")) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    row.steps = { ...p.steps, [b.step]: { status: b.status as StepStatus, at: now } };
    row.started_at = p.started_at ?? now;
  }
  if (b.current !== undefined) row.current = isSetupStep(b.current) ? b.current : null;

  if (b.data && typeof b.data === "object") {
    const d = b.data as Record<string, unknown>;
    const data = { ...p.data };
    if ("days" in d) {
      const days = [...new Set((Array.isArray(d.days) ? d.days : []).map((x) => Math.round(Number(x))).filter((x) => x >= 0 && x <= 6))].sort();
      data.days = days;
    }
    if ("hour" in d) data.hour = d.hour === null ? null : Math.max(5, Math.min(22, Math.round(Number(d.hour) || 8)));
    if ("scenario" in d) data.scenario = typeof d.scenario === "string" ? d.scenario.slice(0, 40) : null;
    row.data = data;
  }

  const { data: saved, error } = await supabaseAdmin.from("hc_setup_progress")
    .upsert(row, { onConflict: "client_id" }).select(COLS).single();
  if (error) {
    console.error("[hc/setup] save failed", error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  if (action === "complete" || action === "start") {
    await hcAudit(`client:${user.id}`, `setup_${action}`, null);
  }
  return NextResponse.json({ progress: shape(saved as Partial<SetupProgress>) });
}
