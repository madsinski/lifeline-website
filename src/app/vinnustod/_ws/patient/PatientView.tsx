"use client";

// One client's workspace: who they are, ONE "Næsta verk", and four tabs
// (Staða · Skýrsla · Aðgerðaáætlun · Forskoðun — Mads, 2026-10-12). The
// Áætlunarsamtal, Vera partners, outbound messages, payments and the audit
// trail open as sheets over it, so the four tabs stay four.
//
// Tab and sheet live in the URL (&tab=, &sheet=), so a queue row can land on
// the exact place the work is, and a reload or a shared link comes back to it.

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CreditCard, ExternalLink, FileText, History as HistoryIcon, Loader2, Mail, MessageSquare, Phone, Users, Video } from "lucide-react";
import PlanBuilder from "@/app/components/hc/PlanBuilder";
import CoachAsClient from "@/app/components/hc/CoachAsClient";
import CoachBookings from "@/app/components/hc/CoachBookings";
import PlanChanges from "@/app/components/hc/PlanChanges";
import ClientThread from "@/app/components/hc/ClientThread";
import EmptyState from "@/app/components/hc/EmptyState";
import ActivityLog from "@/app/components/hc/ActivityLog";
import { hcTabs } from "@/app/components/hc/ui";
import { useWsApi, WS_SESSION_EXPIRED } from "@/app/components/hc/ws-api";
import { useToast } from "@/app/components/hc/Toast";
import { Alert } from "@/app/components/account/ui";
import { upcomingAppointments } from "@/lib/hc/upcoming";
import { age, cleanName, day, dayTime, isTest, wsBtn } from "../format";
import { nextTask, reportOnFile, taskTarget, type Detail, type Me, type PatientNav, type Record_, type WsTab } from "../tasks";
import { Shimmer, TestBadge } from "../ui";
import { badgeClass } from "@/app/components/hc/Badge";
import { NotesPeek } from "./Interview";
import { PatientSheet } from "./Sheets";
import type { MessagePreset } from "./Messages";
import { ClientRequests, type BookStart } from "./Requests";
import type { WsRequest } from "@/app/components/hc/WsRequests";
import type { RequestAction } from "@/lib/hc/requests";
import { Adherence, ResultsStep, resultsStatus, seedFromNotes } from "./steps";
import { isPartner } from "@/lib/hc/referrals";

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
  const toast = useToast();
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
  /* "Biðja um leyfi" opens the message sheet on that template. Cleared when
     the sheet closes, so the next "Senda SMS" opens on the default again. */
  const [msgPreset, setMsgPreset] = useState<MessagePreset | null>(null);
  const [taskErr, setTaskErr] = useState("");
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
  // Vera partner emails that did not go out: the only referral work left
  // here since the doctor's part moved to Medalia.
  const partnerFailed = (d.referrals ?? []).filter((r) => isPartner(r.target) && r.status === "failed").length;
  const task = nextTask({ ...j, partner_failed: partnerFailed });
  const target = taskTarget(task.key);
  const showTask = task.key !== "none" && task.key !== "done";
  const go = (t: PatientNav) => onNav({ tab: t.tab ?? tab, sheet: t.sheet ?? null });
  /* Most tasks are done where they land. Two are done by the button itself:
     the doctor interview is ticked (it happened in Medalia), and asking for
     leave to fetch the report opens the message sheet on that template. */
  const runTask = () => {
    if (task.key === "doctor") { void record({ event: "doctor_interview_done" }).then((e) => { if (e) setTaskErr(e); }); return; }
    if (task.key === "consent") { void askConsent(); return; }
    go(target);
  };

  // The next video appointment, so the call is one click from the top.
  const call = upcomingAppointments(j, null).find((x) => x.video) ?? null;
  const paid = d.orders.some((o) => o.paid_at);
  const code = d.orders.find((o) => o.activation_code);
  const ivLabel = j.interview_done_at ? "Eftirfylgd" : "Áætlunarsamtal";
  /* Ask for leave to put the report in: the client gets it in the app (red
     dot), as a push and by SMS, as their "Tilkynningar frá Lifeline" allow.
     The message sheet's template stays for anything more personal. */
  const askConsent = async () => {
    const r = await api(`/api/vinnustod/journeys/${id}`, { method: "POST", body: JSON.stringify({ action: "request_staff_import_consent" }) }).catch(() => null);
    const jj = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { toast.show(typeof jj.error === "string" ? jj.error : "Tókst ekki að senda beiðnina.", { tone: "bad" }); return; }
    const via = ["í appinu", jj.pushed ? "ýtitilkynning" : null, jj.texted ? "SMS" : null, jj.emailed ? "tölvupóstur" : null].filter(Boolean).join(", ");
    toast.show(`Beiðni send: ${via}.`, { tone: "ok" });
    await load(); onChanged();
  };

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
              <button type="button" onClick={runTask} className={`${wsBtn.primary} mt-1.5 w-full sm:w-auto`}>
                {task.cta} {task.key === "doctor" ? <Check className="h-4 w-4" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
              </button>
              {taskErr && <p role="alert" className="mt-1 text-sm font-semibold text-hc-bad-ink">{taskErr}</p>}
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
              <Users className="h-4 w-4" aria-hidden /> Samstarfsaðilar (Vera){partnerFailed ? ` (${partnerFailed})` : ""}
            </button>
          )}
          {/* Medalia holds the record: the report, the results of the
              health check and the doctor interview. */}
          <a href={MEDALIA_URL} target="_blank" rel="noopener noreferrer" className={wsBtn.secondary}>
            <ExternalLink className="h-4 w-4" aria-hidden /> Opna í sjúklingagátt (Medalia)
          </a>
        </div>
        {call && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-hc-ok-surface px-3 py-2 text-sm ring-1 ring-hc-ok-ink/20">
            <Video className="h-4 w-4 text-hc-ok-ink" aria-hidden />
            <span className="text-hc-ok-ink">{call.kind === "followup" ? "Eftirfylgd" : "Áætlunarsamtal"} í myndsímtali {dayTime(call.at)}</span>
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
            <Progress d={d} record={record} />
            {j.plan_published_at && <Adherence d={d} />}
            {/* What they actually did, substitutions included. */}
            <ActivityLog api={api} path={`/api/vinnustod/journeys/${j.id}/activity?days=14`} audience="staff" />
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hc-brand-dark text-white"><FileText className="h-4 w-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-hc-ink">Skýrslan</h2>
              <p className="text-xs text-hc-ink-2">{resultsStatus(d)}</p>
            </div>
          </div>
          <ResultsStep d={d} api={api} reload={load} onAskConsent={() => void askConsent()} />
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
        messagePreset={msgPreset}
        onClose={() => { setMsgPreset(null); onNav({ sheet: null }); }}
        onPlan={() => onNav({ tab: "plan", sheet: null })} />
    </div>
  );
}

