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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bell, CalendarClock, Check, ChevronRight, ClipboardList, CreditCard, Droplet, ExternalLink, Video,
  FileCheck2, Mail, MessageSquare, Phone, Ruler, Search, Send, Stethoscope, Users,
} from "lucide-react";
import LifelineLogo from "@/app/components/LifelineLogo";
import PinPad from "@/app/components/hc/PinPad";
import PlanBuilder from "@/app/components/hc/PlanBuilder";
import CalendarConnect, { type CalendarApi } from "@/app/components/hc/CalendarConnect";
import WeekCalendar from "@/app/components/hc/WeekCalendar";
import ClientsView from "@/app/components/hc/ClientsView";
import KnowledgeSearch, { useKnowledgeHotkey } from "@/app/components/hc/KnowledgeSearch";
import { cookieApi, useWsApi, type WsApi } from "@/app/components/hc/ws-api";
import WsHeader, { type WsMenuItem } from "@/app/components/hc/WsHeader";
import { type FlowStep } from "@/app/components/hc/Flow";
import StatusStrip, { type Checkpoint } from "@/app/components/hc/StatusStrip";
import ResultsCard, { sexOf, type HcResult } from "@/app/components/hc/ResultsCard";
import ReportIntake from "@/app/components/hc/ReportIntake";
import ReportView from "@/app/components/hc/ReportView";
import type { Grunnheilsa, Signal as ReportSignal } from "@/lib/hc/grunnheilsa";
import type { ReportReference } from "@/lib/hc/knowledge";
import Referrals, { type ReferralSuggestion } from "@/app/components/hc/Referrals";
import BookVideo from "@/app/components/hc/BookVideo";
import type { Referral } from "@/lib/hc/referrals";
import { adherence, NUDGE_IS, nudgeStatus, type ActionLog, type ActionPref } from "@/lib/hc/adherence";
import { EVENT_LABELS, type JourneyEvent } from "@/lib/hc/events-labels";
import { PILLAR_META, type InterviewNotes, type PlanGoal, type Pillar, type PlanItem } from "@/lib/hc/types";
import { MESSAGE_TEMPLATES, smsSize, type MessageTemplateKey } from "@/lib/hc/message-templates";

// ── Types ───────────────────────────────────────────────────────────────────

interface Me { id: string; name: string; email: string; organization: string; role: "nurse" | "doctor" | "admin"; has_pin: boolean }
interface Row {
  id: string; client_name: string; client_phone: string | null; client_dob: string | null; stage: string; entry: string;
  paid_at: string | null; protocol_activated_at: string | null;
  blood_test_booked_for: string | null; blood_test_done_at: string | null; blood_results_at: string | null;
  measurements_booked_for: string | null; measurements_done_at: string | null;
  report_generated_at: string | null; report_sms_sent_at: string | null;
  interview_booked_for: string | null; interview_mode: string | null; interviewer_id: string | null; interview_done_at: string | null;
  meeting_url: string | null;
  plan_published_at: string | null; followup_booked_for: string | null; followup_done_at: string | null;
  referral_to_heilsugaesla: boolean; doctor_review_requested_at: string | null; doctor_reviewed_at: string | null;
  plan_status: string | null; updated_at: string;
}
interface Journey extends Omit<Row, "client_name" | "client_phone" | "client_dob" | "plan_status"> {
  referral_note: string | null; referred_at: string | null; doctor_review_note: string | null;
  interview_notes: InterviewNotes | null; location_id: string | null;
}
interface Detail {
  journey: Journey;
  patient: { full_name: string | null; kennitala: string | null; email: string | null; phone: string | null; address: string | null; date_of_birth: string | null; sex: string | null };
  results: HcResult[];
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
type HomeTab = "today" | "calendar" | "clients";
type View = { home: HomeTab } | { patient: string; compose?: boolean };

// ── Helpers ─────────────────────────────────────────────────────────────────

// The login and PIN screens only exist in the standalone workstation, so they
// always talk over the nurse's own cookie session.
const ws = cookieApi;

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

const btn = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary = `${btn} bg-[#10B981] text-white hover:bg-[#047857]`;
const btnDark = `${btn} bg-slate-900 text-white hover:bg-slate-700`;
const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const btnGhost = `${btn} text-slate-600 hover:bg-slate-100`;

/** What the next action for a client is — the heart of the to-do list. */
type Task = { key: string; label: string; cta: string; tone: "urgent" | "normal" | "waiting"; doctorOnly?: boolean };
function nextTask(r: Row | Journey, isDoctor: boolean): Task {
  if (isDoctor && r.doctor_review_requested_at && !r.doctor_reviewed_at)
    return { key: "review", label: "Beiðni um mat læknis", cta: "Meta", tone: "urgent", doctorOnly: true };
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

  if (me === undefined) return <div className="p-10 text-center text-slate-500">Hleð…</div>;
  if (me === null) {
    return mode === "worker" ? <Login onDone={load} /> : (
      <div className="p-10 text-center text-slate-500">
        Vinnustöðin er opin starfsfólki Lifeline með tveggja þátta staðfestingu.
      </div>
    );
  }
  return <Workstation me={me} mode={mode} onLogout={() => setMe(null)} onPinSet={load} />;
}

// ── Shell ───────────────────────────────────────────────────────────────────

const HOME_TABS: HomeTab[] = ["today", "calendar", "clients"];
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
  const open = (id: string, compose = false) => setView({ patient: id, compose });

