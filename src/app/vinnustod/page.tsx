"use client";

// Lifeline vinnustöð — built around how a nurse works with health-check
// clients (Vera and Lifeline nurses, Lifeline doctors as backup):
//
//   Í dag          today's appointments + a to-do list where every client has
//                  exactly one clear next action
//   Skjólstæðingar everyone, searchable, by stage
//   Client page    progress through the eight steps, "næsta verk", and a
//                  guided interview: prepare → talk (notes per pillar) →
//                  assess (ask a doctor / referral) → plan → finish & book the
//                  3-month follow-up
//
// Own cookie auth (src/lib/hc/ws-auth.ts); nurses never need /admin.

import EmptyState from "@/app/components/hc/EmptyState";
import { chime } from "@/lib/hc/chime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bell, CalendarClock, Check, ChevronRight, ClipboardList, CreditCard, Droplet, ExternalLink, Video,
  Mail, MessageSquare, Phone, Ruler, Send, Stethoscope,
} from "lucide-react";
import LifelineLogo from "@/app/components/LifelineLogo";
import PinPad from "@/app/components/hc/PinPad";
import PlanBuilder from "@/app/components/hc/PlanBuilder";
import CoachAsClient from "@/app/components/hc/CoachAsClient";
import CoachBookings from "@/app/components/hc/CoachBookings";
import PlanChanges from "@/app/components/hc/PlanChanges";
import ClientThread from "@/app/components/hc/ClientThread";
import CalendarConnect, { type CalendarApi } from "@/app/components/hc/CalendarConnect";
import ClientsView from "@/app/components/hc/ClientsView";
import WeekAhead from "@/app/components/hc/WeekAhead";
import CoachInbox from "@/app/components/hc/CoachInbox";
import TeachingLibrary from "@/app/components/hc/TeachingLibrary";
import { hcBtn, hcPage, hcTabs } from "@/app/components/hc/ui";
import KnowledgeSearch, { useKnowledgeHotkey } from "@/app/components/hc/KnowledgeSearch";
import { cookieApi, useWsApi, type WsApi } from "@/app/components/hc/ws-api";
import WsHeader, { type WsMenuItem } from "@/app/components/hc/WsHeader";
import WsSettings from "@/app/components/hc/WsSettings";
import { type FlowStep } from "@/app/components/hc/Flow";
import { type Checkpoint } from "@/app/components/hc/StatusStrip";
import ResultsCard, { sexOf, type HcResult } from "@/app/components/hc/ResultsCard";
import WsRequests from "@/app/components/hc/WsRequests";
import ReportIntake from "@/app/components/hc/ReportIntake";
import ReportView from "@/app/components/hc/ReportView";
import BeforeAfter from "@/app/components/hc/BeforeAfter";
import type { Comparison } from "@/lib/hc/compare";
import type { Grunnheilsa, Signal as ReportSignal } from "@/lib/hc/grunnheilsa";
import type { ReportReference } from "@/lib/hc/knowledge";
import Referrals, { type ReferralSuggestion } from "@/app/components/hc/Referrals";
import BookVideo from "@/app/components/hc/BookVideo";
import type { Referral } from "@/lib/hc/referrals";
import { adherence, NUDGE_IS, nudgeStatus, type ActionLog, type ActionPref } from "@/lib/hc/adherence";
import { EVENT_LABELS, type JourneyEvent } from "@/lib/hc/events-labels";
import { upcomingAppointments } from "@/lib/hc/upcoming";
import { PILLAR_META, type InterviewNotes, type PlanGoal, type Pillar, type PlanItem } from "@/lib/hc/types";
import { MESSAGE_TEMPLATES, smsSize, type MessageTemplateKey } from "@/lib/hc/message-templates";

// ── Types ───────────────────────────────────────────────────────────────────

