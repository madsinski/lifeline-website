"use client";

// The home side: Í dag, Skjólstæðingar, Dagatal.
//
// Í dag is one list. It used to be four sections that each looked like a
// queue — the journeys' own next steps, Beiðnir, the messages inbox, the
// week — and a coach had to read every heading to know which one was asking
// for her. Now everything that has a person waiting on it is a row in
// "Bíður þín", and every row has exactly one button that lands where the
// work is done (a tab or a sheet on the client), not on the client's front
// page with nowhere to act.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageSquare, UserPlus, Video, X } from "lucide-react";
import EmptyState from "@/app/components/hc/EmptyState";
import ClientsView from "@/app/components/hc/ClientsView";
import WeekAhead from "@/app/components/hc/WeekAhead";
import StationSlots from "@/app/components/hc/StationSlots";
import ReportIntake from "@/app/components/hc/ReportIntake";
import Sheet from "@/app/components/hc/Sheet";
import { RequestRow, waited } from "@/app/components/hc/WsRequests";
import { useWsApi } from "@/app/components/hc/ws-api";
import { useToast } from "@/app/components/hc/Toast";
import { Alert } from "@/app/components/account/ui";
import { cleanName, isTest, longDate, time, wsBtn } from "./format";
import type { Inbox } from "./inbox";
import { nextTask, rowFlags, taskTarget, TONE_DOT, type Me, type OpenClient, type Row, type RowFlags, type Task } from "./tasks";
import { Kicker, Shimmer, TestBadge } from "./ui";

// ── Í dag ───────────────────────────────────────────────────────────────────

