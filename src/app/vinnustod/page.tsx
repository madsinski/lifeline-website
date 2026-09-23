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
  ArrowLeft, Bell, BookOpen, CalendarClock, CalendarDays, Check, ChevronRight, ClipboardList, Droplet, ExternalLink,
  FileCheck2, HeartPulse, LogOut, Mail, MessageSquare, Phone, Ruler, Search, Stethoscope, Users,
} from "lucide-react";
import LifelineLogo from "@/app/components/LifelineLogo";
import PinPad from "@/app/components/hc/PinPad";
import PlanBuilder from "@/app/components/hc/PlanBuilder";
import CalendarConnect, { type CalendarApi } from "@/app/components/hc/CalendarConnect";
import KnowledgeSearch, { useKnowledgeHotkey } from "@/app/components/hc/KnowledgeSearch";
import ResultsCard, { sexOf, type HcResult } from "@/app/components/hc/ResultsCard";
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
  logs: ActionLog[];
  prefs: ActionPref[];
  orders: { id: string; kind: string; payment_route: string; paid_at: string | null; activation_code: string | null; activation_redeemed_at: string | null }[];
  audit: { actor: string; action: string; at: string; note: string | null }[];
  plan: { status: string; published_at: string | null; headline: string | null; modules: PlanItem[] } | null;
  location: { name: string } | null;
  actor: { label: string; isDoctor: boolean; name: string | null };
  messages: { id: string; channel: "sms" | "email"; recipient: string; template: string | null; subject: string | null; body: string; status: string; error: string | null; sent_by: string; sent_at: string }[];
}
type View = { tab: "today" | "clients" } | { patient: string; section?: Section; compose?: boolean };
type Section = "overview" | "interview" | "plan" | "history";

// ── Helpers ─────────────────────────────────────────────────────────────────

const ws = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, credentials: "same-origin", headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) } });

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
type Task = { key: string; label: string; cta: string; section: Section; tone: "urgent" | "normal" | "waiting"; doctorOnly?: boolean };
function nextTask(r: Row | Journey, isDoctor: boolean): Task {
  if (isDoctor && r.doctor_review_requested_at && !r.doctor_reviewed_at)
    return { key: "review", label: "Beiðni um mat læknis", cta: "Meta", section: "overview", tone: "urgent", doctorOnly: true };
  switch (r.stage) {
    case "protocol": return { key: "activate", label: "Hefur ekki virkjað í gátt", cta: "Senda áminningu", section: "overview", tone: "waiting" };
    case "tests": {
      const todo = [!(r.blood_test_done_at || r.blood_results_at) && "blóðprufa", !r.measurements_done_at && "mælingar"].filter(Boolean).join(" og ");
      return { key: "tests", label: `Bíður: ${todo}`, cta: "Skrá", section: "overview", tone: "waiting" };
    }
    case "report":
      return isDoctor
        ? { key: "report", label: "Skýrsla bíður staðfestingar", cta: "Staðfesta", section: "overview", tone: "urgent", doctorOnly: true }
        : { key: "report", label: "Bíður þess að læknir staðfesti skýrslu", cta: "Opna", section: "overview", tone: "waiting" };
    case "interview":
      return r.interview_booked_for
        ? { key: "interview", label: `Viðtal ${isToday(r.interview_booked_for) ? `í dag kl. ${time(r.interview_booked_for)}` : dayTime(r.interview_booked_for)}`, cta: "Hefja viðtal", section: "interview", tone: isToday(r.interview_booked_for) ? "urgent" : "normal" }
        : { key: "book", label: "Viðtal ekki bókað", cta: "Bóka viðtal", section: "overview", tone: "normal" };
    case "plan": return { key: "plan", label: "Viðtali lokið, áætlun vantar", cta: "Klára áætlun", section: "plan", tone: "urgent" };
    case "action":
      return r.followup_booked_for && !r.followup_done_at
        ? { key: "followup", label: `Eftirfylgd ${dayTime(r.followup_booked_for)}`, cta: "Opna", section: "interview", tone: isToday(r.followup_booked_for) ? "urgent" : "normal" }
        : { key: "bookfollow", label: "Áætlun birt, eftirfylgd ekki bókuð", cta: "Bóka eftirfylgd", section: "overview", tone: "normal" };
    default: return { key: "none", label: "", cta: "Opna", section: "overview", tone: "waiting" };
  }
}