interface Me { id: string; name: string; email: string; organization: string; role: "nurse" | "doctor" | "admin"; has_pin: boolean }
interface Row {
  id: string; client_name: string; client_phone: string | null; client_dob: string | null; stage: string; entry: string;
  /** The journey's client row is missing — a data fault, not a nameless person. */
  client_missing?: boolean;
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
interface Journey extends Omit<Row, "client_name" | "client_phone" | "client_dob" | "plan_status"> {
  referral_note: string | null; referred_at: string | null; doctor_review_note: string | null;
  interview_notes: InterviewNotes | null; followup_notes?: InterviewNotes | null; location_id: string | null;
}
interface Detail {
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
  ai_proposal: React.ComponentProps<typeof PlanBuilder>["readyProposal"];
  audit: { actor: string; action: string; at: string; note: string | null }[];
  plan: { status: string; published_at: string | null; headline: string | null; modules: PlanItem[] } | null;
  location: { name: string } | null;
  actor: { label: string; isDoctor: boolean; name: string | null };
  messages: { id: string; channel: "sms" | "email"; recipient: string; template: string | null; subject: string | null; body: string; status: string; error: string | null; sent_by: string; sent_at: string }[];
}
/** The workstation is either on the home screen or on one client. */
/** The three places on the home side, plus a client's workspace. */
type HomeTab = "today" | "messages" | "calendar" | "clients" | "teaching" | "settings";

/**
 * How many participants are waiting on a reply, kept current.
 *
 * The inbox already counted this and drew its own dots, but only once you
 * were looking at it — a coach on Í dag had no way to learn a message had
 * arrived. Same two triggers as the participant's bell: a poll while the
 * tab is visible, and an immediate read when it comes back.
 */
function useCoachUnread(api: (u: string, i?: RequestInit) => Promise<Response>) {
  const [unread, setUnread] = useState(0);
  const rung = useRef(0);
  const load = useCallback(async () => {
    /*
     * Messages AND beiðnir, counted together.
     *
     * The badge only knew about chat, so a participant could ask for
     * something through WsRequests and nothing announced it — no dot, no
     * pulse, no chime, and the coach found out when they next happened to
     * scroll past the section. Both mean the same thing to a coach ("a
     * person is waiting on you"), so they share one signal rather than
     * competing for attention with two.
     */
    const [r, rq] = await Promise.all([
      api("/api/vinnustod/chat").catch(() => null),
      api("/api/vinnustod/requests?status=open").catch(() => null),
    ]);
    if (!r?.ok) return;
    const j = await r.json().catch(() => null);
    const rj = rq?.ok ? await rq.json().catch(() => null) : null;
    const n = Number(j?.unread ?? 0) + (Array.isArray(rj?.requests) ? rj.requests.length : 0);
    // Deferred: this runs on a path an effect calls, and the compiler
    // objects to setting state synchronously there.
    setTimeout(() => setUnread(n), 0);
    // Chime on a rise only, so a page that already had three waiting does
    // not announce them again every fifteen seconds.
    if (n > rung.current) chime();
    rung.current = n;
  }, [api]);
  useEffect(() => {
    void load();
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const id = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [load]);
  return { unread, reloadUnread: load };
}
type View = { home: HomeTab } | { patient: string; compose?: boolean; step?: string };

// ── Helpers ─────────────────────────────────────────────────────────────────

// The login and PIN screens only exist in the standalone workstation, so they
// always talk over the nurse's own cookie session.
const ws = cookieApi;

/** Lifeline staff (/admin/vinnustod): same calendar, Bearer auth, so Google consent starts with a POST. */
const staffCalendar = (api: WsApi): CalendarApi => ({
  call: api,
  googleStatusUrl: "/api/vinnustod/google",
  startGoogle: async () => {
    const r = await api("/api/vinnustod/google/start", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (j.url) window.location.href = j.url; else alert(j.error || "Ekki tókst að tengja Google.");
  },
  icsTokenUrl: "/api/vinnustod/calendar-token",
  subscriptionName: "Lifeline — viðtöl",
});

const WORKER_CALENDAR: CalendarApi = {
  call: ws,
  googleStatusUrl: "/api/vinnustod/google",
  startGoogle: async () => { window.location.href = "/api/vinnustod/google/start"; },
  icsTokenUrl: "/api/vinnustod/calendar-token",
  subscriptionName: "Lifeline — viðtöl",
};

// Icelandic dates/times written out by hand: a browser without Icelandic ICU
// data silently falls back to English ("Wed, Sep 23, 01:24 PM").
const WEEKDAYS_IS = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];
const WEEKDAYS_LONG_IS = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
const MONTHS_LONG_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
/** "miðvikudagur 23. september" */
/** "2026-09-20" → "20. september 2026". A browser without the Icelandic
 *  locale prints "September 20, 2026" mid-page, so this is done by hand. */
const isDate = (iso: string | null) => {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])}. ${MONTHS_LONG_IS[Number(m[2]) - 1]} ${m[1]}` : (iso ?? "");
};

const longDate = (d: Date) => `${WEEKDAYS_LONG_IS[d.getDay()]} ${d.getDate()}. ${MONTHS_LONG_IS[d.getMonth()]}`;
const MONTHS_IS = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const clock = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const time = (iso: string | null) => (iso ? clock(new Date(iso)) : "");
const dayTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${WEEKDAYS_IS[d.getDay()]} ${d.getDate()}. ${MONTHS_IS[d.getMonth()]} kl. ${clock(d)}`;
};
const day = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}. ${MONTHS_IS[d.getMonth()]}`;
};
const isToday = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000) : 0);
const minutesSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 60000) : 0);
function age(dob: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  let a = new Date().getFullYear() - d.getFullYear();
  const m = new Date().getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) a--;
  return a > 0 && a < 120 ? `${a} ára` : "";
}
const cleanName = (n: string | null) => (n || "—").replace(/^Prufa\s*[–-]\s*/, "");
const isTest = (n: string | null) => /^Prufa\s*[–-]/.test(n || "");
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// Shared with the participant's pages (components/hc/ui.ts, --hc-* tokens).
const btn = hcBtn.base;
const btnPrimary = hcBtn.primary;
const btnDark = hcBtn.dark;
const btnSecondary = hcBtn.secondary;
const btnGhost = hcBtn.ghost;

/** What the next action for a client is — the heart of the to-do list. */
type Task = { key: string; label: string; cta: string; tone: "urgent" | "normal" | "waiting"; doctorOnly?: boolean };
function nextTask(r: Row | Journey, isDoctor: boolean): Task {
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
        : { key: "report", label: "Bíður þess að læknir staðfesti skýrslu", cta: "Opna", tone: "waiting" };
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
        return { key: "followup", label: `Eftirfylgd ${dayTime(r.followup_booked_for)}`, cta: "Opna", tone: isToday(r.followup_booked_for) ? "urgent" : "normal" };
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

// ── Root ────────────────────────────────────────────────────────────────────

export default function Vinnustod() {
  return <WorkstationApp mode="worker" />;
}

/**
 * The workstation itself. In "worker" mode it owns sign-in (the partner
 * nurse's own session); in "staff" mode the admin layout has already
 * authenticated, so there is nothing to sign into and no PIN to set.
 */
export function WorkstationApp({ mode }: { mode: "worker" | "staff" }) {
  const api = useWsApi();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/me");
    setMe(r.ok ? (await r.json()).me : null);
  }, [api]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  if (me === undefined) return <div className="p-10 text-center text-slate-600">Hleð…</div>;
  if (me === null) {
    return mode === "worker" ? <Login onDone={load} /> : (
      <div className="p-10 text-center text-slate-600">
        Vinnustöðin er opin starfsfólki Lifeline með tveggja þátta staðfestingu.
      </div>
    );
  }
  return <Workstation me={me} mode={mode} onLogout={() => setMe(null)} onPinSet={load} />;
}

// ── Shell ───────────────────────────────────────────────────────────────────

const HOME_TABS: HomeTab[] = ["today", "calendar", "clients", "teaching", "settings"];
const isHomeTab = (v: unknown): v is HomeTab => typeof v === "string" && (HOME_TABS as string[]).includes(v);

function readView(): View {
  if (typeof window === "undefined") return { home: "today" };
  const q = new URLSearchParams(window.location.search);
  const p = q.get("p");
  // ?s= used to pick a tab on the client page; the flow opens itself now, so
  // old links still land on the right client and simply ignore it.
  if (p) return { patient: p, compose: q.get("m") === "1" };
  const t = q.get("t");
  return { home: isHomeTab(t) ? t : "today" };
}

function Workstation({ me, mode, onLogout, onPinSet }: { me: Me; mode: "worker" | "staff"; onLogout: () => void; onPinSet: () => void }) {
  const api = useWsApi();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [view, setViewState] = useState<View>(readView);
  const [showPin, setShowPin] = useState(false);
  const [showBook, setShowBook] = useState(false);
  const [showCal, setShowCal] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.get("google") === "connected" || q.get("google") === "error";
  });
  const isDoctor = me.role === "doctor" || me.role === "admin";

  const setView = useCallback((v: View) => {
    setViewState(v);
    const u = new URL(window.location.href);
    u.searchParams.delete("p"); u.searchParams.delete("s"); u.searchParams.delete("m"); u.searchParams.delete("t");
    if ("patient" in v) {
      u.searchParams.set("p", v.patient);
      if (v.compose) u.searchParams.set("m", "1");
    } else if (v.home !== "today") {
      u.searchParams.set("t", v.home);
    }
    window.history.pushState(null, "", u);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const onPop = () => setViewState(readView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/queue");
    if (r.status === 401) { onLogout(); return; }
    if (r.ok) setRows((await r.json()).journeys);
  }, [api, onLogout]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 60_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  const logout = async () => { await ws("/api/vinnustod/auth/logout", { method: "POST" }); onLogout(); };
  useKnowledgeHotkey(() => setShowBook(true));
  const open = (id: string, compose = false, step?: string) => setView({ patient: id, compose, step });

  const { unread: coachUnread, reloadUnread } = useCoachUnread(api);

  const menu: WsMenuItem[] = [
    { label: "Fletta upp", icon: "book", hint: "⌘K", onClick: () => setShowBook(true) },
    /* Calendar, PIN and sign-out moved to the Stillingar tab: they were
       only reachable from this menu, which is where settings go to be
       forgotten. Sign-out stays here too — it is the one thing somebody
       needs in a hurry and should not have to change tab for. */
    ...(mode === "worker" ? [
      { label: "Útskrá", icon: "logout" as const, onClick: () => void logout() },
    ] : []),
  ];

  return (
    <div className={hcPage.staff}>
      <WsHeader name={me.name} role={me.role === "doctor" ? "læknir" : me.role === "admin" ? "stjórnandi" : "hjúkrunarfræðingur"} items={menu} />

      {/* max-w-6xl, not 5xl: the home screen is two columns now, and a
          workstation on a laptop was leaving a third of the screen as
          empty grey either side of a single column. */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {rows === null ? <p className="py-10 text-center text-slate-600">Hleð…</p>
          : "patient" in view
            ? <PatientView key={view.patient} id={view.patient} compose={!!view.compose} me={me}
                onBack={() => (window.history.length > 1 ? window.history.back() : setView({ home: "today" }))} onChanged={load} />
            : (
              <div className="space-y-4">
                <nav className={hcTabs.bar} aria-label="Vinnustöðin">
                  {/* Skilaboð sits second: it is the one tab where somebody
                      is waiting on an answer, and the only reason the
                      participants' Þjálfari page is a conversation rather
                      than an outbox. */}
                  {([["today", "Yfirlit"], ["teaching", "Fræðsla"], ["settings", "Stillingar"]] as const).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setView({ home: k })}
                      aria-current={view.home === k ? "page" : undefined}
                      className={`relative ${hcTabs.tab(view.home === k)}`}>
                      {label}
                      {/* Someone is waiting on a reply. Pulses so it is
                          noticed from across a room, and carries the count
                          because "three people waiting" is a different
                          morning from "one". */}
                      {/* The badge follows the inbox onto Yfirlit. */}
                      {k === "today" && coachUnread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center">
                          <span className="absolute inset-0 animate-hc-ping rounded-full bg-red-500/40 motion-reduce:hidden" aria-hidden />
                          <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                            {coachUnread > 9 ? "9+" : coachUnread}
                          </span>
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
                {/* Two surfaces, not five. Skilaboð, Dagatal and
                    Skjólstæðingar all moved inside Home, each with one
                    home; Fræðsla stays its own because it is a library you
                    consult, not part of a day's work. */}
                {view.home === "settings" && (
                  <WsSettings
                    me={me}
                    mode={mode}
                    onPin={() => setShowPin(true)}
                    onCalendar={() => setShowCal(true)}
                    onLogout={() => void logout()}
                  />
                )}

                {view.home !== "teaching" && view.home !== "settings" && (
                  <Home rows={rows} me={me} isDoctor={isDoctor} onOpen={open} onChanged={load} onRead={reloadUnread} />
                )}
                {view.home === "teaching" && <TeachingLibrary api={api} />}
              </div>
            )}
      </main>

      <KnowledgeSearch api={api} open={showBook} onClose={() => setShowBook(false)} />
      {showPin && <PinModal onClose={() => setShowPin(false)} onDone={() => { setShowPin(false); onPinSet(); }} />}
      <CalendarConnect api={mode === "worker" ? WORKER_CALENDAR : staffCalendar(api)} open={showCal} onClose={() => setShowCal(false)}
        intro="Viðtöl og eftirfylgd sem þér eru úthlutuð birtast í dagatalinu þínu um leið og þau eru bókuð. Aðeins upphafsstafir skjólstæðings koma fram." />
    </div>
  );
}

// ── Heim: skýrsla inn, leit, dagurinn, það sem bíður ───────────────────────

/*
 * One page, and each function with exactly one home.
 *
 * This was five tabs and three of them overlapped: the client roster and
 * its search existed here AND as the whole Skjólstæðingar tab; unanswered
 * messages were surfaced by Caseload AND listed by CoachInbox, which reads
 * the same hc_chat rows; today's bookings were computed here from `rows`
 * and drawn again by the calendar.
 *
 * So: the queue is `waiting` below, Beiðnir is WsRequests, the week is
 * WeekAhead, the roster is ClientsView, messages are CoachInbox, intake is
 * ReportIntake. Caseload and the local agenda are no longer mounted.
 *
 * NOTE, a real loss and not a tidy-up: the roster that used to live here
 * had stage filters (Heilsufarsskoðun · Skýrsla · Viðtal · Áætlun · Í
 * aðgerð) and sorts (mest aðkallandi · næsti tími · beðið lengst · nafn).
 * ClientsView has a search and an Allir/Hópar switch and neither of those.
 * With three clients it will not show; at fifty it will. Those components
 * are still in this file, unmounted, so porting the filters is a smaller
 * job than rebuilding them.
 */
function Home({ rows, me, isDoctor, onOpen, onChanged, onRead }: {
  rows: Row[]; me: Me; isDoctor: boolean;
  onOpen: (id: string, compose?: boolean, step?: string) => void;
  onChanged: () => void;
  /** Clears the tab's unread badge without waiting for the next poll. */
  onRead: () => void;
}) {
  const api = useWsApi();
  const hour = new Date().getHours();
  const greet = hour < 11 ? "Góðan daginn" : hour < 18 ? "Góðan dag" : "Gott kvöld";

  const enriched = useMemo(
    () => rows.map((r) => { const t = nextTask(r, isDoctor); return { r, t, f: rowFlags(r, t) }; }),
    [rows, isDoctor],
  );


  // What is waiting on this nurse, most pressing first. One list, no groups.
  const waiting = useMemo(
    () => enriched.filter((x) => x.f.rank < 2).sort((a, b) => a.f.rank - b.f.rank || b.f.waitingDays - a.f.waitingDays),
    [enriched],
  );


  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-600">{longDate(new Date())}</p>
        <h1 className="text-2xl font-bold text-slate-900">{greet}, {me.name.split(" ")[0]}</h1>
      </div>

      {/* ── The work, and the tools to do it with ──────────────────
          On a laptop this was one column down the middle of a 1280px
          screen with empty grey either side, and five cards of identical
          weight stacked in it: the caseload, the drop zone, a search box,
          the queue, a link. Nothing said which mattered.

          Two columns from lg up. The left is the work — who needs you,
          what is waiting. The right is the tools you reach for, which are
          real but are not why you opened the page: dropping a report in,
          looking somebody up. Below lg it stacks in the same order, so a
          phone still gets the work first. */}
      {/* The work on the left, the things you reach for on the right.
          Stacks in this order below lg, so a phone gets the queue first. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* What the journeys themselves say needs doing. Not the same
              list as WsRequests below, which is what participants have
              ASKED for — two different questions that both look like a
              queue, and I nearly collapsed them into one by mistake. */}
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
              Bíður þín {waiting.length > 0 && <span className="rounded-full bg-hc-brand-dark px-2 py-0.5 text-[11px] text-white">{waiting.length}</span>}
            </h2>
            {/* Quiet is deliberate: an empty "bíður þín" is this panel's
                most common state, and 150px of centred card to say there is
                nothing to do pushes the work below the fold on the days
                there is some. */}
            {waiting.length === 0 ? (
              <EmptyState variant="done" quiet title="Ekkert bíður" body="Allt sem kallar á þig er afgreitt." />
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-hc-hairline bg-white">
                {waiting.map(({ r, t, f }) => <WaitingRow key={r.id} r={r} t={t} f={f} onOpen={onOpen} onChanged={onChanged} />)}
              </ul>
            )}
          </section>

          <WsRequests api={api} onOpen={onOpen} />

          {/* The week, in place of the old 15-minute grid. */}
          <WeekAhead api={api} onOpenClient={(id) => onOpen(id)} />

          {/* The roster and its search, once. */}
          <ClientsView api={api} onOpenClient={(id) => onOpen(id)} />
        </div>

        <aside className="min-w-0 space-y-6">
          {/* Messages, once: Caseload used to surface unanswered ones too. */}
          <CoachInbox api={api} onRead={onRead} />
          <ReportIntake api={api} onOpen={(journeyId) => onOpen(journeyId)} narrow />
        </aside>
      </div>
    </div>
  );
}


/** One thing waiting on the nurse: who, what, and the single next action. */
function WaitingRow({ r, t, f, onOpen }: {
  r: Row; t: Task; f: RowFlags; onOpen: (id: string, compose?: boolean, step?: string) => void; onChanged: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <button type="button" onClick={() => onOpen(r.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[t.tone]}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">{cleanName(r.client_name)} {isTest(r.client_name) && <TestBadge />}</span>
          <span className="block text-sm text-slate-600">
            <span className={f.reportLate ? "font-semibold text-red-600" : ""}>{t.label}</span>
            {f.waitingDays > 2 && <span className="text-slate-500"> · {f.waitingDays} d.</span>}
          </span>
        </span>
      </button>
      {/* Outlined, not solid.
          Every row in this list carries the same action, so a filled brand
          button on each one made a column of green slabs that competed with
          the thing they were attached to — and with the tab bar, which is
          now the same colour. The row's dot and its reason are what should
          catch the eye; the action just has to be obviously clickable. */}
      <button type="button" onClick={() => onOpen(r.id, t.key === "nudge")}
        className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-hc-brand/40 bg-white px-3 text-xs font-semibold text-hc-brand-dark transition hover:bg-hc-brand-surface">
        {t.cta}
      </button>
    </li>
  );
}

function TestBadge() {
  return <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase text-amber-800">Prufa</span>;
}


// ── Skjólstæðingar ──────────────────────────────────────────────────────────

/** Urgency + waiting time, computed from the queue row (no extra queries). */
type RowFlags = { rank: number; waitingDays: number; reportLate: boolean; interviewToday: boolean; nextAt: string | null; nextWhat: string };
function rowFlags(r: Row, t: Task): RowFlags {
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

const TONE_DOT: Record<Task["tone"], string> = { urgent: "bg-red-500", normal: "bg-amber-400", waiting: "bg-slate-300" };



// ── Client page ─────────────────────────────────────────────────────────────

/*
 * No `step` prop any more.
 *
 * It carried the old ?s= deep link, but readView() has ignored that param
 * since the flow started opening itself, so the prop was always undefined
 * and the tab landing is computed from the journey instead.
 */
function PatientView({ id, compose, me, onBack, onChanged }: {
  id: string; compose: boolean; me: Me; onBack: () => void; onChanged: () => void;
}) {
  const api = useWsApi();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  /**
   * Which workspace tab is showing. Staða, always, until the coach moves.
   *
   * I first wired this to landOn, which works out the step worth opening —
   * a report that just arrived, a plan that is missing. Clever, and wrong:
   * on a journey already in action it landed on Forskoðun, and Mads asked
   * for a status dashboard as the main view. Opening a client should put
   * the same screen in front of you every time, so you learn where things
   * are; the queue on Í dag is what says which client is urgent and why.
   */
  const [wsTab, setWsTab] = useState<"status" | "report" | "plan" | "preview">("status");
  const [sheet, setSheet] = useState<"messages" | "referral" | "orders" | "history" | "report" | null>(null);
  const isDoctor = me.role === "doctor" || me.role === "admin";

  const load = useCallback(async () => {
    const r = await api(`/api/vinnustod/journeys/${id}`);
    if (!r.ok) { setErr(r.status === 404 ? "Skjólstæðingur fannst ekki eða er ekki á þínu svæði." : "Villa kom upp."); return; }
    setD(await r.json());
  }, [api, id]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const record = useCallback(async (payload: Record<string, unknown>): Promise<string | null> => {
    const r = await api(`/api/vinnustod/journeys/${id}`, { method: "POST", body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.error || "Tókst ekki.";
    await load();
    onChanged();
    return null;
  }, [api, id, load, onChanged]);

  const backBtn = (
    <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-hc-hairline bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100"><ArrowLeft className="h-4 w-4" /></span> Til baka
    </button>
  );
  if (err) return <div className="space-y-4">{backBtn}<p className="rounded-2xl bg-white p-6 text-slate-600">{err}</p></div>;
  if (!d) return <div className="space-y-4">{backBtn}<p className="p-6 text-slate-600">Hleð…</p></div>;

  const j = d.journey;
  const kt = d.patient.kennitala;
  /* onJump is how a step hands off to another — InterviewStep's "Klára
     áætlun" calls onJump("plan"). With tabs that means moving the tab. */
  const steps = buildSteps({ d, isDoctor, api, record, reload: load, onChanged, onJump: (k) => setWsTab(tabFor(k)) });
  // Open the step that needs attention; on a finished journey fall back to
  // what comes next, so the page is never just a wall of closed rows.
  const live = steps.filter((x) => !x.hidden);
  // Once a report is in, that is what the nurse is here to read — the whole
  // interview is spent on it. Opening the current step instead buried it
  // behind a one-line summary and it looked as though the questionnaire had
  // never imported.
  // …until the interview is booked: from then on the nurse is here for the
  // interview (the report sits beside it) or for what comes after.
  /** Which tab holds a step. One rule, so landing and jumping agree. */
  const tabFor = (k: string | null | undefined): "status" | "report" | "plan" | "preview" =>
    k === "results" ? "report" : k === "plan" ? "plan" : k === "live" ? "preview" : "status";

  // The next video appointment, so the call is one click from the top.
  const call = upcomingAppointments(j, null).find((x) => x.video) ?? null;
  // Payment as a chip on the status line rather than a drawer of its own.
  const paid = d.orders.some((o) => o.paid_at);
  const code = d.orders.find((o) => o.activation_code);

  // The tests are milestones, not steps with work in them, so they live on the
  // line and nowhere else. After them come the steps, which do carry work.
  // The nurse's timeline, not the customer's.
  //
  // These were briefly the same list. They should not be: the customer's
  // journey starts with signing up, reading the welcome lecture and paying,
  // none of which the nurse does anything about — and it collapses the blood
  // draw, the results coming back and the measurements into one step, which
  // are exactly the three things she chases separately. Her line starts where
  // her work starts.
  const checkpoints: Checkpoint[] = [
    { key: "results", label: "Blóðprufa", state: j.blood_test_done_at || j.blood_results_at ? "done" : "waiting",
      detail: j.blood_results_at ? day(j.blood_results_at) : j.blood_test_booked_for ? day(j.blood_test_booked_for) : "ekki bókuð" },
    { key: "results", label: "Svör", state: j.blood_results_at ? "done" : "waiting",
      detail: j.blood_results_at ? day(j.blood_results_at) : "bíður" },
    { key: "results", label: "Mælingar", state: j.measurements_done_at ? "done" : "waiting",
      detail: j.measurements_done_at ? day(j.measurements_done_at) : j.measurements_booked_for ? day(j.measurements_booked_for) : "ekki bókaðar" },
    ...live.map((x) => ({
      key: x.key,
      label: x.title.replace(/ eftir 3 mánuði$/, ""),
      state: x.state,
      // The step's own status is written for a full-width row; under a
      // checkpoint it has to survive in one short line.
      detail: shortStatus(x.status),
    })),
  ];

  // Whatever the last plan proposal suggested referring on.
  const aiReferrals = d.ai_referrals ?? [];

  /*
   * A checkpoint click moves the tab that holds that step.
   *
   * This used to set openStep, which the single-panel layout read. With
   * tabs nothing read it, so the strip would have looked clickable and done
   * nothing — the quiet kind of regression a refactor leaves behind.
   */
  const jump = (k: string) => setWsTab(tabFor(k));

  /*
   * Four tabs, not nine steps.
   *
   * The rail was a wizard used as navigation: nine stops across ~1100px, so
   * every label truncated ("Áætlunin hjá sk…", "Eins og skjólstæði…"), and
   * inside it the plan builder ran its own five-step wizard — two sets of
   * numbered steps on one screen. A health check does have an order, but a
   * coach opening a client is not walking it; they are going to one of four
   * places. Mads' spec, and it is the right shape.
   *
   * The step bodies are untouched and reused by key. The sequence survives
   * where it is still true: as the checkpoint strip inside Staða, which is
   * what answers "er heilsufarsskoðunin búin?".
   */
  const byKey = new Map(live.map((x) => [x.key, x]));
  const TABS = [
    { key: "status", label: "Staða" },
    { key: "report", label: "Skýrsla" },
    { key: "plan", label: "Aðgerðaáætlun" },
    { key: "preview", label: "Forskoðun" },
  ] as const;
  type WsTab = typeof TABS[number]["key"];
  const tab: WsTab = wsTab;

  return (
    <div className="space-y-4">
      {backBtn}

      {/* Who this is, and how to reach them. */}
      {/* Who this is: reference, not work. Hairline and flat. */}
      <section className="rounded-2xl border border-hc-hairline bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">
            {cleanName(d.patient.full_name).split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-slate-900">{cleanName(d.patient.full_name)}</h1>
            <p className="truncate text-sm text-slate-600">
              {[kt ? `${kt.slice(0, 6)}-${kt.slice(6)}` : null, age(d.patient.date_of_birth), d.location?.name].filter(Boolean).join(" · ")}
              {isTest(d.patient.full_name) && <> <TestBadge /></>}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
          {d.patient.phone && (
            <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              <a href={`tel:${d.patient.phone}`} className="hover:underline">{d.patient.phone}</a>
            </span>
          )}
          {d.patient.email && (
            <span className="inline-flex min-w-0 items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
              <a href={`mailto:${d.patient.email}`} className="truncate hover:underline">{d.patient.email}</a>
            </span>
          )}
          {/* Payment and the activation code are facts about this person, so
              they sit with the rest of them rather than on the timeline,
              where they had nothing to do with the steps around them. */}
          <button type="button" onClick={() => setSheet("orders")}
            className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 hover:bg-slate-100">
            <CreditCard className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            <span className={paid ? "text-emerald-800" : "font-semibold text-amber-800"}>{paid ? "Greitt" : "Ógreitt"}</span>
            {code && (
              <span className="text-slate-600">
                · kóði {code.activation_redeemed_at ? "virkjaður" : code.activation_code}
              </span>
            )}
          </button>
          <a href="https://provider.medalia.is" target="_blank" rel="noreferrer" className={`${btnSecondary} ml-auto min-h-8 px-3 text-xs`}>
            <ExternalLink className="h-4 w-4" /> Medalia
          </a>
        </div>
        {call && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm ring-1 ring-emerald-100">
            <Video className="h-4 w-4 text-emerald-700" aria-hidden />
            <span className="text-emerald-900">{call.kind === "followup" ? "Eftirfylgd" : "Viðtal"} í myndsímtali {dayTime(call.at)}</span>
            {call.link
              ? <a href={call.link} target="_blank" rel="noreferrer" className={`${btnPrimary} ml-auto min-h-9 px-3`}><Video className="h-4 w-4" /> Hefja myndsímtal</a>
              : <span className="ml-auto text-xs text-amber-800">Hlekkur ekki kominn. Tengdu Google-dagatal eða límdu hlekk í bókunina.</span>}
          </div>
        )}
        {/* Framvinda moved to Staða, beside the conversation: the two
            answer one question together — how are they doing, and what have
            they said about it. */}
      </section>

      {/* The four places a coach goes. */}
      <div className={hcTabs.bar}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setWsTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={hcTabs.tab(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* The Skilaboð and "Læknir og tilvísanir" buttons are gone — Mads'
          call. They sat loose between the nav and the work, belonging to
          neither.

          Both sheets still exist and still render; what they lost is their
          entry point. Skilaboð was outbound SMS and email, which the
          two-way thread on Staða now largely covers. Referrals had no
          second door, and openReferrals still drives an urgent doctor task
          ("N tilvísanir bíða læknis") — so that task can be seen on Í dag
          and not acted on from here. Flagged rather than quietly left: it
          wants a home on Skýrsla, where the clinical work is. */}

      {/* The report used to be pinned in a 26rem column beside this while
          talking and while building the plan. The container is capped at
          1024px, so that left the work 544px — narrower than a phone in
          landscape — and gave the report 416px to render ten expandable
          sections in. Neither side could do its job.
          What the nurse needs mid-conversation is the handful of values that
          are out of range: that is the strip below. The whole report is one
          button away, in the same drawer the workstation already uses for
          messages and referrals. */}
      {/* One tab's worth of work, with the whole width.
          The step bodies are the same ones buildSteps already made; only
          what is on screen at once has changed. */}
      {(() => {
        const panel = (k: string) => {
          const st = byKey.get(k);
          if (!st) return null;
          return (
            <section key={k} className="rounded-2xl border border-hc-hairline bg-white p-4 shadow-hc-card sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hc-ink text-white">{st.icon}</span>
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-slate-900">{st.title}</h2>
                  <p className="truncate text-xs text-slate-600">{st.status}</p>
                </div>
              </div>
              {st.body}
            </section>
          );
        };

        if (tab === "status") return (
          /*
           * The conversation owns a column; everything else stacks beside it.
           *
           * Framvinda and the thread were a two-column grid, which forced
           * Framvinda to match the chat's height: 464px of card for 105px
           * of content, about 350px of empty amber, and that on the one
           * element the page deliberately makes loudest. A chat is the only
           * thing here with indefinite length, so it gets the column and the
           * status cards size to their own content.
           */
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            <div className="space-y-4">
              {/* Heilsufarsskoðun, compressed when there is nothing to say.
                  Three ticks, all done, all the same date was using 186px to
                  report a settled fact. Done collapses to one line; anything
                  outstanding keeps the list, because then it is a to-do. */}
              {(() => {
                const tests = checkpoints.slice(0, 3);
                const left = tests.filter((c) => c.state !== "done");
                if (left.length === 0) return (
                  <section className="flex items-center gap-2 rounded-2xl border border-hc-hairline bg-white px-4 py-3">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-600 text-white">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-slate-900">Heilsufarsskoðun búin</span>
                    <span className="text-sm text-slate-600">{tests[2]?.detail ?? ""}</span>
                  </section>
                );
                return (
                  <section className="rounded-2xl border border-hc-hairline bg-white p-4">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Heilsufarsskoðun</h2>
                    <ul>
                      {tests.map((c) => {
                        const done = c.state === "done";
                        return (
                          <li key={c.label}>
                            <button type="button" onClick={() => jump(c.key)}
                              className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left transition hover:bg-slate-50">
                              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${
                                done ? "border-transparent bg-emerald-600 text-white" : "border-slate-300 text-transparent"}`}>
                                <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                              </span>
                              <span className={`min-w-0 flex-1 text-sm font-semibold ${done ? "text-slate-600" : "text-slate-900"}`}>{c.label}</span>
                              {c.detail && <span className="shrink-0 text-xs text-slate-600">{c.detail}</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })()}

              {/* Framvinda, with no wrapper of its own.
                  It had my "Framvinda" heading above the card's own
                  "FRAMVINDA" kicker — the same word twice, in a box inside
                  a box. The card already says what it is. */}
              {j.plan_published_at && <Adherence d={d} />}

              {/* Bókanir with no outer panel either: "Bókanir / Myndsamtöl og
                  mælingar" wrapped two sections that name themselves, so it
                  was a third box saying nothing the contents did not. */}
              <CoachBookings api={api} journeyId={j.id} />

              {/* What has moved in the plan since last time.
                  On Staða rather than the plan tab because this is the
                  question before an encounter, not while editing: the plan
                  tab shows what the plan IS, this shows what changed and
                  who changed it. A participant who quietly dropped two
                  actions is the subject of the next conversation, and
                  nothing surfaced that before. */}
              {j.plan_published_at && <PlanChanges api={api} journeyId={j.id} />}
            </div>

            <section className="flex min-h-0 flex-col rounded-2xl border border-hc-hairline bg-white p-4 shadow-hc-card">
              <h2 className="mb-3 font-bold text-slate-900">Samtal við skjólstæðing</h2>
              <ClientThread api={api} journeyId={j.id} />
            </section>
          </div>
        );

        if (tab === "report") return (
          <div className="space-y-4">
            {/* No "Það sem er utan marka" strip — Mads' call. The report
                itself is here in full, and a summary of it directly above
                it was saying the same thing twice. It stays on Aðgerðaáætlun,
                where the report is NOT on screen and the out-of-range values
                are what the plan answers. */}
            {panel("results")}
          </div>
        );

        if (tab === "plan") return (
          <div className="space-y-4">
            {/* The builder, bare and first.
                Its own step bar is the navigation for this tab, so it has to
                be reachable without scrolling — Mads asked for the five
                steps at the top. The panel chrome that used to wrap it said
                "Aðgerðaáætlun", which the tab already says, and pushed the
                steps down by its own header. */}
            {byKey.get("plan")?.body}

            {/* No out-of-range strip here either — Mads removed it from
                Skýrsla and now from here, so ReportSignals is off the
                workspace entirely. The values are still on Skýrsla, in the
                report itself, which is where the whole of them live.

                The interview notes stay: they are what the plan is written
                from, and nothing else on this tab shows them. */}
            <NotesPeek j={j} onBack={() => setWsTab("status")} />
          </div>
        );

        /* Forskoðun keeps "Í dag" and nothing else.
           Æfingar and Næring moved into the builder steps that configure
           them, where seeing the result next to the setting is the point.
           The daily checklist has no builder equivalent — nothing
           configures it — so this is where it belongs. */
        return byKey.get("live")
          ? <CoachAsClient api={api} journeyId={j.id} only="today" />
          : null;
      })()}

      {/* The "Skýrslan" sheet is gone with its only door.
          ReportSignals' "Sjá alla skýrsluna" was the one thing that opened
          it, and the strip is off both tabs now. Nothing is lost: the whole
          report is the Skýrsla tab, which is a better place for it than a
          drawer over the top of something else. */}

      {sheet === "messages" && (
        <Sheet title="Skilaboð til skjólstæðings" onClose={() => setSheet(null)}>
          <Messages d={d} startOpen={compose} reload={load} />
          <div className="mt-3">
            <BookVideo api={api} journey={j} onBooked={(kind, at) =>
              record({ event: kind === "interview" ? "interview_booked" : "followup_booked", at, mode: "video", meeting_url: null })} />
          </div>
        </Sheet>
      )}

      {sheet === "orders" && (
        <Sheet title="Greiðslur og kóðar" onClose={() => setSheet(null)}>
          <Orders d={d} record={record} />
        </Sheet>
      )}

      {sheet === "history" && (
        <Sheet title="Saga" onClose={() => setSheet(null)}>
          <History audit={d.audit} />
        </Sheet>
      )}

      {sheet === "referral" && (
        <Sheet title="Læknir og tilvísanir" onClose={() => setSheet(null)}>
          <div className="space-y-3">
            <Referrals api={api} journeyId={j.id} referrals={d.referrals ?? []}
              suggestions={aiReferrals} isDoctor={isDoctor} onChanged={() => void load()} />
          </div>
        </Sheet>
      )}

      {/* Out of the way, but one click from anywhere. */}
      <div className="flex flex-wrap gap-4 px-1 pt-1 text-xs">
        <button type="button" onClick={() => setSheet("history")} className="font-semibold text-slate-500 hover:text-slate-700 hover:underline">
          Saga ({d.audit.length})
        </button>
      </div>
    </div>
  );
}

