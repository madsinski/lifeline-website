"use client";

// Þjálfari — every level of the app's HealthCoach screen.
//
// Three outer tabs, as in the app (HealthCoachScreen.tsx:1748): Aðgerðir,
// Þjálfari (the conversation) and Áskrift. Under Aðgerðir sit Í dag plus the
// four pillar tabs, and each pillar carries its own programme picker and
// education, collapsed into it — the app's own reasoning is that everything
// about one pillar should live in one place.
//
// Only today can be ticked; the other days of a pillar's week are the plan,
// and the API enforces that regardless of what this sends.

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT, useLongDate } from "./../useT";
import type { StringKey } from "./../strings";
import { appBrand, appCard, appHeaderBar, greenHeader } from "./../ui";
import ActionRow, { type Action, pillarOf } from "./ActionRow";
import Programs, { type Category } from "./Programs";
import Education, { type Course } from "./Education";
import Chat from "./Chat";

type Outer = "actions" | "chat" | "plan";
type Inner = "today" | "exercise" | "nutrition" | "sleep" | "mental";

const PILLARS: Inner[] = ["exercise", "nutrition", "sleep", "mental"];
const ORDER = ["morning", "midday", "evening"] as const;
const DAY_KEYS: StringKey[] = ["day.1", "day.2", "day.3", "day.4", "day.5", "day.6", "day.0"];

interface Payload {
  day: string; dow: number; actions: Action[];
  pillarWeek?: { dow: number; actions: Action[] }[];
  week: { dow: number; count: number }[];
}
interface Sub { tier: string | null; status: string | null; trialEndsAt: string | null; periodEnd: string | null }