// ── Root ────────────────────────────────────────────────────────────────────

export default function Vinnustod() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const load = useCallback(async () => {
    const r = await ws("/api/vinnustod/me");
    setMe(r.ok ? (await r.json()).me : null);
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  if (me === undefined) return <div className="p-10 text-center text-slate-500">Hleð…</div>;
  if (me === null) return <Login onDone={load} />;
  return <Workstation me={me} onLogout={() => setMe(null)} onPinSet={load} />;
}

// ── Shell ───────────────────────────────────────────────────────────────────

function readView(): View {
  if (typeof window === "undefined") return { tab: "today" };
  const q = new URLSearchParams(window.location.search);
  const p = q.get("p");
  if (p) return { patient: p, section: (q.get("s") as Section) || undefined, compose: q.get("m") === "1" };
  return { tab: q.get("t") === "clients" ? "clients" : "today" };
}

function Workstation({ me, onLogout, onPinSet }: { me: Me; onLogout: () => void; onPinSet: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [view, setViewState] = useState<View>(readView);
  const [showPin, setShowPin] = useState(false);
  const [showBook, setShowBook] = useState(false);
  const [showCal, setShowCal] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.has("google") || q.get("cal") === "1";
  });
  const isDoctor = me.role === "doctor" || me.role === "admin";

  // URL mirrors the view so the browser's back button and links work.
  const setView = useCallback((v: View) => {
    setViewState(v);
    const u = new URL(window.location.href);
    ["p", "s", "t", "m"].forEach((k) => u.searchParams.delete(k));
    if ("patient" in v) { u.searchParams.set("p", v.patient); u.searchParams.set("s", v.section ?? "overview"); if (v.compose) u.searchParams.set("m", "1"); }
    else if (v.tab === "clients") u.searchParams.set("t", "clients");
    window.history.pushState(null, "", u);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const onPop = () => setViewState(readView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const load = useCallback(async () => {
    const r = await ws("/api/vinnustod/queue");
    if (r.status === 401) { onLogout(); return; }
    if (r.ok) setRows((await r.json()).journeys);
  }, [onLogout]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 60_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  const logout = async () => { await ws("/api/vinnustod/auth/logout", { method: "POST" }); onLogout(); };
  useKnowledgeHotkey(() => setShowBook(true));
  const open = (id: string, section: Section = "overview", compose = false) => setView({ patient: id, section, compose });
  const tab = "tab" in view ? view.tab : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5">
          <LifelineLogo size="sm" />
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Vinnustöð</span>
          <nav className="ml-2 flex gap-1" aria-label="Aðalvalmynd">
            <button type="button" aria-current={tab === "today" ? "page" : undefined} onClick={() => setView({ tab: "today" })}
              className={`${btn} min-h-9 ${tab === "today" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <ClipboardList className="h-4 w-4" /> Í dag
            </button>
            <button type="button" aria-current={tab === "clients" ? "page" : undefined} onClick={() => setView({ tab: "clients" })}
              className={`${btn} min-h-9 ${tab === "clients" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <Users className="h-4 w-4" /> Skjólstæðingar
            </button>
          </nav>
          <span className="flex-1" />
          <button type="button" onClick={() => setShowBook(true)} title="Ctrl/⌘ + K" className={`${btnSecondary} min-h-9`}><BookOpen className="h-4 w-4" /> Fletta upp</button>
          <button type="button" onClick={() => setShowCal(true)} className={`${btnGhost} min-h-9`}><CalendarDays className="h-4 w-4" /> Dagatal</button>
          <button type="button" onClick={() => setShowPin(true)} className={`${btnGhost} min-h-9`}>{me.has_pin ? "Breyta PIN" : "Setja PIN"}</button>
          <span className="hidden text-sm text-slate-500 lg:inline">{me.name} · {me.role === "doctor" ? "læknir" : me.role === "admin" ? "stjórnandi" : "hjúkrunarfræðingur"}</span>
          <button type="button" onClick={logout} className={`${btnSecondary} min-h-9`}><LogOut className="h-4 w-4" /> Útskrá</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {rows === null ? <p className="py-10 text-center text-slate-500">Hleð…</p>
          : "patient" in view ? <PatientView key={view.patient} id={view.patient} section={view.section ?? null} compose={!!view.compose} me={me} onBack={() => window.history.length > 1 ? window.history.back() : setView({ tab: "today" })} onChanged={load} onSection={(s) => setView({ patient: view.patient, section: s })} />
          : view.tab === "clients" ? <Clients rows={rows} me={me} isDoctor={isDoctor} onOpen={open} />
          : <Today rows={rows} me={me} isDoctor={isDoctor} onOpen={open} onChanged={load} />}
      </main>

      <KnowledgeSearch api={ws} open={showBook} onClose={() => setShowBook(false)} />
      {showPin && <PinModal onClose={() => setShowPin(false)} onDone={() => { setShowPin(false); onPinSet(); }} />}
      <CalendarConnect api={WORKER_CALENDAR} open={showCal} onClose={() => setShowCal(false)}
        intro="Viðtöl og eftirfylgd sem þér eru úthlutuð birtast í dagatalinu þínu um leið og þau eru bókuð. Aðeins upphafsstafir skjólstæðings koma fram." />
    </div>
  );
}

// ── Í dag ───────────────────────────────────────────────────────────────────

function Today({ rows, me, isDoctor, onOpen, onChanged }: { rows: Row[]; me: Me; isDoctor: boolean; onOpen: (id: string, s?: Section, compose?: boolean) => void; onChanged: () => void }) {
  const hour = new Date().getHours();
  const greet = hour < 11 ? "Góðan daginn" : hour < 18 ? "Góðan dag" : "Gott kvöld";

  // Today's timetable: every booking that falls on today.
  const agenda = useMemo(() => {
    const out: { id: string; at: string; what: string; icon: React.ReactNode; row: Row; section: Section }[] = [];
    for (const r of rows) {
      if (isToday(r.interview_booked_for) && !r.interview_done_at) out.push({ id: r.id, at: r.interview_booked_for!, what: `Viðtal${r.interview_mode === "video" ? " (myndsímtal)" : ""}`, icon: <MessageSquare className="h-4 w-4" />, row: r, section: "interview" });
      if (isToday(r.followup_booked_for) && !r.followup_done_at) out.push({ id: r.id, at: r.followup_booked_for!, what: "Eftirfylgd", icon: <CalendarClock className="h-4 w-4" />, row: r, section: "interview" });
      if (isToday(r.measurements_booked_for) && !r.measurements_done_at) out.push({ id: r.id, at: r.measurements_booked_for!, what: "Mælingar", icon: <Ruler className="h-4 w-4" />, row: r, section: "overview" });
      if (isToday(r.blood_test_booked_for) && !r.blood_test_done_at) out.push({ id: r.id, at: r.blood_test_booked_for!, what: "Blóðprufa (Heilsugæslan)", icon: <Droplet className="h-4 w-4" />, row: r, section: "overview" });
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [rows]);

  // To-do list grouped by the kind of next action.
  const groups = useMemo(() => {
    const order: { key: string; title: string; hint: string }[] = [
      ...(isDoctor ? [
        { key: "review", title: "Beiðnir um mat læknis", hint: "Hjúkrunarfræðingur óskar eftir áliti." },
        { key: "report", title: "Skýrslur til staðfestingar", hint: "Blóðprufusvör komin. Læknir fær SMS eftir 5 mínútur." },
      ] : []),
      { key: "plan", title: "Klára aðgerðaáætlun", hint: "Viðtali lokið en áætlun ekki birt." },
      { key: "book", title: "Bóka viðtal", hint: "Skýrslan er tilbúin. Hafðu samband og finndu tíma." },
      { key: "interview", title: "Viðtöl framundan", hint: "Bókuð viðtöl." },
      { key: "bookfollow", title: "Bóka eftirfylgd", hint: "Ráðlögð eftir 3 mánuði." },
      { key: "followup", title: "Eftirfylgd framundan", hint: "Bókuð eftirfylgdarviðtöl." },
      { key: "tests", title: "Bíða rannsókna", hint: "Blóðprufa eða mælingar ekki komnar. Ekkert þarf að gera nema skrá ef það berst ekki sjálfkrafa." },
      { key: "activate", title: "Hafa ekki virkjað", hint: "Greitt, en virkjunarkóði ekki sleginn inn í sjúklingagátt." },
    ];
    const byKey = new Map<string, { row: Row; task: Task }[]>();
    for (const r of rows) {
      const t = nextTask(r, isDoctor);
      if (t.key === "none") continue;
      if (!byKey.has(t.key)) byKey.set(t.key, []);
      byKey.get(t.key)!.push({ row: r, task: t });
    }
    return order.map((g) => ({ ...g, items: byKey.get(g.key) ?? [] })).filter((g) => g.items.length);
  }, [rows, isDoctor]);

  const urgent = groups.filter((g) => ["review", "report", "plan", "book"].includes(g.key)).reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-[#0F2A23] to-[#065F46] p-6 text-white shadow-sm">
        <p className="text-sm text-emerald-200">{new Date().toLocaleDateString("is-IS", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="mt-1 text-2xl font-bold">{greet}, {me.name.split(" ")[0]}</h1>
        <p className="mt-1 text-emerald-100">
          {agenda.length ? `${agenda.length} ${agenda.length === 1 ? "tími" : "tímar"} í dag` : "Engir bókaðir tímar í dag"}
          {urgent ? ` · ${urgent} ${urgent === 1 ? "verkefni bíður" : "verkefni bíða"} þín` : ""}
        </p>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarDays className="h-5 w-5 text-emerald-600" /> Tímar í dag</h2>
        {agenda.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Ekkert bókað í dag.</p>
        ) : (
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {agenda.map((a, i) => (
              <li key={`${a.id}-${i}`}>
                <button type="button" onClick={() => onOpen(a.id, "overview")} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50">
                  <span className="w-14 text-lg font-bold tabular-nums text-slate-900">{time(a.at)}</span>
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
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardList className="h-5 w-5 text-emerald-600" /> Verkefni</h2>
        {groups.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Ekkert bíður. Vel gert.</p>}
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <div>
                  <h3 className="font-bold text-slate-900">{g.title} <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">{g.items.length}</span></h3>
                  <p className="text-xs text-slate-500">{g.hint}</p>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.items.map(({ row, task }) => (
                  <TaskRow key={row.id} row={row} task={task} onOpen={onOpen} onChanged={onChanged} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TestBadge() {
  return <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase text-amber-800">Prufa</span>;
}

function TaskRow({ row, task, onOpen }: { row: Row; task: Task; onOpen: (id: string, s?: Section, compose?: boolean) => void; onChanged: () => void }) {
  const late = task.key === "report" && minutesSince(row.blood_results_at) >= 5;
  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${late ? "bg-red-50/60" : ""}`}>
      <button type="button" onClick={() => onOpen(row.id, "overview")} className="min-w-0 flex-1 rounded-lg text-left hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <span className="block font-semibold text-slate-900">
          {cleanName(row.client_name)} {isTest(row.client_name) && <TestBadge />}
          {row.entry === "b2b" && <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-blue-700">Fyrirtæki</span>}
          {row.entry === "heilsugaesla" && <span className="ml-1 rounded bg-violet-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-violet-700">Tilvísun HG</span>}
        </span>
        <span className="block text-sm text-slate-500">
          {task.label}
          {task.key === "report" && ` · svör fyrir ${minutesSince(row.blood_results_at)} mín.${row.report_sms_sent_at ? " · SMS sent" : ""}`}
          {age(row.client_dob) ? ` · ${age(row.client_dob)}` : ""}
        </span>
      </button>
      {row.client_phone && (
        <a href={`tel:${row.client_phone}`} className={`${btnGhost} min-h-9`} aria-label={`Hringja í ${cleanName(row.client_name)}`}><Phone className="h-4 w-4" /><span className="hidden sm:inline">{row.client_phone}</span></a>
      )}
      <button type="button" onClick={() => onOpen(row.id, "overview", true)} className={`${btnSecondary} min-h-9`}><Bell className="h-4 w-4" /> Minna á</button>
      {task.key !== "activate" && task.key !== "tests" && (
        <button type="button" onClick={() => onOpen(row.id, task.section)} className={`${task.tone === "urgent" ? btnPrimary : btnSecondary} min-h-9`}>
          {task.cta} <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

// ── Skjólstæðingar ──────────────────────────────────────────────────────────

const STAGE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Allir" }, { key: "protocol", label: "Virkjun" }, { key: "tests", label: "Rannsóknir" }, { key: "report", label: "Skýrsla" },
  { key: "interview", label: "Viðtal" }, { key: "plan", label: "Áætlun" }, { key: "action", label: "Í aðgerð" },
];
const STAGE_TEXT: Record<string, string> = { protocol: "Virkjun", tests: "Rannsóknir", report: "Skýrsla", interview: "Viðtal", plan: "Áætlun", action: "Í aðgerð" };

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

function Clients({ rows, me, isDoctor, onOpen }: { rows: Row[]; me: Me; isDoctor: boolean; onOpen: (id: string, s?: Section, compose?: boolean) => void }) {
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
  r: Row; t: Task; f: RowFlags; expanded: boolean; onToggle: () => void; onOpen: (id: string, s?: Section, compose?: boolean) => void;
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
        <button type="button" onClick={() => onOpen(r.id, t.section)} className={`${btnPrimary} hidden min-h-9 px-3 text-xs sm:inline-flex`}>{t.cta}</button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpen(r.id, "overview")} className={`${btnDark} min-h-9 px-3 text-xs`}>Opna skjólstæðing</button>
            <button type="button" onClick={() => onOpen(r.id, "interview")} className={`${btnSecondary} min-h-9 px-3 text-xs`}><ClipboardList className="h-4 w-4" /> Viðtal</button>
            <button type="button" onClick={() => onOpen(r.id, "plan")} className={`${btnSecondary} min-h-9 px-3 text-xs`}><FileCheck2 className="h-4 w-4" /> Áætlun</button>
            <button type="button" onClick={() => onOpen(r.id, "overview", true)} className={`${btnSecondary} min-h-9 px-3 text-xs`}><Bell className="h-4 w-4" /> Skilaboð</button>
            {r.client_phone && <a href={`tel:${r.client_phone}`} className={`${btnSecondary} min-h-9 px-3 text-xs`}><Phone className="h-4 w-4" /> {r.client_phone}</a>}
            {planChip && <span className={`ml-auto self-center rounded-full px-2.5 py-1 text-xs font-semibold ${planChip.cls}`}>{planChip.text}</span>}
          </div>

          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {PROGRESS.map((p) => {
              const at = p.at(r as unknown as Journey);
              return (
                <li key={p.label} className={`rounded-xl px-2 py-1.5 text-center ${at ? "bg-emerald-50" : "bg-slate-50"}`}>
                  <span className={`block text-[11px] font-semibold ${at ? "text-emerald-800" : "text-slate-400"}`}>{p.label}</span>
                  <span className="block text-[10px] text-slate-400">{at ? day(at) : "—"}</span>
                </li>
              );
            })}
          </ol>

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

const PROGRESS: { label: string; at: (j: Journey) => string | null }[] = [
  { label: "Greitt", at: (j) => j.paid_at },
  { label: "Virkjað", at: (j) => j.protocol_activated_at },
  { label: "Blóðprufa", at: (j) => j.blood_test_done_at ?? j.blood_results_at },
  { label: "Mælingar", at: (j) => j.measurements_done_at },
  { label: "Skýrsla", at: (j) => j.report_generated_at },
  { label: "Viðtal", at: (j) => j.interview_done_at },
  { label: "Áætlun", at: (j) => j.plan_published_at },
  { label: "Eftirfylgd", at: (j) => j.followup_done_at },
];

function PatientView({ id, section, compose, me, onBack, onChanged, onSection }: {
  id: string; section: Section | null; compose: boolean; me: Me; onBack: () => void; onChanged: () => void; onSection: (s: Section) => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const isDoctor = me.role === "doctor" || me.role === "admin";

  const load = useCallback(async () => {
    const r = await ws(`/api/vinnustod/journeys/${id}`);
    if (!r.ok) { setErr(r.status === 404 ? "Skjólstæðingur fannst ekki eða er ekki á þínu svæði." : "Villa kom upp."); return; }
    setD(await r.json());
  }, [id]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const record = useCallback(async (payload: Record<string, unknown>): Promise<string | null> => {
    const r = await ws(`/api/vinnustod/journeys/${id}`, { method: "POST", body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.error || "Tókst ekki.";
    await load();
    onChanged();
    return null;
  }, [id, load, onChanged]);

  const backBtn = (
    <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100"><ArrowLeft className="h-4 w-4" /></span> Til baka
    </button>
  );
  if (err) return <div className="space-y-4">{backBtn}<p className="rounded-2xl bg-white p-6 text-slate-600">{err}</p></div>;
  if (!d) return <div className="space-y-4">{backBtn}<p className="p-6 text-slate-500">Hleð…</p></div>;

  const j = d.journey;
  const task = nextTask(j, isDoctor);
  const active: Section = section ?? "overview";
  const kt = d.patient.kennitala;
  const doneCount = PROGRESS.filter((p) => p.at(j)).length;

  return (
    <div className="space-y-5">
      {backBtn}

      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-800">
            {cleanName(d.patient.full_name).split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{cleanName(d.patient.full_name)} {isTest(d.patient.full_name) && <TestBadge />}</h1>
            <p className="text-sm text-slate-500">
              {[kt ? `${kt.slice(0, 6)}-${kt.slice(6)}` : null, age(d.patient.date_of_birth), d.location?.name].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {d.patient.phone && <a href={`tel:${d.patient.phone}`} className={`${btnSecondary} min-h-9`}><Phone className="h-4 w-4" /> {d.patient.phone}</a>}
              {d.patient.email && <a href={`mailto:${d.patient.email}`} className={`${btnSecondary} min-h-9`}><Mail className="h-4 w-4" /> Tölvupóstur</a>}
              <a href="https://provider.medalia.is" target="_blank" rel="noreferrer" className={`${btnSecondary} min-h-9`}><ExternalLink className="h-4 w-4" /> Opna í Medalia</a>
            </div>
          </div>
        </div>

        {/* Progress */}
        <ol className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8" aria-label={`${doneCount} af ${PROGRESS.length} skrefum lokið`}>
          {PROGRESS.map((p, i) => {
            const at = p.at(j);
            const current = !at && PROGRESS.slice(0, i).every((x) => x.at(j) || x.label === "Blóðprufa" || x.label === "Mælingar");
            return (
              <li key={p.label} className="text-center">
                <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${at ? "bg-emerald-500 text-white" : current ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>
                  {at ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`mt-1 block text-[11px] font-semibold ${at ? "text-emerald-800" : "text-slate-500"}`}>{p.label}</span>
                <span className="block text-[10px] text-slate-400">{at ? day(at) : ""}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* How the plan is going, once one is published */}
      {j.plan_published_at && <Adherence d={d} />}

      {/* Next task */}
      {task.key !== "none" && (
        <section className={`flex flex-wrap items-center gap-4 rounded-2xl p-4 ${task.tone === "urgent" ? "bg-emerald-600 text-white" : "border border-slate-200 bg-slate-50"}`}>
          <HeartPulse className={`h-6 w-6 ${task.tone === "urgent" ? "text-emerald-100" : "text-emerald-600"}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-bold uppercase tracking-wide ${task.tone === "urgent" ? "text-emerald-100" : "text-slate-500"}`}>Næsta verk</p>
            <p className="font-semibold">{task.label}</p>
          </div>
          {active !== task.section && (
            <button type="button" onClick={() => onSection(task.section)} className={task.tone === "urgent" ? `${btn} bg-white text-emerald-800 hover:bg-emerald-50` : btnPrimary}>
              {task.cta} <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </section>
      )}

      {/* Sections */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {([["overview", "Yfirlit"], ["interview", "Viðtal"], ["plan", "Áætlun"], ["history", "Saga"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={active === k} onClick={() => onSection(k)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${active === k ? "border-emerald-600 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {l}
          </button>
        ))}
      </div>

      {active === "overview" && <Overview d={d} isDoctor={isDoctor} record={record} compose={compose} reload={load} />}
      {active === "interview" && <Interview d={d} isDoctor={isDoctor} record={record} onPlan={() => onSection("plan")} />}
      {active === "plan" && (
        <PlanBuilder journeyId={id} api={ws} onPublished={() => { void load(); onChanged(); }}
          seed={seedFromNotes(j.interview_notes)} />
      )}
      {active === "history" && <History audit={d.audit} />}
    </div>
  );
}

/** What the client has actually been doing since the plan was published. */
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

function Overview({ d, isDoctor, record, compose, reload }: { d: Detail; isDoctor: boolean; record: (p: Record<string, unknown>) => Promise<string | null>; compose: boolean; reload: () => Promise<void> }) {
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
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ResultsCard api={ws} journeyId={j.id} sex={sexOf(d.patient.sex)} results={d.results ?? []} onSaved={() => void reload()} />
      </div>
      <Messages d={d} startOpen={compose} reload={reload} />
      <Card title="Rannsóknir" icon={<Droplet className="h-5 w-5" />}>
        <Milestone label="Blóðprufa (Heilsugæslan)" booked={j.blood_test_booked_for} done={j.blood_test_done_at ?? j.blood_results_at}
          action={!(j.blood_test_done_at || j.blood_results_at) ? { label: "Skrá blóðprufu tekna", run: () => run({ event: "blood_test_done" }, "Skráð.") } : undefined} busy={busy} />
        <Milestone label="Blóðprufusvör" done={j.blood_results_at}
          action={!j.blood_results_at ? { label: "Skrá svör komin", run: () => run({ event: "blood_results_ready" }, "Skráð. Læknir fær tilkynningu.") } : undefined} busy={busy} />
        <Milestone label="Mælingar (Vera)" booked={j.measurements_booked_for} done={j.measurements_done_at}
          action={!j.measurements_done_at ? { label: "Skrá mælingum lokið", run: () => run({ event: "measurements_done" }, "Skráð.") } : undefined} busy={busy} />
        <p className="mt-2 text-xs text-slate-500">Sjúklingagáttin skráir þetta sjálfkrafa þegar tenging er komin. Skráðu hér ef það berst ekki.</p>
      </Card>

      <Card title="Skýrsla læknis" icon={<FileCheck2 className="h-5 w-5" />}>
        {j.report_generated_at ? (
          <p className="text-sm text-slate-700">Staðfest {dayTime(j.report_generated_at)}.</p>
        ) : j.blood_results_at ? (
          isDoctor
            ? <button type="button" disabled={busy} onClick={() => run({ event: "report_generated" }, "Skýrsla staðfest. Skjólstæðingur fær tölvupóst.")} className={`${btnDark} w-full`}>
                <Stethoscope className="h-4 w-4" /> Staðfesta og búa til skýrslu
              </button>
            : <p className="text-sm text-amber-800">Svör komin fyrir {minutesSince(j.blood_results_at)} mín. Bíður læknis.</p>
        ) : <p className="text-sm text-slate-500">Bíður blóðprufusvara.</p>}
      </Card>

      <Card title="Viðtal og eftirfylgd" icon={<CalendarClock className="h-5 w-5" />}>
        <Booking label="Viðtal" at={j.interview_booked_for} done={j.interview_done_at} mode={j.interview_mode}
          disabled={!j.report_generated_at} disabledText="Hægt að bóka þegar skýrsla er staðfest."
          onBook={(at, mode) => run({ event: "interview_booked", at, mode }, "Viðtal bókað og sett í dagatal.")} busy={busy} />
        <div className="my-3 border-t border-slate-100" />
        <Booking label="Eftirfylgd eftir 3 mánuði" at={j.followup_booked_for} done={j.followup_done_at}
          disabled={!j.interview_done_at} disabledText="Hægt að bóka eftir fyrsta viðtal." suggest={90}
          onBook={(at) => run({ event: "followup_booked", at }, "Eftirfylgd bókuð og sett í dagatal.")} busy={busy} />
        {j.followup_booked_for && !j.followup_done_at && (
          <button type="button" disabled={busy} onClick={() => run({ event: "followup_done" }, "Eftirfylgd skráð.")} className={`${btnSecondary} mt-3 w-full`}>Merkja eftirfylgd lokið</button>
        )}
      </Card>

      <Card title="Mat læknis og tilvísun" icon={<Stethoscope className="h-5 w-5" />}>
        {j.doctor_review_requested_at && (
          <div className={`mb-3 rounded-xl p-3 text-sm ${j.doctor_reviewed_at ? "bg-slate-50 text-slate-600" : "bg-amber-50 text-amber-900"}`}>
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
          <div className="space-y-2">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={isDoctor ? "Ástæða tilvísunar (fer ekki til skjólstæðings)" : "Hvað á læknirinn að meta?"}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-2">
              {!isDoctor && <button type="button" disabled={busy || !note.trim()} onClick={() => run({ action: "request_doctor", note }, "Læknar hafa fengið beiðnina.").then(() => setNote(""))} className={btnSecondary}>Biðja lækni að meta</button>}
              {isDoctor && <button type="button" disabled={busy || !note.trim()} onClick={() => run({ event: "referral_heilsugaesla", note }, "Tilvísun skráð.").then(() => setNote(""))} className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}>Skrá tilvísun á Heilsugæsluna</button>}
            </div>
          </div>
        )}
      </Card>

      <Card title="Greiðslur og kóðar" icon={<ClipboardList className="h-5 w-5" />}>
        <ul className="space-y-1.5 text-sm">
          {d.orders.map((o) => (
            <li key={o.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span>{o.kind === "health_check" ? "Heilsufarsskoðun" : o.kind === "followup_3m" ? "Eftirfylgd" : o.kind === "reevaluation" ? "Endurmat" : "Aukaviðtal"} · {o.payment_route === "company" ? "fyrirtæki" : o.payment_route === "union" ? "stéttarfélag" : "sjálf(ur)"}</span>
              <span className="font-mono text-xs text-slate-500">{o.activation_code}{o.activation_redeemed_at ? " ✓" : ""}</span>
            </li>
          ))}
        </ul>
        {j.stage === "protocol" && (
          <button type="button" disabled={busy} onClick={() => run({ action: "remind_client" }, "Áminning send með virkjunarkóða.")} className={`${btnSecondary} mt-3`}><Bell className="h-4 w-4" /> Senda áminningu um virkjun</button>
        )}
      </Card>

      {msg && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800 lg:col-span-2">{msg}</p>}
    </div>
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
  const j = d.journey;
  const ref = useRef<HTMLDivElement>(null);
  const code = d.orders.find((o) => o.activation_code && (o.kind === "health_check" || o.kind === "reevaluation"))?.activation_code ?? null;
  const ctx = useMemo(() => ({
    firstName: cleanName(d.patient.full_name).split(" ")[0] || "",
    activationCode: code,
    bloodAt: j.blood_test_booked_for, measurementsAt: j.measurements_booked_for,
    interviewAt: j.interview_booked_for, interviewMode: j.interview_mode, followupAt: j.followup_booked_for,
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
    const r = await ws(`/api/vinnustod/journeys/${j.id}`, { method: "POST", body: JSON.stringify({ action: "message", channels, template: tpl, subject, body: text }) });
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

function Milestone({ label, booked, done, action, busy }: { label: string; booked?: string | null; done: string | null; action?: { label: string; run: () => void }; busy: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>{done ? <Check className="h-3.5 w-3.5" /> : null}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{done ? `Lokið ${dayTime(done)}` : booked ? `Bókað ${dayTime(booked)}` : "Ekki bókað"}</p>
      </div>
      {action && <button type="button" disabled={busy} onClick={action.run} className={`${btnSecondary} min-h-9`}>{action.label}</button>}
    </div>
  );
}

function Booking({ label, at, done, mode, disabled, disabledText, onBook, busy, suggest }: {
  label: string; at: string | null; done: string | null; mode?: string | null; disabled: boolean; disabledText: string;
  onBook: (at: string, mode: "in_person" | "video") => void; busy: boolean; suggest?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState(() => {
    if (at) return toLocalInput(new Date(at));
    const d = new Date(Date.now() + (suggest ?? 1) * 86400_000);
    d.setMinutes(0, 0, 0);
    return toLocalInput(d);
  });
  const [m, setM] = useState<"in_person" | "video">(mode === "video" ? "video" : "in_person");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold text-slate-800">{label}</span><br />
          <span className="text-slate-500">{done ? `Lokið ${dayTime(done)}` : at ? `${dayTime(at)}${mode === "video" ? " · myndsímtal" : ""}` : disabled ? disabledText : "Ekki bókað"}</span>
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
          <button type="button" disabled={busy || !when} onClick={() => { onBook(new Date(when).toISOString(), m); setEditing(false); }} className={`${btnPrimary} min-h-9`}>Vista tíma</button>
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

function Interview({ d, isDoctor, record, onPlan }: { d: Detail; isDoctor: boolean; record: (p: Record<string, unknown>) => Promise<string | null>; onPlan: () => void }) {
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
      const r = await ws(`/api/vinnustod/journeys/${j.id}`, { method: "PATCH", body: JSON.stringify({ interview_notes: next }) });
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
            <p className="mt-3 text-xs text-slate-500">Lífsstílsáætlunin heldur áfram þó vísað sé á Heilsugæsluna.</p>
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
                <button type="button" onClick={onPlan} className={btnPrimary}>{d.plan ? "Opna áætlun" : "Búa til áætlun"} <ChevronRight className="h-4 w-4" /></button>
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

