"use client";

// A measurement that opens.
//
// MyHealthScreen.tsx:78-115 defines what an expanded row carries: a plain
// description of what the value measures, the reference ranges, what moves
// it in each direction, what a composite score is made of, and the earlier
// measurements. All of that already sits in hc_knowledge (61 active rows)
// and loadReport already returns it per item — the rows just never opened.
//
// Collapsed, a row is one line. That is deliberate: a report is thirty-odd
// values, and expanding them all by default is how people stop reading.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "./../useT";
import { appBrand, appCard } from "./../ui";

export interface Band {
  label: string; tone: string; min: number | null; max: number | null;
  sex: "m" | "f" | null; note: string | null;
}
export interface Reference {
  title: string; summary: string; unit: string | null; higherBetter: boolean | null;
  bands: Band[]; improves: string[]; worsens: string[]; components: string[];
}
export interface Metric {
  key: string; title: string; value: number; unit: string;
  level: "green" | "yellow" | "red" | null; reportWord: string | null;
  advice: string[]; trend: { date: string; value: number }[];
  recommendations: { component: string; text: string; priority: string; kind?: string; moduleKey?: string | null }[];
  reference: Reference | null;
}

const DOT: Record<string, string> = {
  red: appBrand.error, yellow: appBrand.accent, green: appBrand.primary,
};
/** hc_knowledge uses its own tone words, not the traffic-light ones. */
const TONE: Record<string, string> = {
  good: appBrand.primary, watch: appBrand.accent, high: appBrand.error,
  low: appBrand.error, bad: appBrand.error,
};

/**
 * The reference ranges as a bar, with a marker where the value sits.
 *
 * Bands can be open-ended (no min on the first, no max on the last), so the
 * bar's extents come from the bands that do have numbers, widened to include
 * the value itself — otherwise a reading outside every band would have
 * nowhere to sit.
 */
function BandBar({ bands, value }: { bands: Band[]; value: number }) {
  const nums = bands.flatMap((b) => [b.min, b.max]).filter((n): n is number => n != null);
  if (nums.length === 0) return null;
  const lo = Math.min(...nums, value);
  const hi = Math.max(...nums, value);
  const span = hi - lo || 1;
  const pos = (n: number) => ((n - lo) / span) * 100;

  return (
    <div className="mt-1.5">
      <div className="relative h-2 overflow-hidden rounded-full" style={{ background: appBrand.cardAlt }}>
        {bands.map((b, i) => {
          const from = pos(b.min ?? lo);
          const to = pos(b.max ?? hi);
          return (
            <span key={i} className="absolute inset-y-0"
              style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%`, background: TONE[b.tone] ?? appBrand.ink4, opacity: 0.85 }} />
          );
        })}
        {/* Where the person actually is. */}
        <span className="absolute inset-y-0 w-0.5 rounded"
          style={{ left: `calc(${pos(value)}% - 1px)`, background: appBrand.ink1 }} aria-hidden />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {bands.map((b, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px]" style={{ color: appBrand.ink2 }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[b.tone] ?? appBrand.ink4 }} aria-hidden />
            {b.label}
            {b.min != null || b.max != null ? (
              <span style={{ color: appBrand.ink3 }}>
                {b.min != null && b.max != null ? ` ${b.min}–${b.max}` : b.min != null ? ` ≥${b.min}` : ` <${b.max}`}
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function MetricRow({ m }: { m: Metric }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const r = m.reference;
  const canOpen = Boolean(r || m.recommendations.length || m.advice.length || m.trend.length > 1);

  return (
    <div className={appCard}>
      <button type="button" onClick={() => canOpen && setOpen(!open)} aria-expanded={canOpen ? open : undefined}
        disabled={!canOpen}
        className="flex w-full items-baseline gap-2 p-4 text-left disabled:cursor-default">
        <span className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-full"
          style={{ background: DOT[m.level ?? "green"] ?? appBrand.ink4 }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold" style={{ color: appBrand.ink1 }}>{m.title}</span>
          {m.reportWord && <span className="block text-xs" style={{ color: appBrand.ink2 }}>{m.reportWord}</span>}
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: appBrand.ink1 }}>
          {m.value}{m.unit ? ` ${m.unit}` : ""}
        </span>
        {canOpen && (
          <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`}
            style={{ color: appBrand.ink3 }} aria-hidden />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-3" style={{ borderTopColor: appBrand.hairline }}>
          {r?.summary && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("ex.what")}</p>
              <p className="text-sm leading-snug" style={{ color: appBrand.ink2 }}>{r.summary}</p>
            </div>
          )}

          {r && r.bands.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("ex.ranges")}</p>
              <BandBar bands={r.bands} value={m.value} />
            </div>
          )}

          {m.trend.length > 1 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("ex.trend")}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {m.trend.map((p) => (
                  <span key={p.date} className="text-xs tabular-nums" style={{ color: appBrand.ink2 }}>
                    {p.date.slice(0, 10)}: <strong style={{ color: appBrand.ink1 }}>{p.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {r && r.components.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("ex.components")}</p>
              <p className="text-xs leading-snug" style={{ color: appBrand.ink2 }}>{r.components.join(" · ")}</p>
            </div>
          )}

          {m.recommendations.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{t("rp.advice")}</p>
              <ul className="mt-1 space-y-1">
                {m.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: appBrand.ink2 }}>
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: DOT[rec.priority] ?? appBrand.ink4 }} aria-hidden />
                    <span>
                      <strong style={{ color: appBrand.ink1 }}>{rec.component}</strong> — {rec.text}
                      {/* A referral must never read like a habit to adopt. */}
                      {rec.kind === "action" && (
                        <span className="ml-1 whitespace-nowrap rounded-full px-1.5 text-[9px] font-bold uppercase"
                          style={{ background: `${appBrand.primary}1a`, color: appBrand.primaryDark }}>
                          {t("rec.action")}
                        </span>
                      )}
                      {rec.kind === "referral" && (
                        <span className="ml-1 whitespace-nowrap rounded-full px-1.5 text-[9px] font-bold uppercase"
                          style={{ background: `${appBrand.error}1a`, color: appBrand.error }}>
                          {t("rec.referral")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r && (r.improves.length > 0 || r.worsens.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {r.improves.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.primaryDark }}>{t("ex.improves")}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {r.improves.map((x, i) => (
                      <li key={i} className="text-xs leading-snug" style={{ color: appBrand.ink2 }}>· {x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {r.worsens.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.error }}>{t("ex.worsens")}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {r.worsens.map((x, i) => (
                      <li key={i} className="text-xs leading-snug" style={{ color: appBrand.ink2 }}>· {x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
