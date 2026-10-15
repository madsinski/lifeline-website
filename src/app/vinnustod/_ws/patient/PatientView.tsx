"use client";

// One client's workspace: who they are, ONE "Næsta verk", and four tabs
// (Staða · Skýrsla · Aðgerðaáætlun · Forskoðun — Mads, 2026-10-12). The
// interview, referrals, outbound messages, payments and the audit trail open
// as sheets over it, so the four tabs stay four.
//
// Tab and sheet live in the URL (&tab=, &sheet=), so a queue row can land on
// the exact place the work is, and a reload or a shared link comes back to it.

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CreditCard, Droplet, ExternalLink, History as HistoryIcon, Mail, MessageSquare, Phone, Stethoscope, Video } from "lucide-react";
import PlanBuilder from "@/app/components/hc/PlanBuilder";
import CoachAsClient from "@/app/components/hc/CoachAsClient";
import CoachBookings from "@/app/components/hc/CoachBookings";
import PlanChanges from "@/app/components/hc/PlanChanges";
import ClientThread from "@/app/components/hc/ClientThread";
import EmptyState from "@/app/components/hc/EmptyState";
import { hcTabs } from "@/app/components/hc/ui";
import { useWsApi, WS_SESSION_EXPIRED } from "@/app/components/hc/ws-api";
import { Alert } from "@/app/components/account/ui";
import { upcomingAppointments } from "@/lib/hc/upcoming";
import { age, cleanName, day, dayTime, isTest, wsBtn } from "../format";
import { nextTask, taskTarget, type Detail, type Me, type PatientNav, type WsTab } from "../tasks";
import { Shimmer, TestBadge } from "../ui";
import { badgeClass } from "@/app/components/hc/Badge";
import { NotesPeek } from "./Interview";
import { PatientSheet } from "./Sheets";
import { ClientRequests, type BookStart } from "./Requests";
import type { WsRequest } from "@/app/components/hc/WsRequests";
import type { RequestAction } from "@/lib/hc/requests";
import { Adherence, ResultsStep, resultsStatus, seedFromNotes } from "./steps";

/* The journey route answers some failures in Icelandic and some with a bare
   code ("bad_event", "update_failed"). A code is not a sentence a nurse can
   act on, so those get one. */
const CODE_IS: Record<string, string> = {
  unauthorized: "Lotan rann út. Skráðu þig inn aftur.",
  forbidden: "Þú hefur ekki aðgang að þessu.",
  not_found: "Skjólstæðingur fannst ekki.",
  bad_event: "Þessi skráning er ekki í boði. Endurhlaðið síðuna.",
  bad_date: "Dagsetningin er ógild.",
  update_failed: "Ekki tókst að vista. Reyndu aftur.",
  unknown_action: "Þessi aðgerð er ekki í boði. Endurhlaðið síðuna.",
};
function errorIs(status: number, e: unknown): string {
  if (typeof e === "string" && CODE_IS[e]) return CODE_IS[e];
  if (typeof e === "string" && /[áéíóúýþæöð]/i.test(e)) return e;
  return status >= 500 ? "Villa hjá okkur. Reyndu aftur eftir smástund." : "Ekki tókst að vista. Reyndu aftur.";
}

const TABS: { key: WsTab; label: string }[] = [
  { key: "status", label: "Staða" },
  { key: "report", label: "Skýrsla" },
  { key: "plan", label: "Aðgerðaáætlun" },
  { key: "preview", label: "Forskoðun" },
];