/**
 * A panel that opens over the page rather than beside it.
 *
 * Messages and referral both belong to the client you are looking at, but
 * neither is the work — and as a side column they cost the plan builder a
 * third of the screen it needs to drag four pillars around in.
 *
 * Wide and scrollable, because the referral catalogue is long.
 */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onClick={onClose} role="presentation">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <span className="flex-1" />
          <button type="button" onClick={onClose} aria-label="Loka"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A step's status line, cut down to something that fits under a checkpoint.
 *  Drops a trailing clause and rewrites a bare ISO date as a day and month. */
function shortStatus(status: string): string {
  const s = status
    .replace(/(\d{4})-(\d{2})-(\d{2})/g, (_m, _y, mo, d) => `${Number(d)}. ${MONTHS_IS[Number(mo) - 1]}`)
    .split(" — ")[0]
    .split(" · ")[0]
    .trim();
  return s.length > 28 ? `${s.slice(0, 27)}…` : s;
}

/** The journey as the nurse walks it: tests in, report confirmed, interview,
 *  plan, follow-up. Each step knows whether it is waiting on us or on someone
 *  else, so the page can open itself on the one that matters. */
function buildSteps({ d, isDoctor, api, record, reload, onChanged, onJump }: {
  d: Detail; isDoctor: boolean; api: WsApi;
  record: (p: Record<string, unknown>) => Promise<string | null>;
  reload: () => Promise<void>; onChanged: () => void;
  onJump: (k: string) => void;
}): FlowStep[] {
  const j = d.journey;
  const hasResults = (d.results ?? []).length > 0;
  const resultsIn = !!(j.blood_results_at && j.measurements_done_at);

  return [
    {
      key: "results",
      // The report IS the results — they were two steps saying the same thing,
      // one holding the values and one holding the doctor's confirmation.
      title: "Skýrslan",
      icon: <Droplet className="h-4 w-4" />,
      state: j.report_generated_at ? "done" : hasResults || resultsIn ? "current" : "waiting",
      status: j.report_generated_at
        ? `Staðfest ${dayTime(j.report_generated_at)}${j.report_sms_sent_at ? " · deilt með skjólstæðingi" : ""}`
        : d.report
          ? `Heilsufarsskýrsla ${isDate(d.report.report.reportDate)} · ${d.report.report.items.length} niðurstöður · bíður staðfestingar læknis`.trim()
          : hasResults
            ? `${(d.results ?? []).length} gildi skráð${j.blood_results_at ? ` · blóðprufa ${day(j.blood_results_at)}` : ""}`
            : resultsIn ? "Rannsóknir komnar — lestu skýrsluna inn" : "Bíður blóðprufu og mælinga",
      body: <ResultsStep d={d} api={api} isDoctor={isDoctor} record={record} reload={reload} />,
    },
    {
      key: "interview",
      title: "Viðtal",
      icon: <MessageSquare className="h-4 w-4" />,
      state: j.interview_done_at ? "done" : j.interview_booked_for ? "current" : j.report_generated_at || j.report_imported_at ? "current" : "upcoming",
      status: j.interview_done_at
        ? `Lokið ${day(j.interview_done_at)}`
        : j.interview_booked_for
          ? `${dayTime(j.interview_booked_for)}${j.interview_mode === "video" ? " · myndsímtal" : ""}`
          : j.report_generated_at || j.report_imported_at ? "Ekki bókað — hafðu samband og finndu tíma" : "Bókast þegar skýrslan er komin",
      body: <InterviewStep d={d} isDoctor={isDoctor} record={record} onPlan={() => onJump("plan")} onChanged={() => void reload()} />,
    },
    {
      key: "plan",
      title: "Aðgerðaáætlun",
      icon: <ClipboardList className="h-4 w-4" />,
      state: j.plan_published_at ? "done" : j.interview_done_at ? "current" : "upcoming",
      status: j.plan_published_at
        ? `Birt skjólstæðingi ${day(j.plan_published_at)}`
        : d.plan?.status === "draft" ? "Drög til — á eftir að birta" : j.interview_done_at ? "Viðtali lokið — gerðu áætlunina" : "Gerð í eða eftir viðtalið",
      body: <PlanBuilder journeyId={j.id} api={api} readyProposal={d.ai_proposal} onPublished={() => { void reload(); onChanged(); }} seed={seedFromNotes(j.interview_notes)} />,
    },
    {
      /*
       * The plan as the client has it.
       *
       * PlanBuilder is for making the plan; this is for following it once it
       * is published — what they have ticked, what order they keep it in,
       * and what they can actually see of their report. It renders the
       * client's own component, so the coach and the client are looking at
       * one screen rather than two views of it that drift.
       */
      key: "live",
      title: "Áætlunin hjá skjólstæðingi",
      icon: <ClipboardList className="h-4 w-4" />,
      hidden: !j.plan_published_at,
      state: j.plan_published_at ? "current" : "upcoming",
      /* No tick count here. last_tick_on is declared optional on this type
         but the journey detail route does not return it, so reading it would
         have printed "hefur ekki merkt neitt" for everybody, always —
         typecheck-clean and false. The adherence is in the body, where it is
         loaded. */
      status: "Eins og skjólstæðingurinn sér hana",
      body: <CoachAsClient api={api} journeyId={j.id} />,
    },
    {
      /*
       * What they have booked, and booking on their behalf.
       *
       * The diary already blocked this time out, but only as anonymous busy
       * hours — opening a client said nothing about what they had booked,
       * and changing it meant ringing them. Not hidden behind a published
       * plan: a measurement visit is booked long before any plan exists.
       */
      key: "bookings",
      title: "Bókanir",
      icon: <CalendarClock className="h-4 w-4" />,
      state: "current",
      status: "Myndsamtöl og mælingar",
      body: <CoachBookings api={api} journeyId={j.id} />,
    },
    {
      key: "followup",
      title: "Eftirfylgd eftir 3 mánuði",
      icon: <CalendarClock className="h-4 w-4" />,
      hidden: !j.plan_published_at && !j.followup_booked_for,
      state: j.followup_done_at ? "done" : j.followup_booked_for ? "waiting" : daysSince(j.plan_published_at) >= 90 ? "current" : "upcoming",
      status: j.followup_done_at
        ? `Lokið ${day(j.followup_done_at)}`
        : j.followup_booked_for
          ? dayTime(j.followup_booked_for)
          : daysSince(j.plan_published_at) >= 90 ? "Þrír mánuðir liðnir — ekki bókað" : `Bókast um ${day(new Date(new Date(j.plan_published_at ?? Date.now()).getTime() + 90 * 86400_000).toISOString())}`,
      body: <FollowupStep d={d} record={record} isDoctor={isDoctor} onPlan={() => onJump("plan")} onChanged={() => void reload()} />,
    },
  ];
}