  const menu: WsMenuItem[] = [
    { label: "Fletta upp", icon: "book", hint: "⌘K", onClick: () => setShowBook(true) },
    ...(mode === "worker" ? [
      { label: "Tengja dagatal", icon: "calendar" as const, onClick: () => setShowCal(true) },
      { label: me.has_pin ? "Breyta PIN" : "Setja PIN", icon: "key" as const, onClick: () => setShowPin(true) },
      { label: "Útskrá", icon: "logout" as const, onClick: () => void logout() },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-[#f7f9f8]">
      <WsHeader name={me.name} role={me.role === "doctor" ? "læknir" : me.role === "admin" ? "stjórnandi" : "hjúkrunarfræðingur"} items={menu} />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {rows === null ? <p className="py-10 text-center text-slate-500">Hleð…</p>
          : "patient" in view
            ? <PatientView key={view.patient} id={view.patient} compose={!!view.compose} me={me}
                onBack={() => (window.history.length > 1 ? window.history.back() : setView({ home: "today" }))} onChanged={load} />
            : (
              <div className="space-y-4">
                <nav className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200" aria-label="Vinnustöðin">
                  {([["today", "Í dag"], ["calendar", "Dagatal"], ["clients", "Skjólstæðingar"]] as const).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setView({ home: k })}
                      aria-current={view.home === k ? "page" : undefined}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        view.home === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                      {label}
                    </button>
                  ))}
                </nav>
                {view.home === "today" && <Home rows={rows} me={me} isDoctor={isDoctor} onOpen={open} onChanged={load} />}
                {view.home === "calendar" && (
                  <WeekCalendar api={api} onOpenClient={(id) => open(id)} onConnect={() => setShowCal(true)} />
                )}
                {view.home === "clients" && <ClientsView api={api} onOpenClient={(id) => open(id)} />}
              </div>
            )}
      </main>

      <KnowledgeSearch api={api} open={showBook} onClose={() => setShowBook(false)} />
      {showPin && <PinModal onClose={() => setShowPin(false)} onDone={() => { setShowPin(false); onPinSet(); }} />}
      <CalendarConnect api={WORKER_CALENDAR} open={showCal && mode === "worker"} onClose={() => setShowCal(false)}
        intro="Viðtöl og eftirfylgd sem þér eru úthlutuð birtast í dagatalinu þínu um leið og þau eru bókuð. Aðeins upphafsstafir skjólstæðings koma fram." />
    </div>
  );
}

// ── Heim: skýrsla inn, leit, dagurinn, það sem bíður ───────────────────────

