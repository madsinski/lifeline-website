// What the workstation knows about a client, and what it says to do next.
// Pure: types, the next-task rule and the queue flags. No React.

import type { ComponentProps } from "react";
import type PlanBuilder from "@/app/components/hc/PlanBuilder";
import type { HcResult } from "@/app/components/hc/ResultsCard";
import type { ReferralSuggestion } from "@/app/components/hc/Referrals";
import type { ActionLog, ActionPref } from "@/lib/hc/adherence";
import type { Comparison } from "@/lib/hc/compare";
import type { Grunnheilsa, Signal as ReportSignal } from "@/lib/hc/grunnheilsa";
import type { ReportReference } from "@/lib/hc/knowledge";
import type { Referral } from "@/lib/hc/referrals";
import type { InterviewNotes, PlanItem } from "@/lib/hc/types";
import { day, dayTime, daysSince, isToday, time } from "./format";

// ── Types ───────────────────────────────────────────────────────────────────

export interface Me { id: string; name: string; email: string; organization: string; role: "nurse" | "doctor" | "admin"; has_pin: boolean }

export interface Row {
  id: string; client_id: string; client_name: string; client_phone: string | null; client_dob: string | null; stage: string; entry: string;
  /** The journey's client row is missing — a data fault, not a nameless person. */
  client_missing?: boolean;
  /** On "Lifeline þjálfun" (the coaching subscription), not only the app. */
  coaching?: boolean;
  paid_at: string | null; protocol_activated_at: string | null;
  blood_test_booked_for: string | null; blood_test_done_at: string | null; blood_results_at: string | null;
  measurements_booked_for: string | null; measurements_done_at: string | null;
  report_generated_at: string | null; report_sms_sent_at: string | null; report_imported_at?: string | null;
  interview_booked_for: string | null; interview_mode: string | null; interviewer_id: string | null; interview_done_at: string | null;
  meeting_url: string | null; followup_mode?: string | null; followup_meeting_url?: string | null;
  plan_published_at: string | null; followup_booked_for: string | null; followup_done_at: string | null;
  referral_to_heilsugaesla: boolean; doctor_review_requested_at: string | null; doctor_reviewed_at: string | null;
  plan_status: string | null; updated_at: string;
  last_tick_on?: string | null; ticks_7d?: number; open_referrals?: number;
  /*
   * The Lifeline↔Medalia split (2026-10). Optional until every route sends
   * them; absence is tolerated everywhere they are read.
   *
   * own_report_at — the participant put their own report copy in.
   * staff_import_consent_at — the participant allowed staff to fetch the
   *   copy for them; without it the import route answers 403.
   * doctor_interview_done_at — the doctor interview, which happens in
   *   Medalia; the nurse ticks it here so the queue moves on. undefined
   *   (field not sent) means "unknown", not "not done".
   * partner_failed — Vera partner emails that did not go out.
   */
  own_report_at?: string | null;
  staff_import_consent_at?: string | null;
  doctor_interview_done_at?: string | null;
  partner_failed?: number;
  /** The same prescribed session done as something else ≥3 times in 14 days
   *  (queue route; migration-session-substitutions.sql). label null = title
   *  not stored (older rows). */
  swap_hint?: { label: string | null; count: number } | null;
}

export interface Journey extends Omit<Row, "client_id" | "client_name" | "client_phone" | "client_dob" | "plan_status"> {
  referral_note: string | null; referred_at: string | null; doctor_review_note: string | null;
  interview_notes: InterviewNotes | null; followup_notes?: InterviewNotes | null; location_id: string | null;
}

export interface Detail {
  /** On "Lifeline þjálfun": what is left of the tier's quota (null otherwise). */
  coaching?: { video_left: number; video_allowance: number; measurement_next_at: string | null; service_weekday: number; ends_at: string | null } | null;
  journey: Journey;
  patient: { full_name: string | null; kennitala: string | null; email: string | null; phone: string | null; address: string | null; date_of_birth: string | null; sex: string | null };
  results: HcResult[];
  compare?: Comparison | null;
  report: {
    report: Grunnheilsa;
    signals: Record<string, ReportSignal | null>;
    reference?: Record<string, ReportReference>;
    sex?: "m" | "f" | null;
    method: "local" | "ai";
    created_at: string;
  } | null;
  logs: ActionLog[];
  prefs: ActionPref[];
  orders: { id: string; kind: string; payment_route: string; paid_at: string | null; activation_code: string | null; activation_redeemed_at: string | null }[];
  referrals: Referral[];
  ai_referrals: ReferralSuggestion[];
  ai_proposal: ComponentProps<typeof PlanBuilder>["readyProposal"];
  audit: { actor: string; action: string; at: string; note: string | null }[];
  plan: { status: string; published_at: string | null; headline: string | null; modules: PlanItem[] } | null;
  location: { name: string } | null;
  actor: { label: string; isDoctor: boolean; name: string | null };
  /** Where the report copy came from (the client's own upload or staff). */
  reportProvenance?: { source: string; state: string; reportDate: string | null; approvedAt: string | null } | null;
  messages: { id: string; channel: "sms" | "email"; recipient: string; template: string | null; subject: string | null; body: string; status: string; error: string | null; sent_by: string; sent_at: string }[];
}