// ── Step bodies ────────────────────────────────────────────────────────────

function ResultsStep({ d, api, isDoctor, record, reload }: {
  d: Detail; api: WsApi; isDoctor: boolean;
  record: (p: Record<string, unknown>) => Promise<string | null>;
  reload: () => Promise<void>;
}) {
  const j = d.journey;
  const bloodDone = !!(j.blood_test_done_at || j.blood_results_at);
  return (
    <div className="space-y-4">
      {/* Tests recorded by hand when no partner system does it. */}
      {!d.report && (!bloodDone || !j.measurements_done_at) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">Skrá handvirkt:</span>
          {!bloodDone && <button type="button" onClick={() => void record({ event: "blood_test_done" })} className={`${btnSecondary} min-h-8 px-3 text-xs`}><Droplet className="h-3.5 w-3.5" /> Blóðprufa tekin</button>}
          {!j.measurements_done_at && <button type="button" onClick={() => void record({ event: "measurements_done" })} className={`${btnSecondary} min-h-8 px-3 text-xs`}><Ruler className="h-3.5 w-3.5" /> Mælingar gerðar</button>}
        </div>
      )}
      {d.compare && <BeforeAfter c={d.compare} />}
      {d.report && (
        <>
          <ReportView report={d.report.report} signals={d.report.signals}
            reference={d.report.reference} sex={d.report.sex} />
          <p className="text-xs text-slate-600">
            Umferðarljósin eru viðmið Lifeline — þau sömu og í appinu. Skýrslan frá Medalia notar eigin orðalag og mörk, og þar sem
            þeim ber ekki saman birtist orðalag hennar við gildið.
          </p>
        </>
      )}
      <ResultsCard api={api} journeyId={j.id} sex={sexOf(d.patient.sex)} results={d.results ?? []}
        reportShown={!!d.report} onSaved={() => void reload()} />
      <ReportStep d={d} isDoctor={isDoctor} record={record} />
    </div>
  );
}

