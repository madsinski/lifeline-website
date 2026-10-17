"use client";

// „Næsta skref · valfrjálst“ — one optional setup item at a time, on Í dag.
//
// The setup things (the reminder and the app on the home screen, the
// calendar, a partner, the coach) come one at a time, after the required
// part, in the order that matters most for coming back: the reminder first
// (it has the evidence behind it, see SetupFlow), then the calendar, the
// partner, and the coach.
//
// ── Only what asks something of the person ───────────────────────────
//
// A step is listed only when there is something for the person to do:
//   coach    only when there is a choice — never when one is assigned
//            already, never when there are no coaches to pick (that row used
//            to sit there for good, saying „Þú þarft ekki að gera neitt hér“)
//            and never on the app-alone track, which has nobody to assign
//   partner  not on the app-alone track
//   nudge    install is part of it; InstallGuide drops itself once the app
//            is on the home screen
//
// ── It ends ──────────────────────────────────────────────────────────
//
// When every step that applies is done, the card says „Allt klárt“ for a
// moment and is gone for good, recorded server-side (/api/hc/next-step) so
// it does not return on another device or when something is later undone.
// „Ekki núna“ puts the whole card away for seven days in this browser — a
// nudge, not a record. Everything is still in Stillingar, open and in place.

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { SETUP_ROWS, type SetupKey } from "./SetupFlow";
import { SetupStepBody, useSetupData } from "./SetupWalkthrough";
import CalendarConnect from "./CalendarConnect";
import { hcBtn, hcKicker } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const ORDER: SetupKey[] = ["nudge", "calendar", "partner", "coach"];
const SNOOZE_KEY = "hc-next-step-snoozed-at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const ALL_DONE_MS = 2600;

function snoozed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(SNOOZE_KEY) ?? "0");
    return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
  } catch { return false; }
}

const CARD = "rounded-hc-card bg-hc-brand-surface p-5 shadow-hc-card ring-1 ring-hc-border border-l-4 border-l-hc-brand-dark";

export default function NextStepCard({ api, entry }: {
  api: Api;
  /** The journey's track; the app-alone track has no coach and no partner step. */
  entry: string | null;
}) {
  const d = useSetupData(api);
  const [done, setDone] = useState<Record<SetupKey, boolean> | null>(null);
  /** null = not known yet; true = finished for good (server). */
  const [finished, setFinished] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  /** Whether anything was left to do when the card first loaded — only then is „Allt klárt“ news. */
  const hadWork = useRef<boolean | null>(null);
  const recheck = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [cal, partner, nudge] = await Promise.all([
      api("/api/hc/google").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/partner").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/nudges").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setTimeout(() => setDone({
      coach: !!d.myCoach,
      calendar: !!cal?.connected || d.calConnected,
      partner: !!partner?.partner?.id || !!partner?.partner?.name,
      nudge: (nudge?.prefs?.channels?.length ?? 0) > 0,
    }), 0);
  }, [api, d.myCoach, d.calConnected]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void (async () => {
      const r = await api("/api/hc/next-step").catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      /* A failed read is treated as not finished: the worst case is the card once more. */
      setTimeout(() => setFinished(!!j?.finished), 0);
    })();
    const t = setTimeout(() => setHidden(snoozed()), 0);
    return () => clearTimeout(t);
  }, [api]);

  /* Back from Google's consent screen or another tab: look again. */
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); if (recheck.current) clearTimeout(recheck.current); };
  }, [load]);

  const ready = done !== null && finished !== null && hidden !== null && d.coaches !== null;
  const steps = !ready ? [] : ORDER.filter((k) => {
    if (k === "coach") return entry !== "app" && !d.myCoach && (d.coaches?.length ?? 0) > 0;
    if (k === "partner") return entry !== "app";
    return true;
  });
  const doneCount = ready ? steps.filter((k) => done![k]).length : 0;
  const allDone = ready && doneCount === steps.length;

  /* Note whether there was work at first sight, and finish for good when there is none. */
  useEffect(() => {
    if (!ready || finished) return;
    if (hadWork.current === null) hadWork.current = !allDone;
    if (!allDone) return;
    void api("/api/hc/next-step", { method: "POST", body: "{}" }).catch(() => null);
    if (!hadWork.current) { setTimeout(() => setFinished(true), 0); return; }
    const show = setTimeout(() => setCelebrating(true), 0);
    const end = setTimeout(() => { setCelebrating(false); setFinished(true); }, ALL_DONE_MS);
    return () => { clearTimeout(show); clearTimeout(end); };
  }, [ready, allDone, finished, api]);

  if (!ready || finished) return null;

  if (celebrating) {
    return (
      <section className={CARD} role="status" aria-live="polite">
        <p className="flex items-center gap-2 text-base font-bold text-hc-ink">
          <CheckCircle2 className="h-5 w-5 text-hc-brand-text" aria-hidden /> Allt klárt
        </p>
        <p className="mt-1 text-sm text-hc-ink-2">Uppsetningin er búin. Þú getur breytt henni hvenær sem er í Stillingum.</p>
      </section>
    );
  }
  if (allDone || hidden) return null;

  const key = steps.find((k) => !done![k]);
  const row = SETUP_ROWS.find((r) => r.key === key);
  if (!key || !row) return null;

  const later = () => {
    setHidden(true);
    try { window.localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* private mode */ }
  };
  /* The step bodies save on their own and do not report back; a moment
     after the person touches one, read the state again. */
  const touched = () => {
    if (recheck.current) clearTimeout(recheck.current);
    recheck.current = setTimeout(() => void load(), 1500);
  };
  const position = doneCount + 1;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className={CARD} aria-labelledby="next-step-title">
      <div className="flex items-center justify-between gap-3">
        <p className={`${hcKicker} text-hc-brand-text`}>Næsta skref · valfrjálst</p>
        <p className="text-sm font-semibold tabular-nums text-hc-ink-2">{position} af {steps.length}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hc-surface" role="progressbar"
        aria-label="Uppsetning" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}
        aria-valuetext={`${doneCount} af ${steps.length} lokið`}>
        <div className="h-full rounded-full bg-hc-brand-dark transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <h2 id="next-step-title" className="mt-3 text-lg font-bold text-hc-ink">{row.title}</h2>
      <p className="mt-1 text-sm text-hc-ink-2">{row.why}</p>
      <div className="mt-4" onClickCapture={touched} onChangeCapture={touched}>
        <SetupStepBody rowKey={key} d={d} api={api} entry={entry} reload={load} />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={later} className={hcBtn.ghost}>Ekki núna</button>
      </div>
      <CalendarConnect api={d.calendarApi} open={d.calOpen}
        onClose={() => { d.setCalOpen(false); void d.load(); void load(); }}
        intro="Tímar hjá Lifeline birtast í dagatalinu þínu og myndsímtöl fá hlekk á fundinn." />
    </section>
  );
}