export default function Coach() {
  const api = useApi();
  const t = useT();
  const longDate = useLongDate();
  const [outer, setOuter] = useState<Outer>("actions");
  const [inner, setInner] = useState<Inner>("today");
  const [d, setD] = useState<Payload | null | undefined>(undefined);
  const [cats, setCats] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sub, setSub] = useState<Sub | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (pillar?: string) => {
    const r = await api(`/api/app/actions${pillar ? `?pillar=${pillar}` : ""}`);
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setD(j), 0);
  }, [api]);

  useEffect(() => { void load(inner === "today" ? undefined : inner); }, [load, inner]);

  useEffect(() => {
    void (async () => {
      const [p, e] = await Promise.all([api("/api/app/programs"), api("/api/app/education")]);
      const pj = p.ok ? await p.json().catch(() => null) : null;
      const ej = e.ok ? await e.json().catch(() => null) : null;
      setTimeout(() => { setCats(pj?.categories ?? []); setCourses(ej?.courses ?? []); }, 0);
    })();
  }, [api]);

  useEffect(() => {
    if (outer !== "plan" || sub !== undefined) return;
    void (async () => {
      const r = await api("/api/app/subscription");
      const j = r.ok ? await r.json().catch(() => null) : null;
      setTimeout(() => setSub(j?.subscription ?? null), 0);
    })();
  }, [api, outer, sub]);

  const toggle = async (a: Action) => {
    if (busy) return;
    setBusy(a.actionKey); setErr(null);
    const flip = (on: boolean) => setD((p) => p && {
      ...p,
      actions: p.actions.map((x) => x.actionKey === a.actionKey ? { ...x, done: on } : x),
      pillarWeek: p.pillarWeek?.map((w) => ({ ...w, actions: w.actions.map((x) => x.actionKey === a.actionKey ? { ...x, done: on } : x) })),
    });
    flip(!a.done);
    const r = await api("/api/app/actions", {
      method: "POST",
      body: JSON.stringify({ actionKey: a.actionKey, date: d?.day, status: a.done ? "todo" : "done", label: a.label }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setErr(j?.error === "too-fast" ? t("coach.tooFast") : j?.error === "wrong-date" ? t("coach.wrongDate") : t("coach.failed"));
      flip(a.done);
    }
    setBusy(null);
  };

  const pickProgram = async (categoryKey: string, programKey: string) => {
    setBusy("program");
    const r = await api("/api/app/programs", { method: "POST", body: JSON.stringify({ categoryKey, programKey }) });
    if (r.ok) {
      const [p] = await Promise.all([api("/api/app/programs"), load(inner === "today" ? undefined : inner)]);
      const pj = p.ok ? await p.json().catch(() => null) : null;
      setTimeout(() => setCats(pj?.categories ?? []), 0);
    } else setErr(t("coach.failed"));
    setBusy(null);
  };

  const actions = d?.actions ?? [];
  const done = actions.filter((a) => a.done).length;
  const cat = cats.find((c) => c.key === inner) ?? null;
  const pillarCourses = courses.filter((c) => (c.category ?? "").toLowerCase() === inner);

  const tabBtn = (active: boolean) =>
    `flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition ${active ? "" : "hover:bg-black/[0.03]"}`;
  const tabStyle = (active: boolean, colour: string = appBrand.primaryDark) =>
    active ? { background: "#fff", color: colour, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: appBrand.ink2 };

  return (
    <div className="space-y-3">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: appBrand.primaryDark }}>{longDate()}</p>
        <h1 className="mt-0.5 text-2xl font-bold" style={{ color: appBrand.ink1 }}>{t("nav.coach")}</h1>
      </header>

      {/* Outer: Aðgerðir · Þjálfari · Áskrift */}
      <div className="flex gap-1 rounded-2xl p-1" style={{ background: appBrand.cardAlt }}>
        {([["actions", "tab.actions"], ["chat", "tab.coachChat"], ["plan", "tab.plan"]] as [Outer, StringKey][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setOuter(k)} className={tabBtn(outer === k)} style={tabStyle(outer === k)}>
            {t(label)}
          </button>
        ))}
      </div>

      {outer === "chat" && <Chat />}

      {outer === "plan" && (
        <>
          {sub === undefined && <div className="h-24 animate-pulse rounded-[14px] bg-white" aria-hidden />}
          {sub === null && <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("sub.none")}</p>}
          {sub && (
            <div className={`${appCard} p-5`}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("sub.title")}</p>
              <p className="text-xl font-bold capitalize" style={{ color: appBrand.ink1 }}>{sub.tier ?? "—"}</p>
              {sub.status && (
                <p className="mt-1 text-sm" style={{ color: appBrand.ink2 }}>{t("sub.status")}: {sub.status}</p>
              )}
              {sub.trialEndsAt && (
                <p className="text-sm" style={{ color: appBrand.ink2 }}>{t("sub.trial")} {sub.trialEndsAt.slice(0, 10)}</p>
              )}
              {sub.periodEnd && (
                <p className="text-sm" style={{ color: appBrand.ink2 }}>{t("sub.until")} {sub.periodEnd.slice(0, 10)}</p>
              )}
            </div>
          )}
        </>
      )}

      {outer === "actions" && (
        <>
          {/* Inner: Í dag + the four pillars */}
          <div className="flex gap-1 overflow-x-auto rounded-2xl p-1" style={{ background: appBrand.cardAlt }}>
            <button type="button" onClick={() => setInner("today")} className={tabBtn(inner === "today")}
              style={tabStyle(inner === "today")}>{t("coach.today")}</button>
            {PILLARS.map((p) => (
              <button key={p} type="button" onClick={() => setInner(p)} className={tabBtn(inner === p)}
                style={tabStyle(inner === p, pillarOf(p).colour)}>
                {t(pillarOf(p).key)}
              </button>
            ))}
          </div>

          {err && (
            <p className={`${appCard} border-l-[3px] px-4 py-3 text-sm`}
              style={{ borderLeftColor: appBrand.error, color: appBrand.ink2 }} role="alert">{err}</p>
          )}

          {d === undefined && <div className="h-40 animate-pulse rounded-[14px] bg-white" aria-hidden />}

          {/* ── Í dag ── */}
          {d && inner === "today" && (actions.length > 0 ? (
            <>
              <div className={appHeaderBar} style={greenHeader}>
                <Check className="h-[18px] w-[18px]" aria-hidden />
                <span className="flex-1 text-[15px] font-bold">{done} {t("coach.of")} {actions.length} {t("coach.done")}</span>
              </div>
              {(["morning", "midday", "evening", "anytime"] as const)
                .map((g) => ({ g, items: g === "anytime"
                  ? actions.filter((a) => !a.timeGroup || !ORDER.includes(a.timeGroup as (typeof ORDER)[number]))
                  : actions.filter((a) => a.timeGroup === g) }))
                .filter((x) => x.items.length > 0)
                .map(({ g, items }) => (
                  <section key={g}>
                    <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>
                      {t(`when.${g}` as "when.morning")}
                    </p>
                    <div className="space-y-2">
                      {items.map((a) => <ActionRow key={a.actionKey} a={a} onToggle={toggle} busy={busy === a.actionKey} />)}
                    </div>
                  </section>
                ))}
              {done === actions.length && (
                <p className={`${appCard} p-4 text-center text-sm font-semibold`} style={{ color: appBrand.primaryDark }}>
                  {t("coach.allDone")}
                </p>
              )}
            </>
          ) : (
            <div className={`${appCard} p-5`}>
              <p className="text-sm" style={{ color: appBrand.ink2 }}>
                {d.week.every((w) => w.count === 0) ? t("coach.noProgram") : t("coach.none")}
              </p>
            </div>
          ))}

          {/* ── One pillar: programme, its week, then its education ── */}
          {d && inner !== "today" && (
            <>
              {cat && <Programs cat={cat} busy={busy === "program"} onPick={(k) => void pickProgram(cat.key, k)} />}

              {(d.pillarWeek ?? []).map((w) => (
                w.actions.length === 0 ? null : (
                  <section key={w.dow}>
                    <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: w.dow === d.dow ? appBrand.primaryDark : appBrand.ink3 }}>
                      {t(DAY_KEYS[w.dow])}{w.dow === d.dow ? ` · ${t("coach.today")}` : ""}
                    </p>
                    <div className="space-y-2">
                      {w.actions.map((a) => (
                        <ActionRow key={`${w.dow}-${a.actionKey}`} a={a} showPillar={false}
                          tickable={w.dow === d.dow} onToggle={toggle} busy={busy === a.actionKey} />
                      ))}
                    </div>
                  </section>
                )
              ))}

              <section>
                <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>
                  {t("edu.title")}
                </p>
                <Education courses={pillarCourses} />
              </section>
            </>
          )}
        </>
      )}

      {d === null && <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("home.failed")}</p>}
    </div>
  );
}