export function PatientView({ id, nav, onNav, me, onBack, onChanged, onRead }: {
  id: string;
  nav: PatientNav;
  /** Move tab / open or close a sheet; the shell keeps the URL in step. */
  onNav: (patch: PatientNav) => void;
  me: Me; onBack: () => void; onChanged: () => void;
  /** Clears the home tab's unread badge once the thread has been read. */
  onRead?: () => void;
}) {
  const api = useWsApi();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<{ text: string; retry: boolean } | null>(null);
  const isDoctor = me.role === "doctor" || me.role === "admin";
  /*
   * Staða unless the link says otherwise. Opening a client from the roster
   * puts the same screen in front of you every time, so you learn where
   * things are; the queue's deep links are what take you elsewhere.
   */
  const tab: WsTab = nav.tab ?? "status";

  const load = useCallback(async () => {
    const r = await api(`/api/vinnustod/journeys/${id}`).catch(() => null);
    if (!r || !r.ok) {
      if (r?.status === 401) window.dispatchEvent(new Event(WS_SESSION_EXPIRED));
      const text = r?.status === 404 ? "Skjólstæðingur fannst ekki eða er ekki á þínu svæði." : "Náði ekki í gögn skjólstæðingsins.";
      setTimeout(() => setErr({ text, retry: r?.status !== 404 }), 0);
      return;
    }
    const j = await r.json().catch(() => null);
    if (!j) { setTimeout(() => setErr({ text: "Náði ekki í gögn skjólstæðingsins.", retry: true }), 0); return; }
    setTimeout(() => { setErr(null); setD(j); }, 0);
  }, [api, id]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  // Both reloads, always: this client's detail AND the home queue, so the
  // row they came from has moved on by the time they go back.
  const record = useCallback(async (payload: Record<string, unknown>): Promise<string | null> => {
    const r = await api(`/api/vinnustod/journeys/${id}`, { method: "POST", body: JSON.stringify(payload) }).catch(() => null);
    if (!r) return "Engin tenging. Reyndu aftur.";
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return errorIs(r.status, j.error);
    await load();
    onChanged();
    return null;
  }, [api, id, load, onChanged]);

  /*
   * "Svara" on an unanswered message lands here with focus=chat: bring the
   * thread into view and put the cursor in it. Once, then forget it, so
   * a reload does not keep yanking the page down.
   */
  /*
   * A request's ready-made pathway. "Bóka mælingu/viðtal" opens the booking
   * form here, pre-filled; the booking it produces writes the reply on that
   * request ("Tíminn er bókaður …") for the coach to read and send. Referral
   * and plan changes open where that work is done; the request stays at the
   * top of Staða until it is answered.
   */
  const [bookStart, setBookStart] = useState<BookStart | null>(null);
  const [pendingReq, setPendingReq] = useState<string | null>(null);
  const [reqPrefill, setReqPrefill] = useState<{ id: string; text: string; key: number } | null>(null);
  const onRequestAction = useCallback((r: WsRequest, action: RequestAction) => {
    if (action === "referral") { onNav({ sheet: "referral" }); return; }
    if (action === "plan") { onNav({ tab: "plan" }); return; }
    const items = Array.isArray(r.detail?.measurements) ? (r.detail.measurements as string[]) : [];
    setPendingReq(r.id);
    setBookStart({ kind: action === "book-video" ? "video" : "measurement", items, key: Date.now() });
    setTimeout(() => document.getElementById("ws-bookings")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [onNav]);
  const onBooked = useCallback((b: { label: string; starts_at: string }) => {
    if (!pendingReq) return;
    setReqPrefill({
      id: pendingReq,
      text: `Tíminn er bókaður: ${b.label}, ${dayTime(b.starts_at)}. Þú sérð hann í heilsuferðinni og færð áminningu.`,
      key: Date.now(),
    });
    setPendingReq(null);
    setTimeout(() => document.getElementById("ws-requests")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [pendingReq]);

  /* "Svara"/the name on a request in Í dag lands here with focus=requests. */
  const focusReq = nav.focus === "requests" && !!d;
  useEffect(() => {
    if (!focusReq) return;
    const t = setTimeout(() => {
      document.getElementById("ws-requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
      onNav({ focus: null });
    }, 300);
    return () => clearTimeout(t);
  }, [focusReq, onNav]);

  const focusChat = nav.focus === "chat" && !!d;
  useEffect(() => {
    if (!focusChat) return;
    const t = setTimeout(() => {
      const el = document.getElementById("ws-thread");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
      onNav({ focus: null });
    }, 150);
    return () => clearTimeout(t);
  }, [focusChat, onNav]);

  const backBtn = (
    <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hc-hairline bg-hc-surface py-1.5 pl-1.5 pr-4 text-sm font-semibold text-hc-ink-2 shadow-sm hover:bg-hc-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hc-sunken-2"><ArrowLeft className="h-4 w-4" aria-hidden /></span> Til baka
    </button>
  );
  if (err && !d) {
    return (
      <div className="space-y-4">
        {backBtn}
        <Alert tone={err.retry ? "bad" : "warn"} title={err.text}
          actions={err.retry ? <button type="button" className={wsBtn.secondary} onClick={() => { setErr(null); void load(); }}>Reyna aftur</button> : undefined} />
      </div>
    );
  }
  if (!d) return <div className="space-y-4">{backBtn}<Shimmer rows={4} label="Hleð skjólstæðingi" /></div>;

  const j = d.journey;
  const kt = d.patient.kennitala;
  const openRefs = (d.referrals ?? []).filter((r) => r.status === "requested").length;
  const task = nextTask({ ...j, open_referrals: openRefs }, isDoctor);
  const target = taskTarget(task.key);
  const showTask = task.key !== "none" && task.key !== "done";
  const go = (t: PatientNav) => onNav({ tab: t.tab ?? tab, sheet: t.sheet ?? null });

  // The next video appointment, so the call is one click from the top.
  const call = upcomingAppointments(j, null).find((x) => x.video) ?? null;
  const paid = d.orders.some((o) => o.paid_at);
  const code = d.orders.find((o) => o.activation_code);
  const ivLabel = j.interview_done_at ? "Eftirfylgd" : "Viðtal";

  // The three tests a nurse chases separately: drawn, answered, measured.
  const tests = [
    { label: "Blóðprufa", done: !!(j.blood_test_done_at || j.blood_results_at),
      detail: j.blood_results_at ? day(j.blood_results_at) : j.blood_test_booked_for ? day(j.blood_test_booked_for) : "ekki bókuð" },
    { label: "Svör", done: !!j.blood_results_at, detail: j.blood_results_at ? day(j.blood_results_at) : "bíður" },
    { label: "Mælingar", done: !!j.measurements_done_at,
      detail: j.measurements_done_at ? day(j.measurements_done_at) : j.measurements_booked_for ? day(j.measurements_booked_for) : "ekki bókaðar" },
  ];

  return (
    <div className="space-y-4">
      {backBtn}

      {/* Who this is, how to reach them, and the one thing to do next. */}
      <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-hc-ok-surface font-bold text-hc-ok-ink" aria-hidden>
            {cleanName(d.patient.full_name).split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-hc-ink">{cleanName(d.patient.full_name)}</h1>
            <p className="truncate text-sm text-hc-ink-2">
              {[kt ? `${kt.slice(0, 6)}-${kt.slice(6)}` : null, age(d.patient.date_of_birth), d.location?.name].filter(Boolean).join(" · ")}
              {isTest(d.patient.full_name) && <> <TestBadge /></>}
            </p>
            {d.coaching && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-hc-ink-2">
                <span className={badgeClass("brand", "sm")}>Þjálfun</span>
                <span>
                  {d.coaching.video_left > 0 ? `Myndsamtal mánaðarins ónotað` : "Myndsamtal mánaðarins notað"}
                  {" · "}
                  {d.coaching.measurement_next_at ? `næsta mæling frá ${day(d.coaching.measurement_next_at)}` : "mæling í boði"}
                  {d.coaching.ends_at ? ` · sagt upp, gildir til ${day(d.coaching.ends_at)}` : ""}
                </span>
              </p>
            )}
          </div>
          {/* Næsta verk: the same rule as the Í dag queue, and the same
              destination, so the header and the queue never disagree about
              what this client needs. */}
          {showTask && (
            <div className="w-full sm:w-auto sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-hc-ink-2">Næsta verk</p>
              <p className="text-sm text-hc-ink">{task.label}</p>
              <button type="button" onClick={() => go(target)} className={`${wsBtn.primary} mt-1.5 w-full sm:w-auto`}>
                {task.cta} <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-hc-ink-2">
          {d.patient.phone && (
            <a href={`tel:${d.patient.phone}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 hover:bg-hc-sunken-2">
              <Phone className="h-4 w-4 text-hc-ink-2" aria-hidden /> {d.patient.phone}
            </a>
          )}
          {d.patient.email && (
            <a href={`mailto:${d.patient.email}`} className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg px-2 hover:bg-hc-sunken-2">
              <Mail className="h-4 w-4 shrink-0 text-hc-ink-2" aria-hidden /> <span className="truncate">{d.patient.email}</span>
            </a>
          )}
          {/* Payment and the activation code are facts about this person. */}
          <button type="button" onClick={() => onNav({ sheet: "orders" })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 hover:bg-hc-sunken-2">
            <CreditCard className="h-4 w-4 shrink-0 text-hc-ink-2" aria-hidden />
            <span className={paid ? "text-hc-ok-ink" : "font-semibold text-hc-warn-ink"}>{paid ? "Greitt" : "Ógreitt"}</span>
            {code && <span className="text-hc-ink-2">· kóði {code.activation_redeemed_at ? "virkjaður" : code.activation_code}</span>}
          </button>
          <span className="flex-1" />
          {/* The interview and referrals are always one click away, not only
              when Næsta verk happens to point at them. */}
          {target.sheet !== "interview" && (
            <button type="button" onClick={() => onNav({ sheet: "interview" })} className={wsBtn.ghost}>
              <MessageSquare className="h-4 w-4" aria-hidden /> {ivLabel}
            </button>
          )}
          {target.sheet !== "referral" && (
            <button type="button" onClick={() => onNav({ sheet: "referral" })} className={wsBtn.ghost}>
              <Stethoscope className="h-4 w-4" aria-hidden /> Tilvísanir{openRefs ? ` (${openRefs})` : ""}
            </button>
          )}
          <a href="https://provider.medalia.is" target="_blank" rel="noopener noreferrer" className={wsBtn.secondary}>
            <ExternalLink className="h-4 w-4" aria-hidden /> Medalia
          </a>
        </div>
        {call && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-hc-ok-surface px-3 py-2 text-sm ring-1 ring-hc-ok-ink/20">
            <Video className="h-4 w-4 text-hc-ok-ink" aria-hidden />
            <span className="text-hc-ok-ink">{call.kind === "followup" ? "Eftirfylgd" : "Viðtal"} í myndsímtali {dayTime(call.at)}</span>
            {call.link
              ? <a href={call.link} target="_blank" rel="noopener noreferrer" className={`${wsBtn.primary} ml-auto`}><Video className="h-4 w-4" aria-hidden /> Hefja myndsímtal</a>
              : <span className="ml-auto text-xs text-hc-warn-ink">Hlekkur ekki kominn. Tengdu Google-dagatal eða límdu hlekk í bókunina.</span>}
          </div>
        )}
      </section>

      {/* The four places a coach goes. */}
      <nav className={hcTabs.bar} aria-label="Vinnusvæði skjólstæðings">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => onNav({ tab: t.key })}
            aria-current={tab === t.key ? "page" : undefined}
            className={`min-h-11 ${hcTabs.tab(tab === t.key)}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "status" && (
        /* The conversation owns a column; everything else stacks beside it,
           sized to its own content. */
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="min-w-0 space-y-4">
            <ClientRequests journeyId={j.id} onAction={onRequestAction} prefill={reqPrefill} onChanged={onChanged} />
            {tests.every((c) => c.done) ? (
              <section className="flex items-center gap-2 rounded-2xl border border-hc-hairline bg-hc-surface px-4 py-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-hc-brand-dark text-white">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                <span className="text-sm font-semibold text-hc-ink">Heilsufarsskoðun búin</span>
                <span className="text-sm text-hc-ink-2">{tests[2].detail}</span>
              </section>
            ) : (
              <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Heilsufarsskoðun</h2>
                <ul>
                  {tests.map((c) => (
                    <li key={c.label}>
                      <button type="button" onClick={() => onNav({ tab: "report" })}
                        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left transition hover:bg-hc-sunken">
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${
                          c.done ? "border-transparent bg-hc-brand-dark text-white" : "border-hc-control text-transparent"}`}>
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                        </span>
                        <span className={`min-w-0 flex-1 text-sm font-semibold ${c.done ? "text-hc-ink-2" : "text-hc-ink"}`}>
                          {c.label}<span className="sr-only">{c.done ? " — lokið" : " — ólokið"}</span>
                        </span>
                        {c.detail && <span className="shrink-0 text-xs text-hc-ink-2">{c.detail}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {j.plan_published_at && <Adherence d={d} />}
            <div id="ws-bookings" className="scroll-mt-24">
              <CoachBookings api={api} journeyId={j.id} start={bookStart} onBooked={onBooked} />
            </div>
            {/* What has moved in the plan since last time: the question
                before an encounter, not while editing. */}
            {j.plan_published_at && <PlanChanges api={api} journeyId={j.id} />}
          </div>

          <section id="ws-thread" className="flex min-h-0 scroll-mt-4 flex-col rounded-2xl border border-hc-hairline bg-hc-surface p-4 shadow-hc-card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 flex-1 font-bold text-hc-ink">Samtal við skjólstæðing</h2>
              {/* The thread is the app; this reaches someone who has not
                  opened it, by SMS or email. */}
              <button type="button" onClick={() => onNav({ sheet: "messages" })} className={wsBtn.secondary}>
                <Mail className="h-4 w-4" aria-hidden /> Senda SMS/tölvupóst
              </button>
            </div>
            <ClientThread api={api} journeyId={j.id} onRead={onRead} />
          </section>
        </div>
      )}

      {tab === "report" && (
        <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 shadow-hc-card sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hc-brand-dark text-white"><Droplet className="h-4 w-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-hc-ink">Skýrslan</h2>
              <p className="text-xs text-hc-ink-2">{resultsStatus(d)}</p>
            </div>
            <button type="button" onClick={() => onNav({ sheet: "referral" })} className={wsBtn.secondary}>
              <Stethoscope className="h-4 w-4" aria-hidden /> Læknir og tilvísanir{openRefs ? ` (${openRefs})` : ""}
            </button>
          </div>
          <ResultsStep d={d} api={api} isDoctor={isDoctor} record={record} reload={load} />
        </section>
      )}

      {tab === "plan" && (
        <div className="space-y-4">
          {/* The builder, bare and first: its own five steps are this tab's
              navigation. The notes it is written from sit under it. */}
          <PlanBuilder journeyId={j.id} api={api} readyProposal={d.ai_proposal}
            onPublished={() => { void load(); onChanged(); }} seed={seedFromNotes(j.interview_notes)} />
          <NotesPeek j={j} onOpenInterview={() => onNav({ sheet: "interview" })} />
        </div>
      )}

      {tab === "preview" && (
        j.plan_published_at
          ? <CoachAsClient api={api} journeyId={j.id} only="today" />
          : <EmptyState title="Áætlun hefur ekki verið birt"
              body="Hér sérðu daginn eins og skjólstæðingurinn sér hann, um leið og áætlunin er birt."
              action={{ label: "Opna Aðgerðaáætlun", onClick: () => onNav({ tab: "plan" }) }} />
      )}

      {/* Out of the way, but one click from anywhere. */}
      <div className="flex flex-wrap gap-2 px-1 pt-1">
        <button type="button" onClick={() => onNav({ sheet: "history" })} className={`${wsBtn.ghost} text-xs`}>
          <HistoryIcon className="h-4 w-4" aria-hidden /> Saga ({d.audit.length})
        </button>
      </div>

      <PatientSheet sheet={nav.sheet} d={d} api={api} isDoctor={isDoctor} record={record} reload={load}
        onClose={() => onNav({ sheet: null })}
        onPlan={() => onNav({ tab: "plan", sheet: null })} />
    </div>
  );
}
