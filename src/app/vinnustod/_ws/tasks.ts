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
import { day, dayTime, daysSince, isToday, minutesSince, time } from "./format";

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
export type Task = { key: string; label: string; cta: string; tone: "urgent" | "normal" | "waiting"; doctorOnly?: boolean };

export function nextTask(r: Row | Journey, isDoctor: boolean): Task {
  if (isDoctor && r.doctor_review_requested_at && !r.doctor_reviewed_at)
    return { key: "review", label: "Beiðni um mat læknis", cta: "Meta", tone: "urgent", doctorOnly: true };
  if (isDoctor && "open_referrals" in r && (r.open_referrals ?? 0) > 0)
    return { key: "referral", label: `${r.open_referrals} ${r.open_referrals === 1 ? "tilvísun bíður" : "tilvísanir bíða"} læknis`, cta: "Afgreiða", tone: "urgent", doctorOnly: true };
  // An imported report waits for a doctor, whatever else is going on.
  if (isDoctor && r.report_imported_at && !r.report_generated_at)
    return { key: "report", label: "Innflutt skýrsla bíður staðfestingar", cta: "Staðfesta", tone: "urgent", doctorOnly: true };
  switch (r.stage) {
    case "protocol": return { key: "activate", label: "Hefur ekki virkjað í gátt", cta: "Senda áminningu", tone: "waiting" };
    case "tests": {
      const todo = [!(r.blood_test_done_at || r.blood_results_at) && "blóðprufa", !r.measurements_done_at && "mælingar"].filter(Boolean).join(" og ");
      return { key: "tests", label: `Bíður: ${todo}`, cta: "Skrá", tone: "waiting" };
    }
    case "report":
      return isDoctor
        ? { key: "report", label: "Skýrsla bíður staðfestingar", cta: "Staðfesta", tone: "urgent", doctorOnly: true }
        : { key: "report", label: "Bíður þess að læknir staðfesti skýrslu", cta: "Skoða skýrslu", tone: "waiting" };
    case "interview":
      return r.interview_booked_for
        ? { key: "interview", label: `Viðtal ${isToday(r.interview_booked_for) ? `í dag kl. ${time(r.interview_booked_for)}` : dayTime(r.interview_booked_for)}`, cta: "Hefja viðtal", tone: isToday(r.interview_booked_for) ? "urgent" : "normal" }
        : { key: "book", label: "Viðtal ekki bókað", cta: "Bóka viðtal", tone: "normal" };
    case "plan": return { key: "plan", label: "Viðtali lokið, áætlun vantar", cta: "Klára áætlun", tone: "urgent" };
    case "action": {
      // Follow-up done: nothing is owed until the re-evaluation.
      if (r.followup_done_at) return { key: "done", label: "Eftirfylgd lokið", cta: "Opna", tone: "waiting" };
      // A week of silence since the plan went out: worth a message.
      if (!r.followup_booked_for && "ticks_7d" in r && (r.ticks_7d ?? 0) === 0 && daysSince(r.plan_published_at) >= 7 && daysSince(r.plan_published_at) < 90) {
        return { key: "nudge", label: r.last_tick_on ? `Ekkert merkt síðan ${day(r.last_tick_on)}` : "Hefur ekki merkt neitt í áætluninni", cta: "Senda hvatningu", tone: "normal" };
      }
      if (r.followup_booked_for && !r.followup_done_at) {
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
    default: return { key: "none", label: "", cta: "Opna", tone: "waiting" };
  }
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
    case "review":
    case "referral": return { tab: "status", sheet: "referral" };
    case "report":
    case "tests": return { tab: "report" };
    case "activate": return { tab: "status", sheet: "orders" };
    case "nudge": return { tab: "status", sheet: "messages" };
    case "interview":
    case "book":
    case "followup":
    case "bookfollow": return { tab: "status", sheet: "interview" };
    case "plan": return { tab: "plan" };
    default: return { tab: "status" };
  }
}

// ── Queue flags ─────────────────────────────────────────────────────────────

/** Urgency + waiting time, computed from the queue row (no extra queries). */
export type RowFlags = { rank: number; waitingDays: number; reportLate: boolean; interviewToday: boolean; nextAt: string | null; nextWhat: string };

export function rowFlags(r: Row, t: Task): RowFlags {
  const reportLate = r.stage === "report" && !r.report_generated_at && minutesSince(r.blood_results_at) >= 5;
  const interviewToday = isToday(r.interview_booked_for) && !r.interview_done_at;
  const waitingDays = Math.max(0, Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400_000));
  const upcoming: { at: string | null; what: string }[] = [
    { at: !r.interview_done_at ? r.interview_booked_for : null, what: "Viðtal" },
    { at: !r.followup_done_at ? r.followup_booked_for : null, what: "Eftirfylgd" },
    { at: !r.measurements_done_at ? r.measurements_booked_for : null, what: "Mælingar" },
    { at: !(r.blood_test_done_at || r.blood_results_at) ? r.blood_test_booked_for : null, what: "Blóðprufa" },
  ].filter((x): x is { at: string; what: string } => !!x.at).sort((a, b) => a.at.localeCompare(b.at));
  const rank = t.tone === "urgent" || reportLate ? 0 : t.tone === "normal" ? 1 : 2;
  return { rank, waitingDays, reportLate, interviewToday, nextAt: upcoming[0]?.at ?? null, nextWhat: upcoming[0]?.what ?? "" };
}

/** The dot beside a task. Decorative: the label beside it says the same. */
export const TONE_DOT: Record<Task["tone"], string> = { urgent: "bg-hc-signal-red", normal: "bg-hc-signal-yellow", waiting: "bg-hc-control" };