const MEDALIA_URL = "https://provider.medalia.is";

/*
 * Where this person is, as plain lines (Mads, 2026-10-16).
 *
 * Blóðprufa / Svör / Mælingar used to be a checklist the nurse chased and
 * ticked. Since the split those belong to Medalia — the blood order, the
 * measurement results and the doctor interview are recorded there — so
 * this only reads them back. The one thing ticked here is the doctor
 * interview, because nothing tells Lifeline it has happened and the
 * Áætlunarsamtal is booked after it.
 */
function Progress({ d, record }: { d: Detail; record: Record_ }) {
  const j = d.journey;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const report = reportOnFile(j);
  const lines: { label: string; done: boolean; detail: string; action?: React.ReactNode }[] = [
    { label: "Virkjað", done: !!j.protocol_activated_at, detail: j.protocol_activated_at ? day(j.protocol_activated_at) : "ekki enn" },
    {
      label: "Mælingartími", done: !!(j.measurements_done_at || j.measurements_booked_for),
      detail: j.measurements_done_at ? `mælt ${day(j.measurements_done_at)}` : j.measurements_booked_for ? dayTime(j.measurements_booked_for) : "ekki bókaður",
    },
    {
      label: "Skýrsla á skrá", done: report,
      detail: j.own_report_at ? `frá skjólstæðingi ${day(j.own_report_at)}` : j.report_imported_at ? `sótt ${day(j.report_imported_at)}` : j.report_generated_at ? day(j.report_generated_at) : "ekki komin",
    },
    {
      label: "Læknisviðtal (Medalia)", done: !!j.doctor_interview_done_at,
      detail: j.doctor_interview_done_at ? day(j.doctor_interview_done_at) : "ekki merkt",
      action: !j.doctor_interview_done_at ? (
        <button type="button" disabled={busy} className={wsBtn.secondary}
          onClick={async () => {
            setBusy(true); setErr("");
            const e = await record({ event: "doctor_interview_done" });
            setBusy(false);
            if (e) setErr(e);
          }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Merkja lokið
        </button>
      ) : undefined,
    },
    {
      label: "Áætlunarsamtal", done: !!j.interview_done_at,
      detail: j.interview_done_at ? day(j.interview_done_at) : j.interview_booked_for ? dayTime(j.interview_booked_for) : "ekki bókað",
    },
    { label: "Áætlun", done: !!j.plan_published_at, detail: j.plan_published_at ? `birt ${day(j.plan_published_at)}` : d.plan ? "drög" : "ekki hafin" },
  ];
  return (
    <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Staða heilsufarsskoðunar</h2>
        <a href={MEDALIA_URL} target="_blank" rel="noopener noreferrer" className={wsBtn.ghost}>
          <ExternalLink className="h-4 w-4" aria-hidden /> Opna í sjúklingagátt (Medalia)
        </a>
      </div>
      <ul>
        {lines.map((c) => (
          <li key={c.label} className="flex min-h-11 flex-wrap items-center gap-3 px-1">
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${
              c.done ? "border-transparent bg-hc-brand-dark text-white" : "border-hc-control text-transparent"}`}>
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
            </span>
            <span className={`min-w-0 flex-1 text-sm font-semibold ${c.done ? "text-hc-ink-2" : "text-hc-ink"}`}>
              {c.label}<span className="sr-only">{c.done ? " — lokið" : " — ólokið"}</span>
            </span>
            <span className="shrink-0 text-xs text-hc-ink-2">{c.detail}</span>
            {c.action}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-1 text-sm font-semibold text-hc-bad-ink">{err}</p>}
      <p className="mt-2 text-xs text-hc-ink-2">Blóðprufa, niðurstöður mælinga og læknisviðtal eru skráð í Medalia.</p>
    </section>
  );
}