function Home({ rows, me, isDoctor, onOpen, onChanged }: { rows: Row[]; me: Me; isDoctor: boolean; onOpen: (id: string, compose?: boolean) => void; onChanged: () => void }) {
  const api = useWsApi();
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const hour = new Date().getHours();
  const greet = hour < 11 ? "Góðan daginn" : hour < 18 ? "Góðan dag" : "Gott kvöld";

  const enriched = useMemo(
    () => rows.map((r) => { const t = nextTask(r, isDoctor); return { r, t, f: rowFlags(r, t) }; }),
    [rows, isDoctor],
  );

  // Today's bookings, in the order they happen.
  const agenda = useMemo(() => {
    const out: { id: string; at: string; what: string; icon: React.ReactNode; row: Row }[] = [];
    for (const r of rows) {
      if (isToday(r.interview_booked_for) && !r.interview_done_at) out.push({ id: r.id, at: r.interview_booked_for!, what: `Viðtal${r.interview_mode === "video" ? " (myndsímtal)" : ""}`, icon: <MessageSquare className="h-4 w-4" />, row: r });
      if (isToday(r.followup_booked_for) && !r.followup_done_at) out.push({ id: r.id, at: r.followup_booked_for!, what: "Eftirfylgd", icon: <CalendarClock className="h-4 w-4" />, row: r });
      if (isToday(r.measurements_booked_for) && !r.measurements_done_at) out.push({ id: r.id, at: r.measurements_booked_for!, what: "Mælingar", icon: <Ruler className="h-4 w-4" />, row: r });
      if (isToday(r.blood_test_booked_for) && !r.blood_test_done_at) out.push({ id: r.id, at: r.blood_test_booked_for!, what: "Blóðprufa", icon: <Droplet className="h-4 w-4" />, row: r });
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [rows]);

  // What is waiting on this nurse, most pressing first. One list, no groups.
  const waiting = useMemo(
    () => enriched.filter((x) => x.f.rank < 2).sort((a, b) => a.f.rank - b.f.rank || b.f.waitingDays - a.f.waitingDays),
    [enriched],
  );

  const search = q.trim().toLowerCase();
  const found = useMemo(() => {
    if (!search) return [];
    return enriched
      .filter((x) => cleanName(x.r.client_name).toLowerCase().includes(search) || (x.r.client_phone || "").replace(/\s/g, "").includes(search.replace(/\s/g, "")))
      .slice(0, 8);
  }, [enriched, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{longDate(new Date())}</p>
        <h1 className="text-2xl font-bold text-slate-900">{greet}, {me.name.split(" ")[0]}</h1>
      </div>

      {/* 1. The day usually starts with a report landing on the desk. */}
      <ReportIntake api={api} onOpen={(journeyId) => onOpen(journeyId)} />

      {/* 2. Or with looking someone up. */}
      <div>
        <label className="relative block">
          <span className="sr-only">Leita að skjólstæðingi</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita að skjólstæðingi — nafn eða sími"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-base shadow-sm outline-none focus:border-emerald-400" />
        </label>
        {search && (
          <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {found.length === 0 && <li className="p-4 text-sm text-slate-500">Enginn fannst.</li>}
            {found.map(({ r, t, f }) => <SearchHit key={r.id} r={r} t={t} f={f} onOpen={onOpen} />)}
          </ul>
        )}
      </div>

      {/* 3. What is booked today. */}
      {agenda.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Í dag</h2>
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {agenda.map((a, i) => (
              <li key={`${a.id}-${i}`}>
                <button type="button" onClick={() => onOpen(a.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50">
                  <span className="w-12 text-lg font-bold tabular-nums text-slate-900">{time(a.at)}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">{a.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">{cleanName(a.row.client_name)} {isTest(a.row.client_name) && <TestBadge />}</span>
                    <span className="block text-sm text-slate-500">{a.what}{age(a.row.client_dob) ? ` · ${age(a.row.client_dob)}` : ""}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 4. Everything that needs a decision from you. */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Bíður þín {waiting.length > 0 && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">{waiting.length}</span>}
        </h2>
        {waiting.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Ekkert bíður. Vel gert.</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {waiting.map(({ r, t, f }) => <WaitingRow key={r.id} r={r} t={t} f={f} onOpen={onOpen} onChanged={onChanged} />)}
          </ul>
        )}
      </section>

      {/* 5. The whole list, only when asked for. */}
      <section>
        <button type="button" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}
          className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Allir skjólstæðingar</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{rows.length}</span>
          <span className="flex-1" />
          <ChevronRight className={`h-5 w-5 text-slate-300 transition ${showAll ? "rotate-90" : ""}`} />
        </button>
        {showAll && <div className="mt-3"><Clients rows={rows} me={me} isDoctor={isDoctor} onOpen={onOpen} /></div>}
      </section>
    </div>
  );
}

/** A search result: name, what is next, one tap in. */
function SearchHit({ r, t, f, onOpen }: { r: Row; t: Task; f: RowFlags; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[t.tone]}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">{cleanName(r.client_name)} {isTest(r.client_name) && <TestBadge />}</span>
          <span className="block truncate text-sm text-slate-500">{t.label}</span>
        </span>
        {f.nextAt && <span className="hidden text-xs text-slate-500 sm:block">{isToday(f.nextAt) ? `${f.nextWhat} kl. ${time(f.nextAt)}` : `${f.nextWhat} ${day(f.nextAt)}`}</span>}
        <ChevronRight className="h-5 w-5 text-slate-300" />
      </button>
    </li>
  );
}

/** One thing waiting on the nurse: who, what, and the single next action. */
function WaitingRow({ r, t, f, onOpen }: {
  r: Row; t: Task; f: RowFlags; onOpen: (id: string, compose?: boolean) => void; onChanged: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <button type="button" onClick={() => onOpen(r.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[t.tone]}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">{cleanName(r.client_name)} {isTest(r.client_name) && <TestBadge />}</span>
          <span className="block text-sm text-slate-500">
            <span className={f.reportLate ? "font-semibold text-red-600" : ""}>{t.label}</span>
            {f.waitingDays > 2 && <span className="text-slate-400"> · {f.waitingDays} d.</span>}
          </span>
        </span>
      </button>
      <button type="button" onClick={() => onOpen(r.id)} className={`${btnPrimary} min-h-9 px-3 text-xs`}>{t.cta}</button>
    </li>
  );
}

function TestBadge() {
  return <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase text-amber-800">Prufa</span>;
}


// ── Skjólstæðingar ──────────────────────────────────────────────────────────

const STAGE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Allir" }, { key: "tests", label: "Heilsufarsskoðun" }, { key: "report", label: "Skýrsla" },
  { key: "interview", label: "Viðtal" }, { key: "plan", label: "Áætlun" }, { key: "action", label: "Í aðgerð" },
];
const STAGE_TEXT: Record<string, string> = { tests: "Heilsufarsskoðun", report: "Skýrsla", interview: "Viðtal", plan: "Áætlun", action: "Í aðgerð" };

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
const SORTS = [
  { key: "urgent", label: "Mest aðkallandi" },
  { key: "next", label: "Næsti tími" },
  { key: "waiting", label: "Beðið lengst" },
  { key: "name", label: "Nafn" },
] as const;

function Clients({ rows, me, isDoctor, onOpen }: { rows: Row[]; me: Me; isDoctor: boolean; onOpen: (id: string, compose?: boolean) => void }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [mine, setMine] = useState(false);
  const [hideTest, setHideTest] = useState(false);
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("urgent");
  const [open, setOpenRow] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const enriched = rows.map((r) => { const t = nextTask(r, isDoctor); return { r, t, f: rowFlags(r, t) }; });
    const filtered = enriched
      .filter((x) => stage === "all" || x.r.stage === stage)
      .filter((x) => !mine || x.r.interviewer_id === me.id)
      .filter((x) => !hideTest || !isTest(x.r.client_name))
      .filter((x) => !s || cleanName(x.r.client_name).toLowerCase().includes(s) || (x.r.client_phone || "").replace(/\s/g, "").includes(s.replace(/\s/g, "")));
    const byName = (a: typeof filtered[number], b: typeof filtered[number]) =>
      cleanName(a.r.client_name).localeCompare(cleanName(b.r.client_name), "is");
    return filtered.sort((a, b) => {
      if (sort === "name") return byName(a, b);
      if (sort === "waiting") return b.f.waitingDays - a.f.waitingDays || byName(a, b);
      if (sort === "next") {
        if (a.f.nextAt && b.f.nextAt) return a.f.nextAt.localeCompare(b.f.nextAt);
        if (a.f.nextAt) return -1;
        if (b.f.nextAt) return 1;
        return byName(a, b);
      }
      return a.f.rank - b.f.rank || b.f.waitingDays - a.f.waitingDays || byName(a, b);
    });
  }, [rows, q, stage, mine, hideTest, sort, isDoctor, me.id]);

  const counts = useMemo(() => {
    let urgent = 0, today = 0;
    for (const r of rows) {
      const f = rowFlags(r, nextTask(r, isDoctor));
      if (f.rank === 0) urgent++;
      if (isToday(f.nextAt)) today++;
    }
    return { urgent, today, total: rows.length };
  }, [rows, isDoctor]);

  const toggle = (on: boolean) =>
    `${btn} min-h-9 ${on ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Skjólstæðingar</h1>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{counts.urgent} aðkallandi</span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">{counts.today} í dag</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{counts.total} alls</span>
        </div>
        <span className="flex-1" />
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Leita</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nafn eða sími…" className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm" />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sía eftir stöðu">
        {STAGE_FILTERS.map((f) => {
          const n = f.key === "all" ? rows.length : rows.filter((r) => r.stage === f.key).length;
          return (
            <button key={f.key} type="button" aria-pressed={stage === f.key} onClick={() => setStage(f.key)}
              className={`${btn} min-h-9 ${stage === f.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {f.label} <span className="text-xs opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={mine} onClick={() => setMine(!mine)} className={toggle(mine)}>Mín viðtöl</button>
        <button type="button" aria-pressed={hideTest} onClick={() => setHideTest(!hideTest)} className={toggle(hideTest)}>Fela prufugögn</button>
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm text-slate-500">
          Raða
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-xl border border-slate-300 px-2 py-1.5 text-sm font-semibold text-slate-800">
            {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {list.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Enginn fannst.</li>}
        {list.map(({ r, t, f }) => (
          <ClientRow key={r.id} r={r} t={t} f={f} expanded={open === r.id}
            onToggle={() => setOpenRow(open === r.id ? null : r.id)} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}

/** One client: the line a nurse scans, and the detail underneath it. */
function ClientRow({ r, t, f, expanded, onToggle, onOpen }: {
  r: Row; t: Task; f: RowFlags; expanded: boolean; onToggle: () => void; onOpen: (id: string, compose?: boolean) => void;
}) {
  const name = cleanName(r.client_name);
  const planChip = r.plan_published_at ? { text: "Áætlun birt", cls: "bg-emerald-50 text-emerald-700" }
    : r.plan_status === "draft" ? { text: "Áætlun í drögum", cls: "bg-amber-50 text-amber-800" } : null;
  return (
    <li className={expanded ? "bg-slate-50/60" : ""}>
      <div className="flex w-full items-center gap-3 px-3 py-3 sm:px-4">
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-bold text-emerald-800">
            {name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-white ${TONE_DOT[t.tone]}`} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 font-semibold text-slate-900">
              {name}
              {isTest(r.client_name) && <TestBadge />}
              {age(r.client_dob) && <span className="text-xs font-normal text-slate-400">{age(r.client_dob)}</span>}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span className={f.reportLate ? "font-semibold text-red-600" : ""}>{t.label}</span>
              {f.reportLate && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">Tímamörk liðin</span>}
              {r.doctor_review_requested_at && !r.doctor_reviewed_at && (
                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-bold text-purple-700">Bíður læknis</span>
              )}
              {r.referral_to_heilsugaesla && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700">Tilvísun</span>}
            </span>
          </span>
          <span className="hidden text-right text-xs sm:block">
            {f.nextAt ? (
              <span className={`block font-semibold ${isToday(f.nextAt) ? "text-emerald-700" : "text-slate-600"}`}>
                {f.nextWhat} {isToday(f.nextAt) ? `kl. ${time(f.nextAt)}` : day(f.nextAt)}
              </span>
            ) : <span className="block text-slate-400">Ekkert bókað</span>}
            <span className="block text-slate-400">{f.waitingDays === 0 ? "Uppfært í dag" : `${f.waitingDays} d. síðan`}</span>
          </span>
          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 sm:inline">{STAGE_TEXT[r.stage] ?? r.stage}</span>
          <ChevronRight className={`h-5 w-5 shrink-0 text-slate-300 transition ${expanded ? "rotate-90" : ""}`} />
        </button>
        <button type="button" onClick={() => onOpen(r.id)} className={`${btnPrimary} hidden min-h-9 px-3 text-xs sm:inline-flex`}>{t.cta}</button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpen(r.id)} className={`${btnDark} min-h-9 px-3 text-xs`}>Opna skjólstæðing</button>
            <button type="button" onClick={() => onOpen(r.id)} className={`${btnSecondary} min-h-9 px-3 text-xs`}><ClipboardList className="h-4 w-4" /> Viðtal</button>
            <button type="button" onClick={() => onOpen(r.id)} className={`${btnSecondary} min-h-9 px-3 text-xs`}><FileCheck2 className="h-4 w-4" /> Áætlun</button>
            <button type="button" onClick={() => onOpen(r.id, true)} className={`${btnSecondary} min-h-9 px-3 text-xs`}><Bell className="h-4 w-4" /> Skilaboð</button>
            {r.client_phone && <a href={`tel:${r.client_phone}`} className={`${btnSecondary} min-h-9 px-3 text-xs`}><Phone className="h-4 w-4" /> {r.client_phone}</a>}
            {planChip && <span className={`ml-auto self-center rounded-full px-2.5 py-1 text-xs font-semibold ${planChip.cls}`}>{planChip.text}</span>}
          </div>

          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Blóðprufa", r.blood_test_done_at || r.blood_results_at ? `Komin ${day(r.blood_test_done_at ?? r.blood_results_at)}` : r.blood_test_booked_for ? `Bókuð ${dayTime(r.blood_test_booked_for)}` : "Ekki bókuð"],
              ["Mælingar", r.measurements_done_at ? `Komnar ${day(r.measurements_done_at)}` : r.measurements_booked_for ? `Bókaðar ${dayTime(r.measurements_booked_for)}` : "Ekki bókaðar"],
              ["Viðtal", r.interview_done_at ? `Lokið ${day(r.interview_done_at)}` : r.interview_booked_for ? `${dayTime(r.interview_booked_for)}${r.interview_mode === "video" ? " (mynd)" : ""}` : "Ekki bókað"],
              ["Eftirfylgd", r.followup_done_at ? `Lokið ${day(r.followup_done_at)}` : r.followup_booked_for ? dayTime(r.followup_booked_for) : "Ekki bókuð"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </li>
  );
}

// ── Client page ─────────────────────────────────────────────────────────────

function PatientView({ id, compose, me, onBack, onChanged }: {
  id: string; compose: boolean; me: Me; onBack: () => void; onChanged: () => void;
}) {
  const api = useWsApi();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"messages" | "referral" | "orders" | "history" | null>(null);
  const [touched, setTouched] = useState(false);
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
    <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100"><ArrowLeft className="h-4 w-4" /></span> Til baka
    </button>
  );
  if (err) return <div className="space-y-4">{backBtn}<p className="rounded-2xl bg-white p-6 text-slate-600">{err}</p></div>;
  if (!d) return <div className="space-y-4">{backBtn}<p className="p-6 text-slate-500">Hleð…</p></div>;

  const j = d.journey;
  const kt = d.patient.kennitala;
  const steps = buildSteps({ d, isDoctor, api, record, reload: load, onChanged });
  // Open the step that needs attention; on a finished journey fall back to
  // what comes next, so the page is never just a wall of closed rows.
  const live = steps.filter((x) => !x.hidden);
  const current =
    live.find((x) => x.state === "current") ??
    live.find((x) => x.state === "waiting") ??
    live.find((x) => x.state === "upcoming") ??
    live.at(-1);
  // Once a report is in, that is what the nurse is here to read — the whole
  // interview is spent on it. Opening the current step instead buried it
  // behind a one-line summary and it looked as though the questionnaire had
  // never imported.
  const landOn = d.report ? "results" : current?.key ?? null;
  const shownOpen = touched ? openStep : landOn;

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
  const openReferrals = (d.referrals ?? []).filter((r) => r.status === "requested").length;

  const open = live.find((x) => x.key === shownOpen);
  const jump = (k: string) => { setTouched(true); setOpenStep(k); };

  return (
    <div className="space-y-4">
      {backBtn}

      {/* Who this is, and how to reach them. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">
            {cleanName(d.patient.full_name).split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-slate-900">{cleanName(d.patient.full_name)}</h1>
            <p className="truncate text-sm text-slate-500">
              {[kt ? `${kt.slice(0, 6)}-${kt.slice(6)}` : null, age(d.patient.date_of_birth), d.location?.name].filter(Boolean).join(" · ")}
              {isTest(d.patient.full_name) && <> <TestBadge /></>}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
          {d.patient.phone && (
            <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              <a href={`tel:${d.patient.phone}`} className="hover:underline">{d.patient.phone}</a>
            </span>
          )}
          {d.patient.email && (
            <span className="inline-flex min-w-0 items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <a href={`mailto:${d.patient.email}`} className="truncate hover:underline">{d.patient.email}</a>
            </span>
          )}
          {/* Payment and the activation code are facts about this person, so
              they sit with the rest of them rather than on the timeline,
              where they had nothing to do with the steps around them. */}
          <button type="button" onClick={() => setSheet("orders")}
            className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 hover:bg-slate-100">
            <CreditCard className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span className={paid ? "text-emerald-800" : "font-semibold text-amber-800"}>{paid ? "Greitt" : "Ógreitt"}</span>
            {code && (
              <span className="text-slate-500">
                · kóði {code.activation_redeemed_at ? "virkjaður" : code.activation_code}
              </span>
            )}
          </button>
          <a href="https://provider.medalia.is" target="_blank" rel="noreferrer" className={`${btnSecondary} ml-auto min-h-8 px-3 text-xs`}>
            <ExternalLink className="h-4 w-4" /> Medalia
          </a>
        </div>
        {j.plan_published_at && <div className="mt-3"><Adherence d={d} /></div>}
      </section>

      <StatusStrip steps={checkpoints} onOpen={jump} />

      {/* Messages and referral used to sit in a column beside the panel, which
          left the plan builder two thirds of a screen to drag four pillars
          around in. They are buttons now and open over the top, so whatever
          step is open gets the whole width. */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSheet("messages")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Bell className="h-4 w-4" /> Skilaboð
          {d.messages.length > 0 && <span className="text-slate-400">{d.messages.length}</span>}
        </button>
        <button type="button" onClick={() => setSheet("referral")}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${
            openReferrals > 0
              ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
          <Stethoscope className="h-4 w-4" /> Þarf tilvísun?
          {openReferrals > 0 && <span className="rounded-full bg-amber-200 px-1.5 text-xs">{openReferrals}</span>}
        </button>
      </div>

      <div className="grid gap-4">
        {/* What you are doing right now. One panel, chosen from the line. */}
        <div>
          {open ? (
            <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">{open.icon}</span>
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-slate-900">{open.title}</h2>
                  <p className="truncate text-xs text-slate-500">{open.status}</p>
                </div>
              </div>
              {open.body}
            </section>
          ) : null}
        </div>

      </div>

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
        <Sheet title="Þarf tilvísun?" onClose={() => setSheet(null)}>
          <div className="space-y-3">
            <DoctorReview d={d} isDoctor={isDoctor} record={record} />
            <Referrals api={api} journeyId={j.id} referrals={d.referrals ?? []}
              suggestions={aiReferrals} isDoctor={isDoctor} onChanged={() => void load()} />
          </div>
        </Sheet>
      )}

      {/* Out of the way, but one click from anywhere. */}
      <div className="flex flex-wrap gap-4 px-1 pt-1 text-xs">
        <button type="button" onClick={() => setSheet("history")} className="font-semibold text-slate-400 hover:text-slate-700 hover:underline">
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
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
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
function buildSteps({ d, isDoctor, api, record, reload, onChanged }: {
  d: Detail; isDoctor: boolean; api: WsApi;
  record: (p: Record<string, unknown>) => Promise<string | null>;
  reload: () => Promise<void>; onChanged: () => void;
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
      state: j.interview_done_at ? "done" : j.interview_booked_for ? "current" : j.report_generated_at ? "current" : "upcoming",
      status: j.interview_done_at
        ? `Lokið ${day(j.interview_done_at)}`
        : j.interview_booked_for
          ? `${dayTime(j.interview_booked_for)}${j.interview_mode === "video" ? " · myndsímtal" : ""}`
          : j.report_generated_at ? "Ekki bókað — hafðu samband og finndu tíma" : "Bókast þegar skýrslan er staðfest",
      body: <InterviewStep d={d} isDoctor={isDoctor} record={record} />,
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
      body: <FollowupStep d={d} record={record} />,
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
  return (
    <div className="space-y-4">
      {d.report && (
        <>
          <ReportView report={d.report.report} signals={d.report.signals}
            reference={d.report.reference} sex={d.report.sex} />
          <p className="text-xs text-slate-500">
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
  if (!j.blood_results_at) return <p className="text-sm text-slate-500">Skýrslan er staðfest þegar blóðprufusvörin eru komin.</p>;
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
          Svörin komu fyrir {minutesSince(j.blood_results_at)} mínútum. Læknir fær SMS ef skýrslan er ekki staðfest innan fimm mínútna.
        </p>
      )}
      {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
    </div>
  );
}

function InterviewStep({ d, isDoctor, record }: { d: Detail; isDoctor: boolean; record: (p: Record<string, unknown>) => Promise<string | null>; }) {
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
        disabled={!j.report_generated_at} disabledText="Hægt að bóka þegar skýrsla er staðfest."
        onBook={(at, mode, meeting_url) => run({ event: "interview_booked", at, mode, meeting_url }, "Viðtal bókað og sett í dagatal.")} busy={busy} />
      {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
      {(j.interview_booked_for || j.interview_done_at) && <Interview d={d} isDoctor={isDoctor} record={record} />}
    </div>
  );
}

function FollowupStep({ d, record }: { d: Detail; record: (p: Record<string, unknown>) => Promise<string | null> }) {
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
      <Booking label="Eftirfylgd" at={j.followup_booked_for} done={j.followup_done_at} mode={j.followup_booked_for ? j.interview_mode : "video"} meetingUrl={j.meeting_url}
        disabled={!j.interview_done_at} disabledText="Hægt að bóka eftir fyrsta viðtal." suggest={90}
        onBook={(at, mode, meeting_url) => run({ event: "followup_booked", at, mode, meeting_url }, "Eftirfylgd bókuð og sett í dagatal.")} busy={busy} />
      {j.followup_booked_for && !j.followup_done_at && (
        <button type="button" disabled={busy} onClick={() => run({ event: "followup_done" }, "Eftirfylgd skráð.")} className={`${btnSecondary} w-full sm:w-auto`}>Merkja eftirfylgd lokið</button>
      )}
      {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
    </div>
  );
}

function DoctorReview({ d, isDoctor, record }: { d: Detail; isDoctor: boolean; record: (p: Record<string, unknown>) => Promise<string | null> }) {
  const j = d.journey;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const run = async (p: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg("");
    const e = await record(p);
    setBusy(false); setMsg(e ?? ok);
  };
  return (
    <div className="space-y-2">
      {j.doctor_review_requested_at && (
        <div className={`rounded-xl p-3 text-sm ${j.doctor_reviewed_at ? "bg-slate-50 text-slate-600" : "bg-amber-50 text-amber-900"}`}>
          <p className="font-semibold">{j.doctor_reviewed_at ? `Læknir hefur metið (${day(j.doctor_reviewed_at)})` : `Beðið um mat læknis (${day(j.doctor_review_requested_at)})`}</p>
          {j.doctor_review_note && <p className="mt-1">{j.doctor_review_note}</p>}
          {isDoctor && !j.doctor_reviewed_at && (
            <button type="button" disabled={busy} onClick={() => run({ action: "doctor_reviewed" }, "Skráð sem metið.")} className={`${btnDark} mt-2`}>Merkja sem metið</button>
          )}
        </div>
      )}
      {j.referral_to_heilsugaesla ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Vísað á Heilsugæsluna</b> {day(j.referred_at)}{j.referral_note ? `: ${j.referral_note}` : ""}</p>
      ) : (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={isDoctor ? "Ástæða tilvísunar (fer ekki til skjólstæðings)" : "Hvað á læknirinn að meta?"}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            {!isDoctor && <button type="button" disabled={busy || !note.trim()} onClick={() => run({ action: "request_doctor", note }, "Læknar hafa fengið beiðnina.").then(() => setNote(""))} className={btnSecondary}>Biðja lækni að meta</button>}
            {isDoctor && <button type="button" disabled={busy || !note.trim()} onClick={() => run({ event: "referral_heilsugaesla", note }, "Tilvísun skráð.").then(() => setNote(""))} className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}>Skrá tilvísun á Heilsugæsluna</button>}
          </div>
        </>
      )}
      {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
    </div>
  );
}

function Orders({ d, record }: { d: Detail; record: (p: Record<string, unknown>) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5 text-sm">
        {d.orders.length === 0 && <li className="text-slate-500">Engar greiðslur skráðar.</li>}
        {d.orders.map((o) => (
          <li key={o.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span>{o.kind === "health_check" ? "Heilsufarsskoðun" : o.kind === "followup_3m" ? "Eftirfylgd" : o.kind === "reevaluation" ? "Endurmat" : "Aukaviðtal"} · {o.payment_route === "company" ? "fyrirtæki" : o.payment_route === "union" ? "stéttarfélag" : "sjálf(ur)"}</span>
            <span className="font-mono text-xs text-slate-500">{o.activation_code}{o.activation_redeemed_at ? " ✓" : ""}</span>
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
  const tone = status === "on-track" ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
    : status === "needs-nudge" ? "bg-amber-50 text-amber-900 ring-amber-200"
    : "bg-slate-50 text-slate-700 ring-slate-200";
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
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
    interviewAt: j.interview_booked_for, interviewMode: j.interview_mode, followupAt: j.followup_booked_for, meetingUrl: j.meeting_url,
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
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sniðmát</p>
                <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sniðmát">
                  {MESSAGE_TEMPLATES.map((t) => (
                    <button key={t.key} type="button" role="radio" aria-checked={tpl === t.key} onClick={() => pick(t.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tpl === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Rás">
                <button type="button" aria-pressed={sms} disabled={!d.patient.phone} onClick={() => setSms((v) => !v)}
                  className={`${btn} min-h-9 ${sms ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
                  <Phone className="h-4 w-4" /> SMS {sms && "✓"}
                </button>
                <button type="button" aria-pressed={email} disabled={!d.patient.email} onClick={() => setEmail((v) => !v)}
                  className={`${btn} min-h-9 ${email ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
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
                <p className={`text-xs ${size.segments > 3 ? "text-amber-700" : "text-slate-500"}`}>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Send skilaboð</p>
              <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                {d.messages.length === 0 && <li className="text-sm text-slate-400">Engin skilaboð enn.</li>}
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
                    <p className="mt-1 text-slate-400">{m.sent_by}</p>
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

function Booking({ label, at, done, mode, meetingUrl, disabled, disabledText, onBook, busy, suggest }: {
  label: string; at: string | null; done: string | null; mode?: string | null; meetingUrl?: string | null;
  disabled: boolean; disabledText: string;
  onBook: (at: string, mode: "in_person" | "video", meetingUrl: string | null) => void; busy: boolean; suggest?: number;
}) {
  const [editing, setEditing] = useState(false);
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
          <span className="text-slate-500">{done ? `Lokið ${dayTime(done)}` : at ? `${dayTime(at)}${mode === "video" ? " · myndsímtal" : ""}` : disabled ? disabledText : "Ekki bókað"}</span>
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
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
          <label className="text-xs font-semibold text-slate-600">Dagur og tími
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
          {mode !== undefined && (
            <div className="flex gap-1" role="radiogroup" aria-label="Form">
              {([["in_person", "Á staðnum"], ["video", "Myndsímtal"]] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={m === k} onClick={() => setM(k)}
                  className={`${btn} min-h-9 ${m === k ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{l}</button>
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
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
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

// ── Viðtal: guided, step by step ───────────────────────────────────────────

const PREP: string[] = [
  "Opnaðu skýrsluna í Medalia og lestu samantekt læknis.",
  "Skoðaðu blóðprufur: blóðsykur (HbA1c), blóðfitur og annað sem læknir merkti.",
  "Skoðaðu mælingar: blóðþrýsting og líkamssamsetningu.",
  "Lestu svör við spurningalista um svefn, hreyfingu, næringu og andlega líðan.",
  "Merktu við 1–2 atriði sem standa upp úr til að ræða.",
];

const TOPICS: { key: keyof InterviewNotes; title: string; color: string; prompts: string[] }[] = [
  { key: "goals", title: "Hvað vill skjólstæðingurinn?", color: "#10B981", prompts: ["Hvað viltu fá út úr þessu?", "Hvað myndi breyta mestu fyrir þig næstu þrjá mánuði?"] },
  { key: "sleep", title: PILLAR_META.sleep.label, color: PILLAR_META.sleep.color, prompts: ["Hvenær ferðu að sofa og á fætur?", "Vaknarðu úthvíld(ur)?", "Skjánotkun, koffín, áfengi á kvöldin?"] },
  { key: "exercise", title: PILLAR_META.exercise.label, color: PILLAR_META.exercise.color, prompts: ["Hvernig hreyfingu stundar þú í dag?", "Hvað finnst þér skemmtilegt?", "Verkir eða takmarkanir?"] },
  { key: "nutrition", title: PILLAR_META.nutrition.label, color: PILLAR_META.nutrition.color, prompts: ["Hvernig lítur venjulegur dagur út?", "Reglulegar máltíðir? Sykraðir drykkir?", "Hver sér um innkaup og eldamennsku?"] },
  { key: "mental", title: PILLAR_META.mental.label, color: PILLAR_META.mental.color, prompts: ["Hvernig er álagið núna?", "Hvað gefur þér orku?", "Stuðningur, tengsl, hvíld?"] },
  { key: "measurements", title: "Mælingar og blóðprufur", color: "#475569", prompts: ["Hvað sýna niðurstöðurnar á mannamáli?", "Hvað kom skjólstæðingnum á óvart?"] },
];

const STEPS = ["Undirbúningur", "Samtal", "Mat", "Áætlun", "Ljúka"] as const;

function Interview({ d, isDoctor, record, onPlan }: { d: Detail; isDoctor: boolean; record: (p: Record<string, unknown>) => Promise<string | null>; onPlan?: () => void }) {
  const api = useWsApi();
  const j = d.journey;
  const isFollowup = !!j.interview_done_at;
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(() => PREP.map(() => false));
  const [notes, setNotes] = useState<InterviewNotes>(j.interview_notes ?? {});
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave notes a second after typing stops.
  const setNote_ = (k: keyof InterviewNotes, v: string) => {
    const next = { ...notes, [k]: v };
    setNotes(next);
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await api(`/api/vinnustod/journeys/${j.id}`, { method: "PATCH", body: JSON.stringify({ interview_notes: next }) });
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

  if (!j.report_generated_at) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Viðtalið opnast þegar læknir hefur staðfest skýrsluna.</p>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      {/* Stepper */}
      <nav aria-label="Skref viðtals" className="lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{isFollowup ? "Eftirfylgdarviðtal" : "Viðtal"}</p>
        <ol className="flex gap-2 overflow-x-auto lg:flex-col">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
                className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${step === i ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
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
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Undirbúningur</h3>
            <p className="mb-4 text-sm text-slate-500">Um 10 mínútur fyrir viðtalið.</p>
            <ul className="space-y-2">
              {PREP.map((p, i) => (
                <li key={i}>
                  <button type="button" role="checkbox" aria-checked={checked[i]} onClick={() => setChecked(checked.map((c, k) => (k === i ? !c : c)))}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${checked[i] ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 hover:bg-slate-50"}`}>
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
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Samtal</h3>
                <p className="text-sm text-slate-500">Byrjaðu á því sem skjólstæðingurinn vill breyta. Punktarnir vistast sjálfkrafa og fylgja í áætlunina.</p>
              </div>
              <span className={`text-xs font-semibold ${saved === "error" ? "text-red-600" : "text-slate-400"}`} role="status">
                {saved === "saving" ? "Vistar…" : saved === "saved" ? "✓ Vistað" : saved === "error" ? "Vistun mistókst" : ""}
              </span>
            </div>
            <div className="space-y-4">
              {TOPICS.map((t) => (
                <div key={t.key} className="rounded-xl border border-slate-200 p-3" style={{ borderLeftWidth: 4, borderLeftColor: t.color }}>
                  <label htmlFor={`note-${t.key}`} className="font-semibold text-slate-900">{t.title}</label>
                  <p className="mt-0.5 text-xs text-slate-500">{t.prompts.join(" · ")}</p>
                  <textarea id={`note-${t.key}`} value={notes[t.key] ?? ""} onChange={(e) => setNote_(t.key, e.target.value)} rows={3}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
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
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Mat</h3>
            <p className="mb-4 text-sm text-slate-500">Er eitthvað í niðurstöðum eða samtalinu sem gæti kallað á læknismeðferð?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-900">Nei, lífsstílsáætlun nægir</p>
                <p className="mt-1 text-sm text-emerald-800">Haltu áfram í áætlunargerð.</p>
                <button type="button" onClick={() => setStep(3)} className={`${btnPrimary} mt-3`}>Áfram í áætlun <ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-900">{isDoctor ? "Já, vísa á Heilsugæsluna" : "Já eða óviss, biðja lækni að meta"}</p>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={isDoctor ? "Ástæða tilvísunar" : "Hvað á læknirinn að meta?"}
                  className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" />
                {j.doctor_review_requested_at && !j.doctor_reviewed_at && <p className="mt-1 text-xs text-amber-800">Beiðni send {day(j.doctor_review_requested_at)}.</p>}
                {j.referral_to_heilsugaesla && <p className="mt-1 text-xs text-amber-800">Þegar vísað á Heilsugæsluna.</p>}
                <button type="button" disabled={busy || !note.trim()}
                  onClick={async () => { if (await run(isDoctor ? { event: "referral_heilsugaesla", note } : { action: "request_doctor", note }, isDoctor ? "Tilvísun skráð." : "Læknar hafa fengið beiðnina með SMS og tölvupósti.")) setNote(""); }}
                  className={`${btn} mt-2 bg-amber-600 text-white hover:bg-amber-700`}>
                  {isDoctor ? "Skrá tilvísun" : "Senda beiðni til læknis"}
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Lífsstílsáætlunin heldur áfram þótt vísað sé á Heilsugæsluna.</p>
          </section>
        )}

        {step === 3 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Aðgerðaáætlun</h3>
            <p className="mt-1 text-sm text-slate-500">Veldu sniðmát sem passar, dragðu inn 2–4 aðgerðir á stoð í mesta lagi og skrifaðu persónulegar athugasemdir. Punktar úr samtalinu fylgja sem samantekt.</p>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-bold text-slate-900">Ljúka</h3>
      <ol className="mt-4 space-y-3">
        <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${(isFollowup ? j.followup_done_at : interviewDone) ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
            {(isFollowup ? j.followup_done_at : interviewDone) ? <Check className="h-4 w-4" /> : 1}
          </span>
          <span className="flex-1 text-sm font-semibold text-slate-800">{isFollowup ? "Merkja eftirfylgd lokið" : "Merkja viðtali lokið"}</span>
          {!(isFollowup ? j.followup_done_at : interviewDone) && (
            <button type="button" disabled={busy} onClick={() => run({ event: isFollowup ? "followup_done" : "interview_done" }, "Skráð.")} className={btnPrimary}>Merkja lokið</button>
          )}
        </li>
        <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${planPublished ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>{planPublished ? <Check className="h-4 w-4" /> : 2}</span>
          <span className="flex-1 text-sm font-semibold text-slate-800">Aðgerðaáætlun birt skjólstæðingi</span>
          {!planPublished && <span className="text-xs text-amber-700">Ekki birt enn</span>}
        </li>
        {!isFollowup && (
          <li className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full ${j.followup_booked_for ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>{j.followup_booked_for ? <Check className="h-4 w-4" /> : 3}</span>
            <label className="flex-1 text-sm font-semibold text-slate-800">Bóka eftirfylgd eftir 3 mánuði <span className="font-normal text-slate-500">(ráðlögð, valfrjáls)</span>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <button type="button" disabled={busy || !when || !interviewDone} onClick={() => run({ event: "followup_booked", at: new Date(when).toISOString() }, "Eftirfylgd bókuð og sett í dagatal.")} className={btnSecondary}>
              {j.followup_booked_for ? "Breyta tíma" : "Bóka"}
            </button>
          </li>
        )}
      </ol>
      {!interviewDone && !isFollowup && <p className="mt-2 text-xs text-slate-500">Eftirfylgd er hægt að bóka þegar viðtali er merkt lokið.</p>}
      <p className="mt-3 text-xs text-slate-500">Skjólstæðingurinn fær tölvupóst þegar áætlunin er birt. Eftirfylgd er greidd sérstaklega á aðgangi hans.</p>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
        {audit.map((a, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            <p className="text-sm font-semibold text-slate-800">{actionText(a.action)}</p>
            <p className="text-xs text-slate-500">{dayTime(a.at)} · {a.actor}{a.note ? ` · ${a.note}` : ""}</p>
          </li>
        ))}
        {audit.length === 0 && <li className="text-sm text-slate-500">Engin saga enn.</li>}
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
            <button onClick={() => setUsePassword(true)} className="mt-5 block w-full text-center text-sm text-slate-500">Nota lykilorð</button>
          </div>
        ) : (
          <form onSubmit={loginPw} className="mt-6 space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Netfang" autoComplete="username" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Lykilorð" autoComplete="current-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} /> Treysta þessu tæki (PIN næst)</label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-[#10B981] py-2.5 font-semibold text-white disabled:opacity-50">{busy ? "Augnablik…" : "Skrá inn"}</button>
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