function ReportStep({ d, isDoctor, record }: { d: Detail; isDoctor: boolean; record: (p: Record<string, unknown>) => Promise<string | null>; }) {
  const j = d.journey;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Confirmed: the remaining question is whether the client has been told it
  // is there. The report lives on their account, so sharing it is a message
  // pointing at it rather than an attachment.
  if (j.report_generated_at) {
    const shared = j.report_sms_sent_at;
    return (
      <div className="space-y-2 rounded-xl bg-slate-50 p-3">
        <p className="text-sm text-slate-600">
          Skýrslan var staðfest {dayTime(j.report_generated_at)}. Hún er í Medalia og á aðgangi skjólstæðingsins.
        </p>
        {shared ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-800">
            <Check className="h-4 w-4" aria-hidden /> Deilt með skjólstæðingi {dayTime(shared)}.
          </p>
        ) : (
          <p className="text-sm text-slate-600">Skjólstæðingurinn hefur ekki fengið sérstaka ábendingu um að hún sé tilbúin.</p>
        )}
        <button type="button" disabled={busy}
          onClick={async () => {
            setBusy(true);
            const e = await record({ action: "share_report" });
            setBusy(false);
            setMsg(e ?? "Skýrslunni deilt — skjólstæðingurinn fékk skilaboð.");
          }}
          className={shared ? btnSecondary : btnDark}>
          <Send className="h-4 w-4" /> {shared ? "Senda aftur" : "Deila með skjólstæðingi"}
        </button>
        {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
      </div>
    );
  }
  if (!j.blood_results_at && !j.report_imported_at) return <p className="text-sm text-slate-600">Skýrslan er staðfest þegar blóðprufusvörin eru komin.</p>;
  return (
    <div className="space-y-2">
      {isDoctor ? (
        <>
          <p className="text-sm text-slate-600">Farðu yfir gildin að ofan og staðfestu skýrsluna. Skjólstæðingurinn fær tölvupóst um leið.</p>
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); const e = await record({ event: "report_generated" }); setBusy(false); setMsg(e ?? "Skýrsla staðfest."); }}
            className={`${btnDark} w-full sm:w-auto`}><Stethoscope className="h-4 w-4" /> Staðfesta skýrsluna</button>
        </>
      ) : (
        <p className="text-sm text-amber-800">
          {j.report_imported_at
            ? "Skýrslan er komin inn og bíður staðfestingar læknis. Þú getur bókað og undirbúið viðtalið; skjólstæðingurinn sér skýrsluna þegar læknir hefur staðfest hana."
            : `Svörin komu fyrir ${minutesSince(j.blood_results_at)} mínútum. Læknir fær SMS ef skýrslan er ekki staðfest innan fimm mínútna.`}
        </p>
      )}
      {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
    </div>
  );
}

