"use client";

// Þjálfari — the day's actions, and ticking them off.
//
// This is the daily loop. Completions written here land in action_completions,
// which is what feeds the three meters and the week strip on Heim; without it
// that screen can only ever show zeros.
//
// The list comes from /api/app/actions, which runs the app's five-layer
// resolution pipeline server-side (see src/lib/app/resolve-actions.ts). The
// tick posts back to the same route, where the app's anti-cheat rules are
// enforced — today only, three seconds between completions.

import { useCallback, useEffect, useState } from "react";
import { Check, Dumbbell, Moon, Sparkles, Utensils } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT, useLongDate } from "./../useT";
import type { StringKey } from "./../strings";
import { appBrand, appCard, appHeaderBar, greenHeader } from "./../ui";

interface Action {
  actionKey: string; label: string; pillar: string; details: string[];
  dayOfWeek: number; timeGroup: string | null; modality: string | null;
  durationMin: number | null; libKey: string | null; sortOrder: number;
  added: boolean; done: boolean;
}
interface Payload { day: string; dow: number; actions: Action[]; week: { dow: number; count: number }[] }

/** The app's four pillars and their colours (theme/brand.ts). */
const PILLAR = {
  exercise: { colour: appBrand.exercise, Icon: Dumbbell, key: "pillar.exercise" as StringKey },
  nutrition: { colour: appBrand.nutrition, Icon: Utensils, key: "pillar.nutrition" as StringKey },
  sleep: { colour: appBrand.sleep, Icon: Moon, key: "pillar.sleep" as StringKey },
  mental: { colour: appBrand.mental, Icon: Sparkles, key: "pillar.mental" as StringKey },
} as const;
const pillarOf = (p: string) => PILLAR[p as keyof typeof PILLAR] ?? PILLAR.exercise;

const ORDER = ["morning", "midday", "evening"] as const;

export default function Coach() {
  const api = useApi();
  const t = useT();
  const longDate = useLongDate();
  const [d, setD] = useState<Payload | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/app/actions");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setD(j), 0);
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (a: Action) => {
    if (busy) return;
    setBusy(a.actionKey);
    setErr(null);
    // Optimistic: the tick should feel instant, and it is reverted on failure.
    setD((p) => p && { ...p, actions: p.actions.map((x) => x.actionKey === a.actionKey ? { ...x, done: !x.done } : x) });
    const r = await api("/api/app/actions", {
      method: "POST",
      body: JSON.stringify({ actionKey: a.actionKey, date: d?.day, status: a.done ? "todo" : "done", label: a.label }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setErr(j?.error === "too-fast" ? t("coach.tooFast") : j?.error === "wrong-date" ? t("coach.wrongDate") : t("coach.failed"));
      setD((p) => p && { ...p, actions: p.actions.map((x) => x.actionKey === a.actionKey ? { ...x, done: a.done } : x) });
    }
    setBusy(null);
  };

  const actions = d?.actions ?? [];
  const done = actions.filter((a) => a.done).length;
  const groups = ORDER
    .map((g) => ({ g, items: actions.filter((a) => a.timeGroup === g) }))
    .concat([{ g: "anytime" as (typeof ORDER)[number], items: actions.filter((a) => !a.timeGroup || !ORDER.includes(a.timeGroup as (typeof ORDER)[number])) }])
    .filter((x) => x.items.length > 0);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: appBrand.primaryDark }}>{longDate()}</p>
        <h1 className="mt-0.5 text-2xl font-bold" style={{ color: appBrand.ink1 }}>{t("coach.today")}</h1>
      </header>

      {d === undefined && <div className="h-40 animate-pulse rounded-[14px] bg-white" aria-hidden />}

      {d && actions.length > 0 && (
        <>
          <div className={appHeaderBar} style={greenHeader}>
            <Check className="h-[18px] w-[18px]" aria-hidden />
            <span className="flex-1 text-[15px] font-bold">
              {done} {t("coach.of")} {actions.length} {t("coach.done")}
            </span>
            {done === actions.length && <span className="text-xs font-semibold opacity-90">✓</span>}
          </div>

          {err && (
            <p className={`${appCard} border-l-[3px] px-4 py-3 text-sm`}
              style={{ borderLeftColor: appBrand.error, color: appBrand.ink2 }} role="alert">{err}</p>
          )}

          {groups.map(({ g, items }) => (
            <section key={g}>
              <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>
                {t(`when.${g}` as "when.morning")}
              </p>
              <div className="space-y-2">
                {items.map((a) => {
                  const p = pillarOf(a.pillar);
                  return (
                    <button key={a.actionKey} type="button" onClick={() => void toggle(a)}
                      disabled={busy === a.actionKey}
                      aria-pressed={a.done}
                      className={`${appCard} flex w-full items-start gap-3 p-3.5 text-left transition active:scale-[0.995] disabled:opacity-60`}>
                      {/* The tick target is the whole row — on a phone a small
                          checkbox is the difference between using this daily
                          and not bothering. */}
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition"
                        style={{
                          borderColor: a.done ? appBrand.primary : appBrand.ink4,
                          background: a.done ? appBrand.primary : "transparent",
                        }}>
                        {a.done && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <p.Icon className="h-3.5 w-3.5 shrink-0" style={{ color: p.colour }} aria-hidden />
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: p.colour }}>
                            {t(p.key)}
                          </span>
                          {a.durationMin ? (
                            <span className="text-[10px]" style={{ color: appBrand.ink3 }}>
                              · {a.durationMin} {t("coach.min")}
                            </span>
                          ) : null}
                          {a.added && (
                            <span className="rounded-full px-1.5 text-[9px] font-bold uppercase"
                              style={{ background: `${appBrand.primary}1a`, color: appBrand.primaryDark }}>
                              {t("coach.added")}
                            </span>
                          )}
                        </span>
                        <span className={`mt-0.5 block text-sm font-bold ${a.done ? "line-through" : ""}`}
                          style={{ color: a.done ? appBrand.ink3 : appBrand.ink1 }}>
                          {a.label}
                        </span>
                        {a.details.length > 0 && (
                          <span className="mt-0.5 block text-xs leading-snug" style={{ color: appBrand.ink2 }}>
                            {a.details.slice(0, 2).join(" · ")}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {done === actions.length && (
            <p className={`${appCard} p-4 text-center text-sm font-semibold`} style={{ color: appBrand.primaryDark }}>
              {t("coach.allDone")}
            </p>
          )}
        </>
      )}

      {d && actions.length === 0 && (
        <div className={`${appCard} p-5`}>
          <p className="text-sm" style={{ color: appBrand.ink2 }}>
            {d.week.every((w) => w.count === 0) ? t("coach.noProgram") : t("coach.none")}
          </p>
          {d.week.every((w) => w.count === 0) && (
            <a href="/account/heilsuferd" className="mt-3 inline-flex min-h-10 items-center rounded-full px-4 font-semibold text-white"
              style={{ background: appBrand.primary }}>
              {t("coach.noProgram.cta")}
            </a>
          )}
        </div>
      )}

      {d === null && <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("home.failed")}</p>}
    </div>
  );
}
