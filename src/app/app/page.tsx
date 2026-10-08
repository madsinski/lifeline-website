"use client";

// Heim — the Lifeline app's home screen, on the web.
//
// Built from fhir-health-dashboard/src/screens/HomeScreen.tsx. The app and
// heilsuferð are different products sharing one database: heilsuferð runs on
// hc_* tables and a nurse-authored plan, the app runs on the programme
// system, action_completions and the meters the server computes onto the
// client row. This surface is the app's.
//
// Section order is the screen's own (HomeScreen.tsx):
//   1. one banner at most — transition outranks deload   (2146-2222)
//   2. Today's Health / "Current insights"               (2253)
//   3. the macros card, only when tracking is on         (2307)
//   4. What's coming up                                  (2427)
// The hero meters sit above all of it.
//
// The look comes from the app's own tokens — see ui.ts. Cards are radius 14
// with a hairline border; the gradient header bars are the thing that makes
// the app's home screen recognisable, so they are here too.

import { useEffect, useState } from "react";
import { Activity, BarChart3, CalendarClock, ChevronRight, TrendingDown } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT, useLongDate, useShortDateTime } from "./useT";
import type { StringKey } from "./strings";
import { appBrand, appCard, appHeaderBar, greenHeader, darkHeader } from "./ui";

interface Home {
  meters: {
    consistency: number | null; intensity: number | null; completion: number | null;
    consistency7d: number | null; completion7d: number | null; narrative: string | null;
  };
  grid: { date: string; done_count: number }[];
  macros: {
    target: { kcal: number; protein: number; carbs: number; fat: number };
    eaten: { kcal: number; protein: number; carbs: number; fat: number };
    meals: number;
  } | null;
  scan: {
    at: string; weightKg: number | null; bodyFatPct: number | null; muscleMassPct: number | null;
    phaseAngle: number | null; bmrKcal: number | null; visceralFatIdx: number | null;
  } | null;
  banner: { kind: "transition"; next: string; reason: string | null } | { kind: "deload" } | null;
  upcoming: { key: string; at?: string; detail?: string | null }[];
  weight: { kg: number; at: string; previousKg: number | null } | null;
}

/** Which greeting the hour calls for; the words come from the dictionary. */
const helloKey = () => {
  const h = new Date().getHours();
  if (h < 5) return "hello.night" as const;
  if (h < 11) return "hello.morning" as const;
  if (h < 18) return "hello.day" as const;
  return "hello.evening" as const;
};

function Meter({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  const pct = value == null ? null : Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`${appCard} p-3 text-center`}>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink2 }}>{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums" style={{ color: appBrand.ink1 }}>
        {pct == null ? "—" : `${pct}%`}
      </p>
      <p className="text-[10px] leading-tight" style={{ color: appBrand.ink3 }}>{hint}</p>
    </div>
  );
}

/** The app's section box: a gradient header bar, then content beneath it. */
function Section({ title, Icon, dark = false, href, children }: {
  title: string; Icon: typeof Activity; dark?: boolean; href?: string; children: React.ReactNode;
}) {
  const bar = (
    <div className={appHeaderBar} style={dark ? darkHeader : greenHeader}>
      <Icon className="h-[18px] w-[18px]" aria-hidden />
      <span className="flex-1 text-[15px] font-bold">{title}</span>
      {href && <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />}
    </div>
  );
  return (
    <section>
      {href ? <a href={href} className="block transition active:opacity-90">{bar}</a> : bar}
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function Bar({ label, eaten, target }: { label: string; eaten: number; target: number }) {
  const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  const over = target > 0 && eaten > target;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold" style={{ color: appBrand.ink2 }}>{label}</span>
        <span className="tabular-nums" style={{ color: appBrand.ink3 }}>{Math.round(eaten)}/{Math.round(target)} g</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full" style={{ background: appBrand.cardAlt }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? appBrand.accent : appBrand.nutrition }} />
      </div>
    </div>
  );
}

/**
 * Macros. The app draws a wheel (MacrosWheel); a ring for calories with the
 * three macros as bars beside it is the same information, and reads at a
 * glance on a phone. Teal, because nutrition is teal in the app's palette.
 */
function Macros({ m }: { m: NonNullable<Home["macros"]> }) {
  const t = useT();
  const pct = m.target.kcal > 0 ? Math.min(100, (m.eaten.kcal / m.target.kcal) * 100) : 0;
  const left = Math.round(m.target.kcal - m.eaten.kcal);
  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className={`${appCard} p-4`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: appBrand.ink2 }}>{t("macros.title")}</p>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
            <circle cx="44" cy="44" r={R} fill="none" stroke={appBrand.cardAlt} strokeWidth="9" />
            <circle cx="44" cy="44" r={R} fill="none" stroke={appBrand.nutrition} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} transform="rotate(-90 44 44)" />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold tabular-nums leading-none" style={{ color: appBrand.ink1 }}>{Math.abs(left)}</span>
            <span className="text-[9px]" style={{ color: appBrand.ink2 }}>{left >= 0 ? t("macros.left") : t("macros.over")}</span>
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Bar label={t("macros.protein")} eaten={m.eaten.protein} target={m.target.protein} />
          <Bar label={t("macros.carbs")} eaten={m.eaten.carbs} target={m.target.carbs} />
          <Bar label={t("macros.fat")} eaten={m.eaten.fat} target={m.target.fat} />
        </div>
      </div>
      <p className="mt-2 text-xs" style={{ color: appBrand.ink2 }}>
        {m.meals === 0 ? t("macros.none") : `${m.meals} ${t("macros.meals")}`}
      </p>
    </div>
  );
}

