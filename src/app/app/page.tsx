"use client";

// Heim — the Lifeline app's home screen, on the web.
//
// Built from fhir-health-dashboard/src/screens/HomeScreen.tsx rather than
// from heilsuferð. They are different products sharing one database: the
// heilsuferð pages run on hc_* tables and a nurse-authored action plan, the
// app runs on the programme system, action_completions and the three meters
// the server computes onto the client row.
//
// This first pass is the hero — the three meters and the week strip, which
// is what HomeScreen leads with (HomeScreen.tsx:688-740). Macros, meal and
// weight logging, the quick session, modes and the coaching nudges are the
// rest of that screen and are not here yet.

import { useEffect, useState } from "react";
import { useApi } from "@/lib/hc/use-api";
import { useT, useLongDate } from "./useT";

interface Home {
  meters: {
    consistency: number | null;
    intensity: number | null;
    completion: number | null;
    consistency7d: number | null;
    completion7d: number | null;
    narrative: string | null;
  };
  grid: { date: string; done_count: number }[];
}

/** Which greeting the hour calls for; the words come from the dictionary. */
const helloKey = () => {
  const h = new Date().getHours();
  if (h < 5) return "hello.night" as const;
  if (h < 11) return "hello.morning" as const;
  if (h < 18) return "hello.day" as const;
  return "hello.evening" as const;
};

/** The app shows these as percentages out of 100. */
function Meter({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  const pct = value == null ? null : Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-100">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-hc-ink">
        {pct == null ? "—" : `${pct}%`}
      </p>
      <p className="text-[10px] leading-tight text-slate-400">{hint}</p>
    </div>
  );
}

export default function AppHome() {
  const api = useApi();
  const t = useT();
  const longDate = useLongDate();
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

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-hc-brand-dark">{longDate()}</p>
        <h1 className="mt-0.5 text-2xl font-bold text-hc-ink">{t(helloKey())}{name ? `, ${name}` : ""}</h1>
      </header>

      {d === undefined && <div className="h-36 animate-pulse rounded-3xl bg-white" aria-hidden />}

      {d && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Meter label={t("home.showingUp")} value={d.meters.consistency7d ?? d.meters.consistency} hint={t("home.showingUp.hint")} />
            <Meter label={t("home.completion")} value={d.meters.completion7d ?? d.meters.completion} hint={t("home.completion.hint")} />
            <Meter label={t("home.intensity")} value={d.meters.intensity} hint={t("home.intensity.hint")} />
          </div>

          {d.meters.narrative && (
            <p className="rounded-2xl bg-white px-4 py-3 text-sm text-hc-ink-2 shadow-sm ring-1 ring-slate-100">
              {d.meters.narrative}
            </p>
          )}

          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{t("home.week")}</p>
            <div className="flex items-end justify-between gap-1.5" style={{ height: 72 }}>
              {days.map((x, i) => (
                <div key={x.iso} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-md bg-hc-brand transition-all"
                      style={{ height: `${Math.max(x.done ? 12 : 4, (x.done / best) * 100)}%`, opacity: x.done ? 1 : 0.18 }}
                      title={`${x.iso}: ${x.done}`} />
                  </div>
                  <span className={`text-[10px] font-semibold ${i === 6 ? "text-hc-ink" : "text-slate-400"}`}>
                    {t(`day.${new Date(`${x.iso}T12:00:00`).getDay()}` as "day.0")}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Said plainly rather than left as a thin-looking home screen. */}
          <p className="px-1 text-xs text-slate-500">
{t("home.rest")}
          </p>
        </>
      )}

      {d === null && (
        <p className="rounded-3xl bg-white p-5 text-sm text-hc-ink-2 shadow-sm ring-1 ring-slate-100">
          {t("home.failed")}
        </p>
      )}
    </div>
  );
}