export function TodayView({ rows, me, onOpen, inbox }: {
  rows: Row[]; me: Me; onOpen: OpenClient; inbox: Inbox;
}) {
  const api = useWsApi();
  const [adding, setAdding] = useState(false);
  const [greet] = useState(() => {
    const hour = new Date().getHours();
    return hour < 11 ? "Góðan daginn" : hour < 18 ? "Góðan dag" : "Gott kvöld";
  });
  const [today] = useState(() => longDate(new Date()));

  /* Items this actor has cleared. The list is derived from journey state,
     so there is nothing to delete — a dismissal is recorded separately and
     filtered here, keyed by task as well as journey, so clearing "book a
     follow-up" does not also hide "waiting for the report". */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissErr, setDismissErr] = useState("");
  const toast = useToast();
  const loadDismissed = useCallback(async () => {
    const r = await api("/api/vinnustod/queue-dismiss").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    const next = new Set<string>((j?.dismissed ?? []).map((d: { journeyId: string; taskKey: string }) => `${d.journeyId}:${d.taskKey}`));
    setTimeout(() => setDismissed(next), 0);
  }, [api]);
  useEffect(() => { void loadDismissed(); }, [loadDismissed]);

  const dismiss = useCallback(async (journeyId: string, taskKey: string, name: string) => {
    /* Optimistic: the row goes immediately and comes back if the write
       fails — and now says so, rather than reappearing unexplained. */
    setDismissErr("");
    setDismissed((d) => new Set(d).add(`${journeyId}:${taskKey}`));
    const r = await api("/api/vinnustod/queue-dismiss", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journeyId, taskKey }),
    }).catch(() => null);
    if (!r?.ok) {
      setDismissed((d) => { const n = new Set(d); n.delete(`${journeyId}:${taskKey}`); return n; });
      setDismissErr(`Ekki tókst að fjarlægja ${name} af listanum. Atriðið er komið aftur — reyndu aftur eftir smástund.`);
      return;
    }
    /* One tap took it off with no confirm, so the way back is right there
       (the route has always had an undo; nothing called it). */
    toast.show(`Fjarlægt af listanum: ${name}.`, {
      action: {
        label: "Afturkalla",
        onClick: () => {
          setDismissed((d) => { const n = new Set(d); n.delete(`${journeyId}:${taskKey}`); return n; });
          void api("/api/vinnustod/queue-dismiss", {
            method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ journeyId, taskKey }),
          }).then((u) => {
            if (!u.ok) throw new Error(String(u.status));
          }).catch(() => {
            setDismissed((d) => new Set(d).add(`${journeyId}:${taskKey}`));
            toast.show("Ekki tókst að afturkalla. Reyndu aftur.", { tone: "bad" });
          });
        },
      },
    });
  }, [api, toast]);

  const tasks = useMemo(
    () => rows.map((r) => { const t = nextTask(r); return { r, t, f: rowFlags(r, t) }; })
      .filter((x) => x.f.rank < 2 && !dismissed.has(`${x.r.id}:${x.t.key}`))
      .sort((a, b) => a.f.rank - b.f.rank || b.f.waitingDays - a.f.waitingDays),
    [rows, dismissed],
  );
  // People who wrote and have not had an answer. Oldest first: whoever has
  // waited longest is next.
  const chats = useMemo(
    () => (inbox.threads ?? []).filter((t) => t.unread > 0).sort((a, b) => a.lastAt.localeCompare(b.lastAt)),
    [inbox.threads],
  );
  const requests = (inbox.requests ?? []).filter((r) => r.status === "open");
  const count = tasks.length + chats.length + requests.length;
  const inboxLoading = inbox.threads === null && inbox.requests === null && !inbox.failed;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 pt-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-hc-ink-2">{today}</p>
          <h1 className="text-2xl font-bold text-hc-ink">{greet}, {me.name.split(" ")[0]}</h1>
        </div>
        <button type="button" onClick={() => setAdding(true)} className={wsBtn.primary}>
          <UserPlus className="h-4 w-4" aria-hidden /> Nýr skjólstæðingur
        </button>
      </div>

      <TodayAppointments onOpen={onOpen} />

      <section aria-labelledby="waiting-h" className="space-y-2">
        <div className="flex items-center gap-2">
          <Kicker id="waiting-h">Bíður þín</Kicker>
          {count > 0 && <span className="rounded-full bg-hc-brand-dark px-2 py-0.5 text-xs font-bold text-white">{count}</span>}
        </div>
        {dismissErr && <Alert tone="warn" compact onDismiss={() => setDismissErr("")}>{dismissErr}</Alert>}
        {inbox.failed && (
          <Alert tone="warn" compact actions={<button type="button" className={wsBtn.secondary} onClick={() => void inbox.reload()}>Reyna aftur</button>}>
            Náði ekki í skilaboð eða beiðnir, svo eitthvað sem skjólstæðingar hafa sent gæti vantað á listann.
          </Alert>
        )}
        {count === 0 && inboxLoading ? <Shimmer rows={2} label="Hleð listanum" /> : count === 0 ? (
          <EmptyState variant="done" quiet title="Ekkert bíður" body="Allt sem kallar á þig er afgreitt." />
        ) : (
          <ul className="divide-y divide-hc-hairline overflow-hidden rounded-2xl border border-hc-hairline bg-hc-surface">
            {/* People waiting on an answer first: a question that sat
                unanswered for a day is worse than a step that waited one. */}
            {requests.map((q) => (
              <RequestRow key={`q-${q.id}`} api={api} r={q} onDone={() => void inbox.reload()}
                onOpen={(id) => onOpen(id, { tab: "status", focus: "requests" })}
                onAction={(r, action) => onOpen(r.journey_id,
                  action === "referral" ? { sheet: "referral" }
                  : action === "plan" ? { tab: "plan" }
                  : { tab: "status", focus: "requests" })}
                dot={<Dot className="bg-hc-signal-red" />} />
            ))}
            {chats.map((t) => (
              <li key={`c-${t.journeyId}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Dot className="bg-hc-signal-red" />
                <button type="button" onClick={() => onOpen(t.journeyId)} className="min-w-0 flex-1 rounded-lg text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
                  <span className="block font-semibold text-hc-ink">{cleanName(t.name)}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-hc-ink-2">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{t.unread > 1 ? `${t.unread} ósvöruð skilaboð` : "Ósvöruð skilaboð"}{t.last ? `: „${t.last}“` : ""}</span>
                  </span>
                  <span className="text-xs text-hc-ink-2">beið í {waited(t.lastAt)}</span>
                </button>
                <Cta onClick={() => onOpen(t.journeyId, { tab: "status", focus: "chat" })}>Svara</Cta>
              </li>
            ))}
            {tasks.map(({ r, t, f }) => (
              <TaskRow key={`t-${r.id}`} r={r} t={t} f={f} onOpen={onOpen}
                onDismiss={() => void dismiss(r.id, t.key, cleanName(r.client_name))} />
            ))}
          </ul>
        )}
      </section>

      {adding && (
        <Sheet title="Nýr skjólstæðingur" onClose={() => setAdding(false)} max="max-w-lg">
          <div className="px-4 pb-6 sm:px-5">
            <ReportIntake api={api} narrow expanded inviteOnly onOpen={(journeyId) => { setAdding(false); onOpen(journeyId); }} />
          </div>
        </Sheet>
      )}
    </div>
  );
}

const Dot = ({ className }: { className: string }) => <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${className}`} aria-hidden />;

/** The row's one action. Outlined: the dot and the reason should catch the
 *  eye first; a column of solid slabs competed with them. */
function Cta({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-hc-brand/40 bg-hc-surface px-4 text-sm font-semibold text-hc-brand-text transition hover:bg-hc-brand-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
      {children}
    </button>
  );
}

/** One journey step waiting on the nurse: who, what, and where to do it. */
function TaskRow({ r, t, f, onOpen, onDismiss }: {
  r: Row; t: Task; f: RowFlags; onOpen: OpenClient; onDismiss: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Dot className={TONE_DOT[t.tone]} />
      <button type="button" onClick={() => onOpen(r.id)} className="min-w-0 flex-1 rounded-lg text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
        <span className="block font-semibold text-hc-ink">{cleanName(r.client_name)} {isTest(r.client_name) && <TestBadge />}</span>
        <span className="block text-sm text-hc-ink-2">
          <span>{t.label}</span>
          {f.waitingDays > 2 && <span> · {f.waitingDays} d.</span>}
        </span>
      </button>
      <Cta onClick={() => onOpen(r.id, taskTarget(t.key))}>{t.cta}</Cta>
      {/* Clear this one off the list: quiet and last, per coach, survives a
          reload, and comes back on its own when the journey moves on. */}
      <button type="button" onClick={onDismiss} aria-label={`Fjarlægja ${cleanName(r.client_name)} af listanum`}
        title="Fjarlægja af listanum"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-hc-ink-2 transition hover:bg-hc-bad-surface hover:text-hc-bad-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

// ── Today's appointments ────────────────────────────────────────────────────

interface Ev {
  source: "journey" | "booking"; journey_id: string; client: string | null;
  kind: string; title?: string | null; at: string; minutes: number; done: boolean; meeting_url: string | null;
}

const KIND_IS: Record<string, string> = {
  interview: "Áætlunarsamtal", followup: "Eftirfylgd", measure: "Mælingartími", video: "Myndsímtal", measurement: "Mæling",
  doctor: "Læknisviðtal",
};

/*
 * Today, from the diary endpoint rather than the queue rows, because the
 * diary also reads hc_bookings — the video calls and measurements a
 * participant booked through Þjálfari, which the journey columns never see.
 */
function TodayAppointments({ onOpen }: { onOpen: OpenClient }) {
  const api = useWsApi();
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    const r = await api(`/api/vinnustod/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}&scope=all`).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      if (!j) { setFailed(true); return; }
      setFailed(false);
      setEvents(((j.events ?? []) as Ev[]).filter((e) => new Date(e.at) < to));
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  if (failed) {
    return (
      <Alert tone="warn" compact actions={<button type="button" className={wsBtn.secondary} onClick={() => void load()}>Reyna aftur</button>}>
        Náði ekki í tíma dagsins.
      </Alert>
    );
  }
  if (events === null) return <div className="h-16 rounded-2xl hc-shimmer" aria-busy="true" aria-label="Hleð tímum dagsins" />;

  return (
    <section aria-labelledby="today-h" className="space-y-2">
      <Kicker id="today-h">Tímar í dag</Kicker>
      {events.length === 0 ? (
        <p className="rounded-2xl border border-hc-hairline bg-hc-surface px-4 py-3 text-sm text-hc-ink-2">Ekkert bókað í dag.</p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {events.map((e, i) => {
            const iv = e.source === "journey" && (e.kind === "interview" || e.kind === "followup");
            return (
              <li key={`${e.at}-${i}`} className={`flex w-60 shrink-0 flex-col gap-2 rounded-2xl border border-hc-hairline bg-hc-surface p-3 ${e.done ? "opacity-80" : ""}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums text-hc-ink">{time(e.at)}</span>
                  <span className="truncate text-xs font-semibold text-hc-ink-2">
                    {[e.title || KIND_IS[e.kind] || e.kind, `${e.minutes} mín.`, e.done ? "lokið" : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <p className="truncate font-semibold text-hc-ink">{cleanName(e.client)}</p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {e.journey_id && (
                    <button type="button" className={`${wsBtn.secondary} flex-1`}
                      onClick={() => onOpen(e.journey_id, iv ? { tab: "status", sheet: "interview" } : { tab: "status" })}>
                      {iv ? (e.kind === "followup" ? "Eftirfylgd" : "Áætlunarsamtal") : "Opna"} <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                  {e.meeting_url && !e.done && (
                    <a href={e.meeting_url} target="_blank" rel="noreferrer" aria-label={`Hefja myndsímtal við ${cleanName(e.client)}`} className={wsBtn.primary}>
                      <Video className="h-4 w-4" aria-hidden />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Skjólstæðingar ──────────────────────────────────────────────────────────

export function ClientsTab({ rows, onOpen, onReload }: { rows: Row[]; onOpen: OpenClient; onReload: () => void }) {
  const api = useWsApi();
  return (
    <section className="space-y-3" aria-label="Skjólstæðingar">
      <ClientsView api={api} rows={rows} onOpenClient={(id) => onOpen(id)} onReload={onReload} />
    </section>
  );
}

// ── Dagatal ─────────────────────────────────────────────────────────────────

export function CalendarTab({ onOpen }: { onOpen: OpenClient }) {
  const api = useWsApi();
  return (
    <div className="space-y-6">
      <WeekAhead api={api} onOpenClient={(id, kind) => onOpen(id, kind === "interview" || kind === "followup" ? { tab: "status", sheet: "interview" } : undefined)} />
      {/* Beside the week, because the week you are looking at is the week
          you open times for. The participant's "Pick a time" reads the same table. */}
      <StationSlots api={api} />
      {/* The doctor's day: times a participant who paid for a doctor
          interview or the health check books under Þjónusta. */}
      <StationSlots api={api} variant="doctor" />
    </div>
  );
}