export default function AppHome() {
  const api = useApi();
  const t = useT();
  const longDate = useLongDate();
  const shortAt = useShortDateTime();
  const [d, setD] = useState<Home | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [h, p] = await Promise.all([api("/api/app/home"), api("/api/hc/profile")]);
      const hj = h.ok ? await h.json().catch(() => null) : null;
      const pj = p.ok ? await p.json().catch(() => null) : null;
      setTimeout(() => {
        setD(hj);
        setName((pj?.profile?.full_name ?? "").split(" ")[0] || null);
      }, 0);
    })();
  }, [api]);

  // Seven days ending today, so the strip reads left-to-right into now.
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - (6 - i));
    const iso = dt.toISOString().slice(0, 10);
    return { iso, done: d?.grid.find((g) => g.date === iso)?.done_count ?? 0 };
  });
  const best = Math.max(1, ...days.map((x) => x.done));

  const scanRows: [StringKey, string][] = [];
  if (d?.scan) {
    const s = d.scan;
    if (s.bodyFatPct != null) scanRows.push(["insights.fat", `${s.bodyFatPct.toFixed(1)} %`]);
    if (s.muscleMassPct != null) scanRows.push(["insights.muscle", `${s.muscleMassPct.toFixed(1)} %`]);
    // A visceral-fat index of 0 is not a reading — the scanner leaves it at
    // zero when it did not measure it. Showing "0" would read as excellent.
    if (s.visceralFatIdx) scanRows.push(["insights.visceral", String(s.visceralFatIdx)]);
    if (s.bmrKcal != null) scanRows.push(["insights.bmr", `${Math.round(s.bmrKcal)} kcal`]);
    if (s.phaseAngle != null) scanRows.push(["insights.phase", `${s.phaseAngle.toFixed(1)}°`]);
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: appBrand.primaryDark }}>{longDate()}</p>
        <h1 className="mt-0.5 text-2xl font-bold" style={{ color: appBrand.ink1 }}>
          {t(helloKey())}{name ? `, ${name}` : ""}
        </h1>
      </header>

      {d === undefined && <div className="h-36 animate-pulse rounded-[14px] bg-white" aria-hidden />}

      {d && (
        <>
          {/* One banner at most, in the app's priority order. */}
          {d.banner?.kind === "transition" && (
            <div className={`${appCard} border-l-[3px] p-4`} style={{ borderLeftColor: appBrand.primary }}>
              <p className="text-sm font-bold" style={{ color: appBrand.ink1 }}>{t("banner.transition.title")}</p>
              <p className="mt-0.5 text-xs" style={{ color: appBrand.ink2 }}>{d.banner.reason || t("banner.transition.body")}</p>
              <a href="/app/thjalfari" className="mt-2 inline-block text-xs font-bold" style={{ color: appBrand.primaryDark }}>
                {t("banner.transition.cta")} →
              </a>
            </div>
          )}
          {d.banner?.kind === "deload" && (
            <div className={`${appCard} flex gap-3 border-l-[3px] p-4`} style={{ borderLeftColor: appBrand.accent }}>
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" style={{ color: appBrand.accent }} aria-hidden />
              <div>
                <p className="text-sm font-bold" style={{ color: appBrand.ink1 }}>{t("banner.deload.title")}</p>
                <p className="mt-0.5 text-xs" style={{ color: appBrand.ink2 }}>{t("banner.deload.body")}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Meter label={t("home.showingUp")} value={d.meters.consistency7d ?? d.meters.consistency} hint={t("home.showingUp.hint")} />
            <Meter label={t("home.completion")} value={d.meters.completion7d ?? d.meters.completion} hint={t("home.completion.hint")} />
            <Meter label={t("home.intensity")} value={d.meters.intensity} hint={t("home.intensity.hint")} />
          </div>

          {d.meters.narrative && (
            <p className={`${appCard} px-4 py-3 text-sm`} style={{ color: appBrand.ink2 }}>{d.meters.narrative}</p>
          )}

          <div className={`${appCard} p-4`}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: appBrand.ink2 }}>{t("home.week")}</p>
            {/* items-stretch, not items-end: with items-end each column
                shrinks to its label and the track's flex-1 resolves to zero
                height, which is why the strip looked empty. */}
            <div className="flex items-stretch justify-between gap-1.5" style={{ height: 72 }}>
              {days.map((x, i) => (
                <div key={x.iso} className="flex h-full flex-1 flex-col items-center gap-1">
                  {/* Every day gets a full-height track, so a week with
                      nothing done reads as an empty week rather than as a
                      chart that failed to load. The track is darker than
                      cardAlt — that tint is near-white and vanished against
                      the card it sits on. */}
                  <div className="flex w-full flex-1 items-end overflow-hidden rounded-md"
                    style={{ background: "#dbe3ec" }}>
                    <div className="w-full rounded-md transition-all"
                      style={{ height: x.done ? `${Math.max(14, (x.done / best) * 100)}%` : 0,
                        background: appBrand.primary }}
                      title={`${x.iso}: ${x.done}`} />
                  </div>
                  <span className="text-[10px] font-semibold"
                    style={{ color: i === 6 ? appBrand.ink1 : appBrand.ink3 }}>
                    {t(`day.${new Date(`${x.iso}T12:00:00`).getDay()}` as "day.0")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Health — the app always renders it; scan values are additive. */}
          <Section title={t("insights.title")} Icon={BarChart3} href="/app/heilsan">
            {scanRows.length > 0 ? (
              <div className={`${appCard} p-4`}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {scanRows.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t(k)}</dt>
                      <dd className="text-base font-bold tabular-nums" style={{ color: appBrand.ink1 }}>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-[11px]" style={{ color: appBrand.ink3 }}>
                  {t("insights.measured")} {d.scan!.at.slice(0, 10)}
                </p>
              </div>
            ) : (
              <div className={`${appCard} p-4`}>
                <p className="text-sm" style={{ color: appBrand.ink2 }}>{t("insights.none")}</p>
                <a href="/account/book" className="mt-2 inline-block text-xs font-bold" style={{ color: appBrand.primaryDark }}>
                  {t("insights.book")} →
                </a>
              </div>
            )}
          </Section>

          {d.macros && <Macros m={d.macros} />}

          {d.weight && (
            <div className={`${appCard} flex items-baseline gap-3 px-4 py-3`}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: appBrand.ink2 }}>{t("weight.title")}</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: appBrand.ink1 }}>{d.weight.kg} kg</p>
              {d.weight.previousKg != null && d.weight.kg !== d.weight.previousKg && (() => {
                const diff = Math.round((d.weight!.kg - d.weight!.previousKg!) * 10) / 10;
                return (
                  <p className="text-xs font-semibold" style={{ color: diff < 0 ? appBrand.primaryDark : appBrand.ink2 }}>
                    {diff > 0 ? "+" : ""}{diff} kg{" "}
                    <span className="font-normal" style={{ color: appBrand.ink3 }}>{t("weight.since")}</span>
                  </p>
                );
              })()}
            </div>
          )}

          {/* What's coming up — the dark header, as in the app. */}
          <Section title={t("upcoming.title")} Icon={CalendarClock} dark>
            {d.upcoming.length === 0 ? (
              <p className={`${appCard} px-4 py-3 text-sm`} style={{ color: appBrand.ink2 }}>{t("upcoming.none")}</p>
            ) : (
              d.upcoming.map((u) => (
                <div key={`${u.key}-${u.at ?? ""}`} className={`${appCard} flex items-center gap-3 px-4 py-3`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                    style={{ background: `${appBrand.primary}14`, border: `1px solid ${appBrand.primary}` }}>
                    <Activity className="h-4 w-4" style={{ color: appBrand.primaryDark }} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold" style={{ color: appBrand.ink1 }}>
                      {t(`upcoming.${u.key}` as "upcoming.questionnaire")}
                    </span>
                    <span className="block truncate text-xs" style={{ color: appBrand.ink2 }}>
                      {u.at ? `${shortAt(u.at)}${u.detail ? ` · ${u.detail}` : ""}` : t(`upcoming.${u.key}.sub` as "upcoming.questionnaire.sub")}
                    </span>
                  </span>
                </div>
              ))
            )}
          </Section>
        </>
      )}

      {d === null && (
        <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("home.failed")}</p>
      )}
    </div>
  );
}
