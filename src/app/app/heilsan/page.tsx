"use client";

// Heilsan — the measurements, over time.
//
// What MyHealthScreen shows: body-composition scans and weight. Blood markers
// live in health_records, which is empty for every client today, so that
// section says so plainly instead of implying the feature is running.
//
// Each metric gets its latest value, the change since the first measurement,
// and a sparkline when there is more than one reading. A single number tells
// you where you are; the direction is the part that is actually useful.

import { useEffect, useState } from "react";
import { Activity, Droplet, Scale } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT } from "./../useT";
import type { StringKey } from "./../strings";
import { appBrand, appCard, appHeaderBar, greenHeader, darkHeader } from "./../ui";

interface Scan {
  at: string; source: string | null; weightKg: number | null; bodyFatPct: number | null;
  muscleMassPct: number | null; muscleMassKg: number | null; phaseAngle: number | null;
  bmrKcal: number | null; visceralFatIdx: number | null; waistCm: number | null; tbwL: number | null;
}
interface Payload {
  scans: Scan[];
  weights: { at: string; kg: number | null; bodyFatPct: number | null; source: string | null }[];
  records: { type: string; key: string; label: string; value: string; unit: string | null; status: string | null; at: string }[];
}

/** Which scan fields to show, in the order the app lists them. */
const METRICS: { field: keyof Scan; key: StringKey; unit: string; dp: number }[] = [
  { field: "weightKg", key: "metric.weight", unit: "kg", dp: 1 },
  { field: "bodyFatPct", key: "metric.bodyFat", unit: "%", dp: 1 },
  { field: "muscleMassPct", key: "metric.muscleMass", unit: "%", dp: 1 },
  { field: "muscleMassKg", key: "metric.muscleKg", unit: "kg", dp: 2 },
  { field: "phaseAngle", key: "metric.phaseAngle", unit: "°", dp: 2 },
  { field: "bmrKcal", key: "metric.bmr", unit: "kcal", dp: 0 },
  { field: "visceralFatIdx", key: "metric.visceral", unit: "", dp: 0 },
  { field: "waistCm", key: "metric.waist", unit: "cm", dp: 1 },
  { field: "tbwL", key: "metric.tbw", unit: "l", dp: 1 },
];

/** A sparkline. Flat when every reading is the same, rather than dividing by zero. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const w = 64, h = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - lo) / span) * h;
    return `${x.toFixed(1)},${(hi === lo ? h / 2 : y).toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={appBrand.primary} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Health() {
  const api = useApi();
  const t = useT();
  const [d, setD] = useState<Payload | null | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      const r = await api("/api/app/health");
      const j = r.ok ? await r.json().catch(() => null) : null;
      setTimeout(() => setD(j), 0);
    })();
  }, [api]);

  const scans = d?.scans ?? [];
  const latest = scans[scans.length - 1];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: appBrand.ink1 }}>{t("nav.health")}</h1>

      {d === undefined && <div className="h-40 animate-pulse rounded-[14px] bg-white" aria-hidden />}

      {d && (
        <>
          <section>
            <div className={appHeaderBar} style={greenHeader}>
              <Activity className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1 text-[15px] font-bold">{t("health.scans")}</span>
              {scans.length > 0 && (
                <span className="text-xs font-semibold opacity-90">
                  {scans.length} {t("health.measurements")}
                </span>
              )}
            </div>

            <div className="mt-2 space-y-2">
              {scans.length === 0 && (
                <p className={`${appCard} p-4 text-sm`} style={{ color: appBrand.ink2 }}>{t("health.noScans")}</p>
              )}

              {latest && METRICS.map((m) => {
                // Only readings that exist. A visceral index of 0 is the
                // scanner not measuring it, not a value — same rule as Heim.
                const series = scans
                  .map((s) => s[m.field] as number | null)
                  .filter((v): v is number => v != null && !(m.field === "visceralFatIdx" && v === 0));
                if (series.length === 0) return null;
                const now = series[series.length - 1];
                const first = series[0];
                const diff = Math.round((now - first) * 100) / 100;
                return (
                  <div key={m.field} className={`${appCard} flex items-center gap-3 px-4 py-3`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>
                        {t(m.key)}
                      </span>
                      <span className="text-lg font-bold tabular-nums" style={{ color: appBrand.ink1 }}>
                        {now.toFixed(m.dp)}{m.unit ? ` ${m.unit}` : ""}
                      </span>
                    </span>
                    <Spark values={series} />
                    {series.length > 1 && diff !== 0 && (
                      <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums"
                        style={{ color: appBrand.ink2 }}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(m.dp)}
                      </span>
                    )}
                  </div>
                );
              })}

              {latest && (
                <p className="px-1 text-[11px]" style={{ color: appBrand.ink3 }}>
                  {t("health.change")}: {t("health.since")} · {latest.at.slice(0, 10)}
                  {latest.source ? ` · ${t("health.source")} ${latest.source}` : ""}
                </p>
              )}
            </div>
          </section>

          {d.weights.length > 0 && (
            <section>
              <div className={appHeaderBar} style={greenHeader}>
                <Scale className="h-[18px] w-[18px]" aria-hidden />
                <span className="flex-1 text-[15px] font-bold">{t("health.weight")}</span>
              </div>
              <div className={`${appCard} mt-2 divide-y divide-slate-100`}>
                {[...d.weights].reverse().map((w) => (
                  <div key={w.at} className="flex items-baseline justify-between px-4 py-2.5">
                    <span className="text-xs" style={{ color: appBrand.ink2 }}>{w.at.slice(0, 10)}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: appBrand.ink1 }}>
                      {w.kg} kg
                      {w.bodyFatPct != null && (
                        <span className="ml-2 font-normal" style={{ color: appBrand.ink3 }}>{w.bodyFatPct} %</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className={appHeaderBar} style={darkHeader}>
              <Droplet className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1 text-[15px] font-bold">{t("health.blood")}</span>
            </div>
            <div className="mt-2">
              {d.records.length === 0 ? (
                <p className={`${appCard} p-4 text-sm`} style={{ color: appBrand.ink2 }}>{t("health.noBlood")}</p>
              ) : (
                <div className={`${appCard} divide-y divide-slate-100`}>
                  {d.records.map((r) => (
                    <div key={`${r.key}-${r.at}`} className="flex items-baseline justify-between px-4 py-2.5">
                      <span className="text-sm" style={{ color: appBrand.ink2 }}>{r.label || r.key}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: appBrand.ink1 }}>
                        {r.value}{r.unit ? ` ${r.unit}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {d === null && <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("home.failed")}</p>}
    </div>
  );
}