export type Record_ = (payload: Record<string, unknown>) => Promise<string | null>;

// ── Navigation ──────────────────────────────────────────────────────────────

/** The five places on the home side. */
export const HOME_TABS = ["today", "clients", "calendar", "teaching", "settings"] as const;
export type HomeTab = (typeof HOME_TABS)[number];

/** The four tabs of a client's workspace (Mads, 2026-10-12: four, no more). */
export const WS_TABS = ["status", "report", "plan", "preview"] as const;
export type WsTab = (typeof WS_TABS)[number];

/** What opens over a client's workspace. Sheets, not tabs. */
export const SHEETS = ["interview", "referral", "orders", "messages", "history"] as const;
export type SheetKey = (typeof SHEETS)[number];

export type PatientNav = { tab?: WsTab; sheet?: SheetKey | null; focus?: "chat" | "requests" | null };
export type View = { home: HomeTab } | ({ patient: string } & PatientNav);

/** How a client is opened from anywhere on the home side. */
export type OpenClient = (journeyId: string, nav?: PatientNav) => void;

// ── The next task ───────────────────────────────────────────────────────────

/** What the next action for a client is — the heart of the to-do list. */
export type Task = { key: string; label: string; cta: string; tone: "urgent" | "normal" | "waiting" };

/** A copy of the report is on file here, by any route. */
export const reportOnFile = (r: Row | Journey) => !!(r.own_report_at || r.report_imported_at || r.report_generated_at);

/*
 * The split with Medalia (Mads, 2026-10-16).
 *
 * Medalia owns the blood test orders, the measurement results of the health
 * check, the report (produced and signed there) and the doctor interview.
 * Lifeline owns chasing activation, the measurement appointment, the
 * client's report copy, the Áætlunarsamtal, the plan, follow-ups and the
 * Vera partners. So the to-do list never asks a nurse to record a blood
 * draw or confirm a report: the order is activate → report copy → doctor
 * interview (in Medalia) → Áætlunarsamtal → plan → follow-up.
 */