function InterviewStep({ d, isDoctor, record, onPlan, onChanged }: { d: Detail; isDoctor: boolean; record: (p: Record<string, unknown>) => Promise<string | null>; onPlan: () => void; onChanged: () => void }) {
  const j = d.journey;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const run = async (p: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg("");
    const e = await record(p);
    setBusy(false); setMsg(e ?? ok);
  };
  return (
    <div className="space-y-4">
      <Booking label="Viðtal" at={j.interview_booked_for} done={j.interview_done_at} mode={j.interview_mode} meetingUrl={j.meeting_url}
        disabled={!j.report_generated_at && !j.report_imported_at} disabledText="Hægt að bóka þegar skýrslan er komin inn."
        onBook={(at, mode, meeting_url) => run({ event: "interview_booked", at, mode, meeting_url }, "Viðtal bókað og sett í dagatal.")} busy={busy}
        onCancel={(noShow) => run({ event: "interview_cancelled", note: noShow ? "no_show" : null }, noShow ? "Skráð: mætti ekki. Bókaðu nýjan tíma." : "Viðtal afbókað.")} />
      {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
      {(j.interview_booked_for || j.interview_done_at) && <Interview d={d} isDoctor={isDoctor} record={record} onPlan={onPlan} onChanged={onChanged} mode="interview" />}
    </div>
  );
}

function FollowupStep({ d, record, isDoctor, onPlan, onChanged }: { d: Detail; record: (p: Record<string, unknown>) => Promise<string | null>; isDoctor: boolean; onPlan: () => void; onChanged: () => void }) {
  const j = d.journey;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const run = async (p: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg("");
    const e = await record(p);
    setBusy(false); setMsg(e ?? ok);
  };
  return (
    <div className="space-y-3">
      <Booking label="Eftirfylgd" at={j.followup_booked_for} done={j.followup_done_at} mode={j.followup_mode ?? (j.followup_booked_for ? j.interview_mode : "video")} meetingUrl={j.followup_meeting_url ?? null}
        disabled={!j.interview_done_at} disabledText="Hægt að bóka eftir fyrsta viðtal." suggest={90}
        onBook={(at, mode, meeting_url) => run({ event: "followup_booked", at, mode, meeting_url }, "Eftirfylgd bókuð og sett í dagatal.")} busy={busy}
        onCancel={(noShow) => run({ event: "followup_cancelled", note: noShow ? "no_show" : null }, noShow ? "Skráð: mætti ekki. Bókaðu nýjan tíma." : "Eftirfylgd afbókuð.")} />
      {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
      {/* The follow-up conversation, guided like the first one but with its
          own notes and questions about how it went. Marking it done is the
          wizard's last step. */}
      {(j.followup_booked_for || j.followup_done_at) && <Interview d={d} isDoctor={isDoctor} record={record} onPlan={onPlan} onChanged={onChanged} mode="followup" />}
    </div>
  );
}

function Orders({ d, record }: { d: Detail; record: (p: Record<string, unknown>) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5 text-sm">
        {d.orders.length === 0 && <li className="text-slate-600">Engar greiðslur skráðar.</li>}
        {d.orders.map((o) => (
          <li key={o.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span>{o.kind === "health_check" ? "Heilsufarsskoðun" : o.kind === "followup_3m" ? "Eftirfylgd" : o.kind === "reevaluation" ? "Endurmat" : "Aukaviðtal"} · {o.payment_route === "company" ? "fyrirtæki" : o.payment_route === "union" ? "stéttarfélag" : "sjálf(ur)"}</span>
            <span className="font-mono text-xs text-slate-600">{o.activation_code}{o.activation_redeemed_at ? " ✓" : ""}</span>
          </li>
        ))}
      </ul>
      {d.journey.stage === "protocol" && (
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); const e = await record({ action: "remind_client" }); setBusy(false); setMsg(e ?? "Áminning send."); }}
          className={btnSecondary}><Bell className="h-4 w-4" /> Senda áminningu um virkjun</button>
      )}
      {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
    </div>
  );
}

function Adherence({ d }: { d: Detail }) {
  const a = adherence(d.plan?.modules ?? [], d.logs ?? [], d.prefs ?? []);
  const status = nudgeStatus(a, !!d.plan);
  const hidden = (d.prefs ?? []).filter((p) => p.hidden);
  const notes = (d.prefs ?? []).filter((p) => (p.note ?? "").trim());
  const titleOf = (uid: string) => d.plan?.modules?.find((m) => m.uid === uid)?.title ?? "aðgerð";
  const tone = status === "on-track" ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
    : status === "needs-nudge" ? "bg-amber-50 text-amber-900 ring-amber-200"
    : "bg-slate-50 text-slate-700 ring-hc-hairline";
  return (
    <section className={`flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3 ring-1 ${tone}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide opacity-70">Framvinda</p>
        <p className="font-semibold">{NUDGE_IS[status]}</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-bold tabular-nums">{a.percent}%</p>
        <p className="text-[11px] opacity-70">7 dagar</p>
      </div>
      {a.streak > 1 && (
        <div className="text-center">
          <p className="text-xl font-bold tabular-nums">{a.streak}</p>
          <p className="text-[11px] opacity-70">dagar í röð</p>
        </div>
      )}
      <div className="text-center">
        <p className="text-xl font-bold tabular-nums">{a.done}/{a.target}</p>
        <p className="text-[11px] opacity-70">merkingar</p>
      </div>
      <span className="flex-1" />
      <p className="text-sm">
        {a.lastDoneOn ? `Síðast merkt ${day(a.lastDoneOn)}` : "Ekkert merkt enn"}
        {hidden.length ? ` · ${hidden.length} lagt til hliðar` : ""}
      </p>
      {/* What the client WROTE, and only that.
          This also listed every set-aside action, one line each, which made
          it the largest and warmest block on the page — seven repetitions of
          "Lagt til hliðar:" above everything a coach might act on, and the
          count is already in the line above. Measured at 1512px it owned the
          top third of the screen to say what a single number says.
          Which actions were set aside is a plan question, so it belongs in
          the plan step, next to the actions themselves. A note is different:
          it is the client's own words, there are rarely many, and it is the
          follow-up's agenda. */}
      {notes.length > 0 && (
        <ul className="w-full space-y-1 border-t border-current/10 pt-2 text-sm">
          {notes.map((p) => <li key={`n-${p.action_uid}`}><strong>{titleOf(p.action_uid)}:</strong> „{p.note}“</li>)}
        </ul>
      )}
    </section>
  );
}

function seedFromNotes(n: InterviewNotes | null): { summary?: string; goals?: PlanGoal[] } | undefined {
  if (!n) return undefined;
  const pillars: Pillar[] = ["sleep", "exercise", "nutrition", "mental"];
  const lines = pillars.filter((p) => n[p]?.trim()).map((p) => `${PILLAR_META[p].label}: ${n[p]!.trim()}`);
  const summary = [n.goals?.trim() ? `Markmið skjólstæðings: ${n.goals.trim()}` : "", ...lines].filter(Boolean).join("\n");
  return summary ? { summary } : undefined;
}

// ── Yfirlit: bookings and milestones ───────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-hc-hairline bg-white p-5">
      <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900"><span className="text-emerald-600">{icon}</span>{title}</h3>
      {children}
    </section>
  );
}


// ── Skilaboð: SMS + email to the client ────────────────────────────────────

function defaultTemplate(j: Journey): MessageTemplateKey {
  switch (j.stage) {
    case "protocol": return "activate";
    case "tests":
      if (j.blood_test_booked_for && !j.blood_test_done_at && isFutureIso(j.blood_test_booked_for)) return "blood_reminder";
      if (j.measurements_booked_for && !j.measurements_done_at && isFutureIso(j.measurements_booked_for)) return "measure_reminder";
      return "book_tests";
    case "report": return "free";
    case "interview": return j.interview_booked_for ? "interview_reminder" : "book_interview";
    case "action": return j.followup_booked_for && !j.followup_done_at ? "followup_reminder" : "plan_ready";
    default: return "free";
  }
}
const isFutureIso = (iso: string) => new Date(iso).getTime() > Date.now();

function Messages({ d, startOpen, reload }: { d: Detail; startOpen: boolean; reload: () => Promise<void> }) {
  const api = useWsApi();
  const j = d.journey;
  const ref = useRef<HTMLDivElement>(null);
  const code = d.orders.find((o) => o.activation_code && (o.kind === "health_check" || o.kind === "reevaluation"))?.activation_code ?? null;
  const ctx = useMemo(() => ({
    firstName: cleanName(d.patient.full_name).split(" ")[0] || "",
    activationCode: code,
    bloodAt: j.blood_test_booked_for, measurementsAt: j.measurements_booked_for,
    interviewAt: j.interview_booked_for, interviewMode: j.interview_mode, followupAt: j.followup_booked_for, meetingUrl: j.meeting_url, followupMeetingUrl: j.followup_meeting_url ?? null,
    bloodSite: "Heilsugæslunni", measurementSite: d.location?.name ? "Veru" : null, interviewSite: null,
    nurseName: d.actor.name,
  }), [d, j, code]);
  const [open, setOpen] = useState(startOpen);
  const [tpl, setTpl] = useState<MessageTemplateKey>(() => defaultTemplate(j));
  const [text, setText] = useState(() => MESSAGE_TEMPLATES.find((t) => t.key === defaultTemplate(j))!.body(ctx));
  const [subject, setSubject] = useState(() => MESSAGE_TEMPLATES.find((t) => t.key === defaultTemplate(j))!.subject);
  const [sms, setSms] = useState(!!d.patient.phone);
  const [email, setEmail] = useState(!d.patient.phone && !!d.patient.email);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (startOpen) setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [startOpen]);

  const pick = (k: MessageTemplateKey) => {
    const t = MESSAGE_TEMPLATES.find((x) => x.key === k)!;
    setTpl(k); setText(t.body(ctx)); setSubject(t.subject); setMsg(null);
  };
  const size = smsSize(text);
  const send = async () => {
    const channels = [sms && "sms", email && "email"].filter(Boolean);
    if (!confirm(`Senda ${channels.map((c) => (c === "sms" ? "SMS" : "tölvupóst")).join(" og ")} til ${cleanName(d.patient.full_name)}?`)) return;
    setBusy(true); setMsg(null);
    const r = await api(`/api/vinnustod/journeys/${j.id}`, { method: "POST", body: JSON.stringify({ action: "message", channels, template: tpl, subject, body: text }) });
    const res = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok && !res.results) { setMsg({ ok: false, text: res.error || "Sending mistókst." }); return; }
    const parts = (res.results as { channel: string; ok: boolean; status: string; error?: string }[]).map((x) =>
      `${x.channel === "sms" ? "SMS" : "Tölvupóstur"}: ${x.ok ? (x.status === "dry-run" ? "prufukeyrsla (ekki sent, lyklar vantar)" : "sent") : x.error || "mistókst"}`);
    setMsg({ ok: !!res.ok, text: parts.join(" · ") });
    await reload();
  };

  return (
    <div ref={ref} className="scroll-mt-24 lg:col-span-2">
      <Card title="Skilaboð til skjólstæðings" icon={<MessageSquare className="h-5 w-5" />}>
        {!open ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-slate-600">
              Sendu áminningu með SMS{d.patient.phone ? ` (${d.patient.phone})` : ""} eða tölvupósti{d.patient.email ? ` (${d.patient.email})` : ""}.
            </p>
            <button type="button" onClick={() => setOpen(true)} className={btnPrimary}><Bell className="h-4 w-4" /> Skrifa skilaboð</button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Sniðmát</p>
                <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sniðmát">
                  {MESSAGE_TEMPLATES.map((t) => (
                    <button key={t.key} type="button" role="radio" aria-checked={tpl === t.key} onClick={() => pick(t.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tpl === t.key ? "bg-hc-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Rás">
                <button type="button" aria-pressed={sms} disabled={!d.patient.phone} onClick={() => setSms((v) => !v)}
                  className={`${btn} min-h-9 ${sms ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-hc-hairline"}`}>
                  <Phone className="h-4 w-4" /> SMS {sms && "✓"}
                </button>
                <button type="button" aria-pressed={email} disabled={!d.patient.email} onClick={() => setEmail((v) => !v)}
                  className={`${btn} min-h-9 ${email ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-hc-hairline"}`}>
                  <Mail className="h-4 w-4" /> Tölvupóstur {email && "✓"}
                </button>
              </div>
              {email && (
                <label className="block text-sm"><span className="font-medium text-slate-700">Efni tölvupósts</span>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              )}
              <label className="block text-sm"><span className="font-medium text-slate-700">Texti</span>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              {sms && (
                <p className={`text-xs ${size.segments > 3 ? "text-amber-700" : "text-slate-600"}`}>
                  SMS: {size.chars} stafir · {size.segments} {size.segments === 1 ? "hluti" : "hlutar"}{size.encoding === "UCS-2" ? " (íslenskir stafir: 70 í hluta)" : ""}. Vefslóðir geta verið síaðar hjá símafyrirtækjum.
                </p>
              )}
              {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || (!sms && !email) || text.trim().length < 5} onClick={send} className={btnPrimary}>
                  {busy ? "Sendir…" : `Senda${sms && email ? " SMS og tölvupóst" : sms ? " SMS" : email ? " tölvupóst" : ""}`}
                </button>
                <button type="button" onClick={() => { setOpen(false); setMsg(null); }} className={btnGhost}>Loka</button>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Send skilaboð</p>
              <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                {d.messages.length === 0 && <li className="text-sm text-slate-500">Engin skilaboð enn.</li>}
                {d.messages.map((m) => (
                  <li key={m.id} className="rounded-xl bg-slate-50 p-2.5 text-xs">
                    <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                      {m.channel === "sms" ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                      {dayTime(m.sent_at)}
                      <span className={`ml-auto rounded px-1.5 py-0.5 ${m.status === "sent" ? "bg-emerald-100 text-emerald-800" : m.status === "dry-run" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>
                        {m.status === "sent" ? "Sent" : m.status === "dry-run" ? "Prufa" : "Mistókst"}
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-slate-600">{m.body}</p>
                    <p className="mt-1 text-slate-500">{m.sent_by}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Booking({ label, at, done, mode, meetingUrl, disabled, disabledText, onBook, busy, suggest, onCancel }: {
  label: string; at: string | null; done: string | null; mode?: string | null; meetingUrl?: string | null;
  disabled: boolean; disabledText: string;
  onBook: (at: string, mode: "in_person" | "video", meetingUrl: string | null) => void; busy: boolean; suggest?: number;
  /** Cancel the slot; noShow when the time has passed and nobody came. */
  onCancel?: (noShow: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const [when, setWhen] = useState(() => {
    if (at) return toLocalInput(new Date(at));
    const d = new Date(Date.now() + (suggest ?? 1) * 86400_000);
    d.setMinutes(0, 0, 0);
    return toLocalInput(d);
  });
  const [m, setM] = useState<"in_person" | "video">(mode === "video" ? "video" : "in_person");
  const [link, setLink] = useState(meetingUrl ?? "");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold text-slate-800">{label}</span><br />
          <span className="text-slate-600">{done ? `Lokið ${dayTime(done)}` : at ? `${dayTime(at)}${mode === "video" ? " · myndsímtal" : ""}` : disabled ? disabledText : "Ekki bókað"}</span>
          {!done && at && mode === "video" && (
            <>
              <br />
              {meetingUrl ? (
                <a href={meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
                  <Video className="h-3.5 w-3.5" /> Opna fjarfund
                </a>
              ) : (
                <span className="text-amber-800">Myndsímtal án hlekks — hann kemur sjálfkrafa þegar tíminn fer í Google-dagatalið, eða settu hann inn sjálf.</span>
              )}
            </>
          )}
        </p>
        {!done && !disabled && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={`${at ? btnSecondary : btnPrimary} min-h-9`}>{at ? "Breyta tíma" : "Bóka"}</button>
        )}
        {!done && at && !editing && onCancel && (
          new Date(at).getTime() < openedAt
            ? <button type="button" disabled={busy} onClick={() => onCancel(true)} className={`${btnGhost} min-h-9`}>Mætti ekki</button>
            : <button type="button" disabled={busy} onClick={() => { if (confirm(`Afbóka ${label.toLowerCase()}? Skjólstæðingurinn fær tölvupóst.`)) onCancel(false); }} className={`${btnGhost} min-h-9`}>Afbóka</button>
        )}
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
          <label className="text-xs font-semibold text-slate-600">Dagur og tími
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
          {mode !== undefined && (
            <div className="flex gap-1" role="radiogroup" aria-label="Form">
              {([["in_person", "Á staðnum"], ["video", "Myndsímtal"]] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={m === k} onClick={() => setM(k)}
                  className={`${btn} min-h-9 ${m === k ? "bg-hc-ink text-white" : "bg-white text-slate-600 ring-1 ring-hc-hairline"}`}>{l}</button>
              ))}
            </div>
          )}
          {m === "video" && (
            <div className="w-full">
              <label className="text-xs font-semibold text-slate-600">Hlekkur á fjarfund (Meet, Teams eða Zoom)
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label>
              {/* Left empty, a Meet link is made for you: the booking syncs to
                  the interviewer's Google calendar and the conference is
                  created there, then written back here and on to the client.
                  That needs Google connected, so the manual route stays for
                  when it is not — or when the meeting is on Teams or Zoom. */}
              <p className="mt-1.5 text-[11px] leading-snug text-slate-600">
                Skildu þetta eftir tómt og Google Meet-hlekkur verður búinn til sjálfkrafa þegar tíminn fer í dagatalið.
                Límdu hér að ofan ef þú vilt nota Teams, Zoom eða tiltekinn fund.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <a href="https://meet.google.com/new" target="_blank" rel="noreferrer"
                  className={`${btnSecondary} min-h-8 px-2.5 text-xs`}>
                  <Video className="h-3.5 w-3.5" /> Búa til Meet sjálf
                </a>
              </div>
            </div>
          )}
          <button type="button" disabled={busy || !when} onClick={() => { onBook(new Date(when).toISOString(), m, m === "video" ? (link.trim() || null) : null); setEditing(false); }} className={`${btnPrimary} min-h-9`}>Vista tíma</button>
          <button type="button" onClick={() => setEditing(false)} className={`${btnGhost} min-h-9`}>Hætta við</button>
        </div>
      )}
    </div>
  );
}

/** While building the plan: what was said in the conversation, per topic. */
function NotesPeek({ j, onBack }: { j: Journey; onBack: () => void }) {
  const notes = (j.followup_booked_for && j.interview_done_at ? j.followup_notes : j.interview_notes) ?? {};
  const rows = TOPICS.filter((t) => (notes[t.key] ?? "").trim());
  return (
    <section className="mb-3 rounded-xl bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Úr viðtalinu</p>
        <button type="button" onClick={onBack} className="text-xs font-semibold text-emerald-700 hover:underline">← Aftur í viðtalið</button>
      </div>
      {rows.length ? (
        <dl className="mt-2 space-y-2">
          {rows.map((t) => (
            <div key={t.key}>
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.title}</dt>
              <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{notes[t.key]}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="mt-1 text-sm text-slate-600">Engir minnispunktar enn.</p>}
    </section>
  );
}

// ── Viðtal: guided, step by step ───────────────────────────────────────────

const PREP: string[] = [
  "Lestu skýrsluna (hér til hliðar á breiðum skjá, annars undir „Skýrslan“) og samantekt læknis.",
  "Skoðaðu blóðprufur: blóðsykur (HbA1c), blóðfitur og annað sem er rautt eða gult.",
  "Skoðaðu mælingar: blóðþrýsting og líkamssamsetningu.",
  "Lestu svör við spurningalista um svefn, hreyfingu, næringu og andlega líðan.",
  "Merktu við 1–2 atriði sem standa upp úr til að ræða.",
];

const FOLLOWUP_PREP: string[] = [
  "Skoðaðu fylgnina efst: hvað hefur gengið og hvað ekki síðustu vikur.",
  "Lestu hvað skjólstæðingurinn lagði til hliðar og athugasemdir hans.",
  "Rifjaðu upp markmiðin og minnispunkta úr fyrsta viðtali.",
  "Veldu 1–2 atriði til að breyta eða bæta við í áætluninni.",
];

/** Follow-up prompts per topic: how it went, not how things are. */
const FOLLOWUP_PROMPTS: Partial<Record<keyof InterviewNotes, string[]>> = {
  goals: ["Hvernig hefur gengið að ná markmiðunum?", "Hvað hefur breyst síðan síðast?"],
  sleep: ["Hvað hefur breyst í svefninum?", "Hvað hefur verið erfitt?"],
  exercise: ["Hvernig hefur æfingaáætlunin gengið?", "Þarf að auka eða minnka álagið?"],
  nutrition: ["Hvaða breytingar hafa haldist?", "Hvað hefur ekki gengið?"],
  mental: ["Hvernig er álagið núna miðað við síðast?", "Hvað hjálpaði?"],
  measurements: ["Hvað hefur breyst í mælingum, ef mælt var aftur?"],
};

const TOPICS: { key: keyof InterviewNotes; title: string; color: string; prompts: string[] }[] = [
  { key: "goals", title: "Hvað vill skjólstæðingurinn?", color: "#10B981", prompts: ["Hvað viltu fá út úr þessu?", "Hvað myndi breyta mestu fyrir þig næstu þrjá mánuði?"] },
  { key: "sleep", title: PILLAR_META.sleep.label, color: PILLAR_META.sleep.color, prompts: ["Hvenær ferðu að sofa og á fætur?", "Vaknarðu úthvíld(ur)?", "Skjánotkun, koffín, áfengi á kvöldin?"] },
  { key: "exercise", title: PILLAR_META.exercise.label, color: PILLAR_META.exercise.color, prompts: ["Hvernig hreyfingu stundar þú í dag?", "Hvað finnst þér skemmtilegt?", "Verkir eða takmarkanir?"] },
  { key: "nutrition", title: PILLAR_META.nutrition.label, color: PILLAR_META.nutrition.color, prompts: ["Hvernig lítur venjulegur dagur út?", "Reglulegar máltíðir? Sykraðir drykkir?", "Hver sér um innkaup og eldamennsku?"] },
  { key: "mental", title: PILLAR_META.mental.label, color: PILLAR_META.mental.color, prompts: ["Hvernig er álagið núna?", "Hvað gefur þér orku?", "Stuðningur, tengsl, hvíld?"] },
  { key: "measurements", title: "Mælingar og blóðprufur", color: "#475569", prompts: ["Hvað sýna niðurstöðurnar á mannamáli?", "Hvað kom skjólstæðingnum á óvart?"] },
];

const STEPS = ["Undirbúningur", "Samtal", "Mat", "Áætlun", "Ljúka"] as const;

function Interview({ d, isDoctor, record, onPlan, onChanged, mode = "interview" }: { d: Detail; isDoctor: boolean; record: (p: Record<string, unknown>) => Promise<string | null>; onPlan?: () => void; onChanged?: () => void; mode?: "interview" | "followup" }) {
  const api = useWsApi();
  const j = d.journey;
  const isFollowup = mode === "followup";
  const prep = isFollowup ? FOLLOWUP_PREP : PREP;
  // The wizard remembers where it was: switching panels unmounts it.
  const memo = `ws-iv:${j.id}:${mode}`;
  const [step, setStepState] = useState(() => {
    try { return Math.min(STEPS.length - 1, Number(sessionStorage.getItem(`${memo}:step`)) || 0); } catch { return 0; }
  });
  const setStep = (n: number) => { setStepState(n); try { sessionStorage.setItem(`${memo}:step`, String(n)); } catch { /* private mode */ } };
  const [checked, setCheckedState] = useState<boolean[]>(() => {
    try { const v = JSON.parse(sessionStorage.getItem(`${memo}:prep`) || "null"); if (Array.isArray(v) && v.length === prep.length) return v; } catch { /* none */ }
    return prep.map(() => false);
  });
  const setChecked = (v: boolean[]) => { setCheckedState(v); try { sessionStorage.setItem(`${memo}:prep`, JSON.stringify(v)); } catch { /* private mode */ } };
  const [notes, setNotes] = useState<InterviewNotes>((isFollowup ? j.followup_notes : j.interview_notes) ?? {});
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave notes a second after typing stops.
  const setNote_ = (k: keyof InterviewNotes, v: string) => {
    const next = { ...notes, [k]: v };
    setNotes(next);
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await api(`/api/vinnustod/journeys/${j.id}`, { method: "PATCH", body: JSON.stringify(isFollowup ? { followup_notes: next } : { interview_notes: next }) });
      setSaved(r.ok ? "saved" : "error");
    }, 900);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = async (p: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg("");
    const e = await record(p);
    setBusy(false); setMsg(e ?? ok);
    return !e;
  };

  if (!j.report_generated_at && !j.report_imported_at) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">Viðtalið opnast þegar skýrslan er komin inn.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Stepper */}
      <nav aria-label="Skref viðtals" className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">{isFollowup ? "Eftirfylgdarviðtal" : "Viðtal"}</p>
        <ol className="flex gap-2 overflow-x-auto lg:flex-col">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
                className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${step === i ? "bg-hc-ink text-white" : "bg-white text-slate-600 ring-1 ring-hc-hairline hover:bg-slate-50"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === i ? "bg-white text-slate-900" : i < step ? "bg-emerald-500 text-white" : "bg-slate-100"}`}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {s}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="min-w-0 space-y-4">
        {step === 0 && (
          <section className="rounded-2xl border border-hc-hairline bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Undirbúningur</h3>
            <p className="mb-4 text-sm text-slate-600">Um 10 mínútur fyrir viðtalið.</p>
            <ul className="space-y-2">
              {prep.map((p, i) => (
                <li key={i}>
                  <button type="button" role="checkbox" aria-checked={checked[i]} onClick={() => setChecked(checked.map((c, k) => (k === i ? !c : c)))}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${checked[i] ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-hc-hairline hover:bg-slate-50"}`}>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked[i] ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>{checked[i] && <Check className="h-3.5 w-3.5" />}</span>
                    {p}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="https://provider.medalia.is" target="_blank" rel="noreferrer" className={btnSecondary}><ExternalLink className="h-4 w-4" /> Opna skýrslu í Medalia</a>
              <span className="flex-1" />
              <button type="button" onClick={() => setStep(1)} className={btnPrimary}>Hefja samtal <ChevronRight className="h-4 w-4" /></button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="rounded-2xl border border-hc-hairline bg-white p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Samtal</h3>
                <p className="text-sm text-slate-600">Byrjaðu á því sem skjólstæðingurinn vill breyta. Punktarnir vistast sjálfkrafa og fylgja í áætlunina.</p>
              </div>
              <span className={`text-xs font-semibold ${saved === "error" ? "text-red-600" : "text-slate-500"}`} role="status">
                {saved === "saving" ? "Vistar…" : saved === "saved" ? "✓ Vistað" : saved === "error" ? "Vistun mistókst" : ""}
              </span>
            </div>
            <div className="space-y-4">
              {TOPICS.map((t) => (
                <div key={t.key} className="rounded-xl border border-hc-hairline p-3" style={{ borderLeftWidth: 4, borderLeftColor: t.color }}>
                  <label htmlFor={`note-${t.key}`} className="font-semibold text-slate-900">{t.title}</label>
                  <p className="mt-0.5 text-xs text-slate-600">{((isFollowup ? FOLLOWUP_PROMPTS[t.key] : null) ?? t.prompts).join(" · ")}</p>
                  <textarea id={`note-${t.key}`} value={notes[t.key] ?? ""} onChange={(e) => setNote_(t.key, e.target.value)} rows={3}
                    className="mt-2 w-full rounded-lg border border-hc-control px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <button type="button" onClick={() => setStep(0)} className={btnGhost}><ArrowLeft className="h-4 w-4" /> Undirbúningur</button>
              <button type="button" onClick={() => setStep(2)} className={btnPrimary}>Áfram í mat <ChevronRight className="h-4 w-4" /></button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="rounded-2xl border border-hc-hairline bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Mat</h3>
            <p className="mb-4 text-sm text-slate-600">Er eitthvað í niðurstöðum eða samtalinu sem gæti kallað á læknismeðferð?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-900">Nei, lífsstílsáætlun nægir</p>
                <p className="mt-1 text-sm text-emerald-800">Haltu áfram í áætlunargerð.</p>
                <button type="button" onClick={() => setStep(3)} className={`${btnPrimary} mt-3`}>Áfram í áætlun <ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-900">{isDoctor ? "Já, skrá tilvísun" : "Já eða óviss: læknir metur eða vísað áfram"}</p>
                <p className="mt-1 text-sm text-amber-800">Veldu „Læknir Lifeline“ ef læknir á að líta á eitthvað, eða hvert á að vísa. Læknir fær skeyti.</p>
              </div>
            </div>
            <div className="mt-3">
              <Referrals api={api} journeyId={j.id} referrals={d.referrals ?? []} suggestions={d.ai_referrals ?? []}
                isDoctor={isDoctor} onChanged={() => onChanged?.()} />
            </div>
            <p className="mt-3 text-xs text-slate-600">Lífsstílsáætlunin heldur áfram þótt vísað sé á Heilsugæsluna.</p>
          </section>
        )}

        {step === 3 && (
          <section className="rounded-2xl border border-hc-hairline bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Aðgerðaáætlun</h3>
            <p className="mt-1 text-sm text-slate-600">Veldu sniðmát sem passar, dragðu inn 2–4 aðgerðir á stoð í mesta lagi og skrifaðu persónulegar athugasemdir. Punktar úr samtalinu fylgja sem samantekt.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.plan && <span className={`rounded-full px-3 py-1 text-xs font-bold ${d.plan.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{d.plan.status === "published" ? `Birt ${day(d.plan.published_at)}` : "Drög til"}</span>}
            </div>
            <div className="mt-4 flex justify-between">
              <button type="button" onClick={() => setStep(2)} className={btnGhost}><ArrowLeft className="h-4 w-4" /> Mat</button>
              <div className="flex gap-2">
                {onPlan && <button type="button" onClick={onPlan} className={btnPrimary}>{d.plan ? "Opna áætlun" : "Búa til áætlun"} <ChevronRight className="h-4 w-4" /></button>}
                <button type="button" onClick={() => setStep(4)} className={btnSecondary}>Ljúka viðtali</button>
              </div>
            </div>
          </section>
        )}

        {step === 4 && (
          <FinishStep j={j} planPublished={d.plan?.status === "published"} busy={busy} run={run} isFollowup={isFollowup} />
        )}

        {msg && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{msg}</p>}
      </div>
    </div>
  );
}

function FinishStep({ j, planPublished, busy, run, isFollowup }: {
  j: Journey; planPublished: boolean; busy: boolean; isFollowup: boolean;
  run: (p: Record<string, unknown>, ok: string) => Promise<boolean>;
}) {
  const suggested = toLocalInput(new Date(new Date().setHours(10, 0, 0, 0) + 91 * 86400_000));
  const [when, setWhen] = useState(j.followup_booked_for ? toLocalInput(new Date(j.followup_booked_for)) : suggested);
  const interviewDone = !!j.interview_done_at;
  return (
    <section className="rounded-2xl border border-hc-hairline bg-white p-5">
      <h3 className="text-lg font-bold text-slate-900">Ljúka</h3>
      <ol className="mt-4 space-y-3">
        <li className="flex flex-wrap items-center gap-3 rounded-xl border border-hc-hairline p-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${(isFollowup ? j.followup_done_at : interviewDone) ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
            {(isFollowup ? j.followup_done_at : interviewDone) ? <Check className="h-4 w-4" /> : 1}
          </span>
          <span className="flex-1 text-sm font-semibold text-slate-800">{isFollowup ? "Merkja eftirfylgd lokið" : "Merkja viðtali lokið"}</span>
          {!(isFollowup ? j.followup_done_at : interviewDone) && (
            <button type="button" disabled={busy} onClick={() => run({ event: isFollowup ? "followup_done" : "interview_done" }, "Skráð.")} className={btnPrimary}>Merkja lokið</button>
          )}
        </li>
        <li className="flex flex-wrap items-center gap-3 rounded-xl border border-hc-hairline p-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${planPublished ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>{planPublished ? <Check className="h-4 w-4" /> : 2}</span>
          <span className="flex-1 text-sm font-semibold text-slate-800">Aðgerðaáætlun birt skjólstæðingi</span>
          {!planPublished && <span className="text-xs text-amber-700">Ekki birt enn</span>}
        </li>
        {!isFollowup && (
          <li className="flex flex-wrap items-end gap-3 rounded-xl border border-hc-hairline p-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full ${j.followup_booked_for ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>{j.followup_booked_for ? <Check className="h-4 w-4" /> : 3}</span>
            <label className="flex-1 text-sm font-semibold text-slate-800">Bóka eftirfylgd eftir 3 mánuði <span className="font-normal text-slate-600">(ráðlögð, valfrjáls)</span>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <button type="button" disabled={busy || !when || !interviewDone} onClick={() => run({ event: "followup_booked", at: new Date(when).toISOString() }, "Eftirfylgd bókuð og sett í dagatal.")} className={btnSecondary}>
              {j.followup_booked_for ? "Breyta tíma" : "Bóka"}
            </button>
          </li>
        )}
      </ol>
      {!interviewDone && !isFollowup && <p className="mt-2 text-xs text-slate-600">Eftirfylgd er hægt að bóka þegar viðtali er merkt lokið.</p>}
      <p className="mt-3 text-xs text-slate-600">Skjólstæðingurinn fær tölvupóst þegar áætlunin er birt. Eftirfylgd er greidd sérstaklega á aðgangi hans.</p>
    </section>
  );
}

// ── Saga ────────────────────────────────────────────────────────────────────

const ACTION_TEXT: Record<string, string> = {
  paid: "Greitt", paid_followup: "Eftirfylgd greidd", profile_complete: "Upplýsingar skráðar", welcome_seen: "Kynning skoðuð",
  plan_published: "Áætlun birt", plan_republished: "Áætlun uppfærð", plan_created: "Drög að áætlun", report_sms_escalation: "SMS til læknis",
  union_claim_sent: "Umsókn send stéttarfélagi", reminder_sent: "Áminning send", message_sent: "Skilaboð send", doctor_review_requested: "Beðið um mat læknis",
  doctor_reviewed: "Læknir mat", protocol_confirmed_by_client: "Skjólstæðingur staðfesti virkjun", test_patient_seeded: "Prufuskjólstæðingur búinn til", set_booking: "Tími skráður af skjólstæðingi",
};
function actionText(a: string) {
  if (a.startsWith("event:")) return EVENT_LABELS[a.slice(6) as JourneyEvent] ?? a;
  return ACTION_TEXT[a] ?? a;
}

function History({ audit }: { audit: Detail["audit"] }) {
  return (
    <section className="rounded-2xl border border-hc-hairline bg-white p-5">
      <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
        {audit.map((a, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            <p className="text-sm font-semibold text-slate-800">{actionText(a.action)}</p>
            <p className="text-xs text-slate-600">{dayTime(a.at)} · {a.actor}{a.note ? ` · ${a.note}` : ""}</p>
          </li>
        ))}
        {audit.length === 0 && <li className="text-sm text-slate-600">Engin saga enn.</li>}
      </ol>
    </section>
  );
}

// ── Login ──────────────────────────────────────────────────────────────────

function Login({ onDone }: { onDone: () => void }) {
  const [trusted, setTrusted] = useState<{ name: string } | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trust, setTrust] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ws("/api/vinnustod/auth/pin").then((r) => r.json()).then((j) => j.trusted && setTrusted({ name: j.name })).catch(() => {});
  }, []);

  const loginPin = async (v: string) => {
    setBusy(true); setError("");
    const r = await ws("/api/vinnustod/auth/pin", { method: "POST", body: JSON.stringify({ pin: v }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setPin(""); setError(j.error || "Tókst ekki."); if (j.locked) setTrusted(null); return; }
    onDone();
  };
  const loginPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await ws("/api/vinnustod/auth/login", { method: "POST", body: JSON.stringify({ email, password, trust_device: trust }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error || "Tókst ekki."); return; }
    onDone();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm">
        <LifelineLogo size="lg" />
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Vinnustöð</p>
        {trusted && !usePassword ? (
          <div className="mt-6">
            <p className="text-center text-sm text-slate-600">Hæ {trusted.name.split(" ")[0]}, sláðu inn PIN</p>
            <div className="mt-5"><PinPad value={pin} onChange={setPin} onComplete={loginPin} disabled={busy} error={!!error} /></div>
            {error && <p role="alert" className="mt-4 text-center text-sm text-red-600">{error}</p>}
            <button onClick={() => setUsePassword(true)} className="mt-5 block w-full text-center text-sm text-slate-600">Nota lykilorð</button>
          </div>
        ) : (
          <form onSubmit={loginPw} className="mt-6 space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Netfang" autoComplete="username" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Lykilorð" autoComplete="current-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} /> Treysta þessu tæki (PIN næst)</label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-hc-brand py-2.5 font-semibold text-white disabled:opacity-50">{busy ? "Augnablik…" : "Skrá inn"}</button>
          </form>
        )}
      </div>
    </div>
  );
}


function PinModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const save = async (v: string) => {
    const r = await ws("/api/vinnustod/auth/pin", { method: "PUT", body: JSON.stringify({ pin: v }) });
    if (!r.ok) { setPin(""); setErr((await r.json().catch(() => ({}))).error || "Tókst ekki."); return; }
    onDone();
  };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="PIN">
        <p className="mb-4 text-center font-semibold">Veldu 4 stafa PIN</p>
        <PinPad value={pin} onChange={setPin} onComplete={save} error={!!err} />
        {err && <p className="mt-3 text-center text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}