export function nextTask(r: Row | Journey): Task {
  if (r.stage === "cancelled" || r.stage === "completed") return { key: "none", label: "", cta: "Opna", tone: "waiting" };
  // A partner email that did not go out: the client is waiting on a call
  // that will never come until somebody resends it.
  if ((r.partner_failed ?? 0) > 0) {
    return { key: "partner", label: "Tölvupóstur til samstarfsaðila (Vera) fór ekki", cta: "Senda aftur", tone: "urgent" };
  }
  if (r.plan_published_at) {
    // They keep doing something else instead of one session: the plan does
    // not fit their week, which is the plan's problem, not theirs. Behind a
    // follow-up that is today, which is where it gets discussed anyway.
    const swap = r.swap_hint;
    if (swap && swap.count >= 3 && !(r.followup_booked_for && !r.followup_done_at && isToday(r.followup_booked_for))) {
      return {
        key: "swaps",
        label: `Skiptir oft út ${swap.label ? `„${swap.label}“` : "sömu æfingunni"} · Lagfæra áætlun?`,
        cta: "Lagfæra áætlun", tone: "normal",
      };
    }
    // Follow-up done: nothing is owed until the re-evaluation.
    if (r.followup_done_at) return { key: "done", label: "Eftirfylgd lokið", cta: "Opna", tone: "waiting" };
    // A week of silence since the plan went out: worth a message.
    if (!r.followup_booked_for && "ticks_7d" in r && (r.ticks_7d ?? 0) === 0 && daysSince(r.plan_published_at) >= 7 && daysSince(r.plan_published_at) < 90) {
      return { key: "nudge", label: r.last_tick_on ? `Ekkert merkt síðan ${day(r.last_tick_on)}` : "Hefur ekki merkt neitt í áætluninni", cta: "Senda hvatningu", tone: "normal" };
    }
    if (r.followup_booked_for) {
      return { key: "followup", label: `Eftirfylgd ${dayTime(r.followup_booked_for)}`, cta: "Hefja eftirfylgd", tone: isToday(r.followup_booked_for) ? "urgent" : "normal" };
    }
    // The three-month follow-up is the promise we made when the plan was
    // published, so it becomes urgent once that date passes.
    const due = daysSince(r.plan_published_at) >= 90;
    return {
      key: "bookfollow",
      label: due ? "Þrír mánuðir liðnir — eftirfylgd ekki bókuð" : "Áætlun birt, eftirfylgd ekki bókuð",
      cta: "Bóka eftirfylgd", tone: due ? "urgent" : "normal",
    };
  }
  if (r.interview_done_at) return { key: "plan", label: "Áætlunarsamtali lokið, áætlun vantar", cta: "Klára áætlun", tone: "urgent" };
  if (r.interview_booked_for) {
    return {
      key: "interview",
      label: `Áætlunarsamtal ${isToday(r.interview_booked_for) ? `í dag kl. ${time(r.interview_booked_for)}` : dayTime(r.interview_booked_for)}`,
      cta: "Hefja samtal", tone: isToday(r.interview_booked_for) ? "urgent" : "normal",
    };
  }
  const report = reportOnFile(r);
  const doctorDone = !!r.doctor_interview_done_at;
  if (!r.protocol_activated_at && !report && !doctorDone) {
    if (!r.paid_at) return { key: "none", label: "", cta: "Opna", tone: "waiting" };
    // Two clear days before it is worth chasing: most people activate the
    // day they pay.
    return daysSince(r.paid_at) >= 2
      ? { key: "activate", label: "Hefur ekki virkjað", cta: "Senda áminningu", tone: "normal" }
      : { key: "activating", label: "Greitt, bíður virkjunar", cta: "Opna", tone: "waiting" };
  }
  if (!report && !doctorDone) {
    // The measurement appointment is ours (Lifeline's station). Until it
    // has happened there is no report to wait for.
    if (r.measurements_booked_for && !r.measurements_done_at && new Date(r.measurements_booked_for).getTime() > Date.now()) {
      return { key: "measure", label: `Mælingartími ${dayTime(r.measurements_booked_for)}`, cta: "Opna", tone: "waiting" };
    }
    return r.staff_import_consent_at
      ? { key: "report", label: "Bíður skýrslu", cta: "Lesa inn", tone: "normal" }
      : { key: "consent", label: "Bíður skýrslu · ekkert leyfi til að sækja hana", cta: "Biðja um leyfi", tone: "normal" };
  }
  // undefined = the route does not send the field yet: unknown, so do not
  // hold everybody at a step nobody can see.
  if (r.doctor_interview_done_at === null) {
    return { key: "doctor", label: "Læknisviðtal í Medalia", cta: "Merkja lokið", tone: "waiting" };
  }
  return { key: "book", label: "Áætlunarsamtal ekki bókað", cta: "Bóka áætlunarsamtal", tone: "normal" };
}

/**
 * Where a task's button lands: the tab or sheet where the work is done.
 *
 * Every queue CTA used to open the client on Staða, so "Bóka viðtal" landed
 * somewhere with nothing to book. One table, so the queue, the client
 * header's "Næsta verk" and the day's appointments all agree.
 */
export function taskTarget(key: string): PatientNav {
  switch (key) {
    case "partner": return { tab: "status", sheet: "referral" };
    case "report": return { tab: "report" };
    case "consent": return { tab: "status", sheet: "messages" };
    case "activate": return { tab: "status", sheet: "orders" };
    case "nudge": return { tab: "status", sheet: "messages" };
    case "interview":
    case "book":
    case "followup":
    case "bookfollow": return { tab: "status", sheet: "interview" };
    case "plan":
    case "swaps": return { tab: "plan" };
    // "doctor", "measure", "activating": the Staða checklist says it.
    default: return { tab: "status" };
  }
}

// ── Queue flags ─────────────────────────────────────────────────────────────

/** Urgency + waiting time, computed from the queue row (no extra queries). */
export type RowFlags = { rank: number; waitingDays: number; interviewToday: boolean; nextAt: string | null; nextWhat: string };

export function rowFlags(r: Row, t: Task): RowFlags {
  const interviewToday = isToday(r.interview_booked_for) && !r.interview_done_at;
  const waitingDays = Math.max(0, Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400_000));
  const upcoming: { at: string | null; what: string }[] = [
    { at: !r.interview_done_at ? r.interview_booked_for : null, what: "Áætlunarsamtal" },
    { at: !r.followup_done_at ? r.followup_booked_for : null, what: "Eftirfylgd" },
    { at: !r.measurements_done_at ? r.measurements_booked_for : null, what: "Mælingartími" },
  ].filter((x): x is { at: string; what: string } => !!x.at).sort((a, b) => a.at.localeCompare(b.at));
  const rank = t.tone === "urgent" ? 0 : t.tone === "normal" ? 1 : 2;
  return { rank, waitingDays, interviewToday, nextAt: upcoming[0]?.at ?? null, nextWhat: upcoming[0]?.what ?? "" };
}

/** The dot beside a task. Decorative: the label beside it says the same. */
export const TONE_DOT: Record<Task["tone"], string> = { urgent: "bg-hc-signal-red", normal: "bg-hc-signal-yellow", waiting: "bg-hc-control" };
