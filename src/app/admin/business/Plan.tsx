"use client";

// Plan tab (admin/business) — business-plan attainment for the CEO:
// how many health checks / app subscribers we're lacking against the
// Excel business plan (encoded in src/lib/business-plan.ts), the
// valuation picture (DCF + EBITDA×10 milestones + attainment-adjusted
// live EV), and current investing capacity. Server logic in
// /api/admin/accounting/plan.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Pace {
  annual_target: number;
  monthly_target: number;
  months_elapsed: number;
  ytd_target: number;
  actual: number;
  lacking: number;
  attainment_pct: number | null;
  required_per_month_rest_of_year: number;
}

interface PlanData {
  year: number;
  plan_version: string;
  health_checks: Pace & { breakdown: { invoiced_b2b: number; b2c_paid: number; manual_offset: number } };
  subscribers: Pace & { breakdown: { in_system: number; manual_offset: number }; self_maintained_plan: number };
  valuation: {
    dcf: { pre_money_isk: number; wacc: number; sensitivity: Array<{ wacc: number; pre_money_isk: number }> };
    planned_raise: { seek_isk: number; post_money_isk: number; equity_offering_pct: number };
    ebitda_multiple: number;
    ev_milestones: Array<{ year: number; ev_isk: number; ebitda_isk: number }>;
    plan_ev_this_year: number;
    attainment_pct: number | null;
    live_ev_isk: number;
    total_shares: number;
    price_per_share_dcf: number | null;
    price_per_share_live: number | null;
    one_percent_dcf_isk: number;
    one_percent_live_isk: number;
  };
  investing: {
    cash_balance_isk: number;
    receivables_isk: number;
    other_liabilities_isk: number;
    doctor_accrued_isk: number;
    capacity_isk: number;
    monthly_overhead_burn_isk: number;
    runway_months: number | null;
  };
}

const isk = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;
const mkr = (n: number) => `${(n / 1_000_000).toLocaleString("is-IS", { maximumFractionDigits: 1 })} mkr.`;

const btn = "text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50";

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {hint ? <p className="text-xs text-gray-500 mt-0.5 mb-3">{hint}</p> : <div className="mb-3" />}
      {children}
    </div>
  );
}

function PaceCard({ title, hint, p, unit, extra }: {
  title: string; hint?: string; p: Pace; unit: string; extra?: React.ReactNode;
}) {
  const pct = p.attainment_pct ?? 0;
  const barPct = Math.min(Math.max(p.ytd_target > 0 ? (p.actual / p.annual_target) * 100 : 0, 0), 100);
  const ytdPct = Math.min((p.ytd_target / Math.max(p.annual_target, 1)) * 100, 100);
  return (
    <Card title={title} hint={hint}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-gray-900">{p.actual.toLocaleString("is-IS")}</span>
        <span className="text-sm text-gray-500">of {p.annual_target.toLocaleString("is-IS")} {unit} planned this year</span>
      </div>
      {/* Progress vs annual target, with a marker where YTD pace should be */}
      <div className="relative h-2.5 rounded-full bg-gray-100 mt-3 mb-1.5 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${barPct}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-gray-700/60" style={{ left: `${ytdPct}%` }} title="Where the plan says we should be today" />
      </div>
      <div className="text-xs text-gray-600 space-y-0.5">
        <div>
          YTD target <b>{p.ytd_target.toLocaleString("is-IS")}</b> ·{" "}
          {p.lacking > 0 ? (
            <span className="text-amber-600 font-semibold">lacking {p.lacking.toLocaleString("is-IS")} {unit}</span>
          ) : (
            <span className="text-emerald-700 font-semibold">ahead by {Math.abs(p.lacking).toLocaleString("is-IS")} {unit}</span>
          )}
          {p.attainment_pct != null ? <span className="text-gray-400"> · {pct}% of pace</span> : null}
        </div>
        <div>
          Plan pace {p.monthly_target.toLocaleString("is-IS")}/month · need{" "}
          <b>{p.required_per_month_rest_of_year.toLocaleString("is-IS")}/month</b> for the remaining {12 - p.months_elapsed} months to hit the year.
        </div>
        {extra}
      </div>
    </Card>
  );
}

export default function Plan() {
  const [data, setData] = useState<PlanData | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }, []);

  const load = useCallback(async () => {
    setErr("");
    try {
      const res = await authedFetch("/api/admin/accounting/plan");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  const editSetting = async (key: string, label: string, current: number) => {
    const v = prompt(`${label}:`, String(current));
    if (v === null) return;
    const value = Number(v.replace(/[. ]/g, "").replace(",", "."));
    if (!Number.isFinite(value)) { setErr("Not a number."); return; }
    setBusy(true);
    try {
      const res = await authedFetch("/api/admin/accounting/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (err) return <div className="px-8 py-6 text-sm text-red-600">{err}</div>;
  if (!data) return <div className="px-8 py-6 text-sm text-gray-400">Loading plan…</div>;

  const v = data.valuation;
  const inv = data.investing;

  return (
    <div className="px-8 pb-10 space-y-4">
      <p className="text-xs text-gray-400">
        Business plan {data.plan_version} · year {data.year} · targets from the Excel workbook (health check + coaching sheets, Snorri valuation, DCF).
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaceCard
          title="Health checks vs plan"
          hint="Actual = PayDay-invoiced assessments + paid B2C foundational bookings + manual offset for pre-platform work."
          p={data.health_checks}
          unit="checks"
          extra={
            <div className="text-[11px] text-gray-400 pt-1">
              Breakdown: {data.health_checks.breakdown.invoiced_b2b} invoiced B2B · {data.health_checks.breakdown.b2c_paid} B2C ·{" "}
              {data.health_checks.breakdown.manual_offset} manual offset{" "}
              <button className="text-emerald-700 hover:underline" disabled={busy}
                onClick={() => editSetting("healthchecks_offset", "Health checks done outside the platform (manual offset)", data.health_checks.breakdown.manual_offset)}>
                edit
              </button>
            </div>
          }
        />
        <PaceCard
          title="App subscribers vs plan"
          hint="App not launched yet — the plan already counts this year, so the gap shows what launch needs to recover."
          p={data.subscribers}
          unit="subscribers"
          extra={
            <div className="text-[11px] text-gray-400 pt-1">
              No subscription billing in the system yet — count is the manual offset ({data.subscribers.breakdown.manual_offset}){" "}
              <button className="text-emerald-700 hover:underline" disabled={busy}
                onClick={() => editSetting("subscribers_offset", "Subscribers not visible in the system (manual offset)", data.subscribers.breakdown.manual_offset)}>
                edit
              </button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Share value estimate"
          hint={`DCF pre-money at ${Math.round(v.dcf.wacc * 100)}% WACC, EV milestones at EBITDA × ${v.ebitda_multiple} (Snorri model), and a live EV = this year's plan EV scaled by health-check attainment. Heuristics, not a market price.`}
        >
          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
            <div>
              <div className="text-gray-400 mb-0.5">DCF pre-money</div>
              <div className="font-bold text-gray-900">{mkr(v.dcf.pre_money_isk)}</div>
              <div className="text-[11px] text-gray-500">1% = {isk(v.one_percent_dcf_isk)}{v.price_per_share_dcf ? ` · ${isk(v.price_per_share_dcf)}/share` : ""}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-0.5">Live EV ({data.year}, attainment-adjusted)</div>
              <div className="font-bold text-gray-900">{mkr(v.live_ev_isk)}</div>
              <div className="text-[11px] text-gray-500">
                {mkr(v.plan_ev_this_year)} plan × {v.attainment_pct ?? 0}% pace · 1% = {isk(v.one_percent_live_isk)}
                {v.price_per_share_live ? ` · ${isk(v.price_per_share_live)}/share` : ""}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-gray-500 mb-2">
            Plan EV milestones:{" "}
            {v.ev_milestones.map((m) => `${m.year}: ${mkr(m.ev_isk)}`).join(" · ")}
          </div>
          <div className="text-[11px] text-gray-500 mb-2">
            Planned raise: {mkr(v.planned_raise.seek_isk)} for {v.planned_raise.equity_offering_pct}% → post-money {mkr(v.planned_raise.post_money_isk)}.
          </div>
          <button className={btn} disabled={busy}
            onClick={() => editSetting("total_shares", "Total issued shares (for per-share pricing)", v.total_shares)}>
            {v.total_shares > 0 ? `Shares: ${v.total_shares.toLocaleString("is-IS")} — edit` : "Set share count for per-share pricing"}
          </button>
        </Card>

        <Card
          title="Investing capacity"
          hint="Cash + outstanding receivables − known liabilities − accrued unpaid doctor pay. Runway uses the current monthly overhead burn."
        >
          <div className="space-y-1.5 text-xs text-gray-700">
            <div className="flex justify-between">
              <span>
                Cash (Landsbankinn){" "}
                <button className="text-emerald-700 hover:underline" disabled={busy}
                  onClick={() => editSetting("cash_balance_isk", "Cash balance ISK (from the bank)", inv.cash_balance_isk)}>
                  edit
                </button>
              </span>
              <span className="font-medium">{isk(inv.cash_balance_isk)}</span>
            </div>
            <div className="flex justify-between">
              <span>+ Outstanding receivables (live)</span>
              <span className="font-medium">{isk(inv.receivables_isk)}</span>
            </div>
            <div className="flex justify-between">
              <span>
                − Known liabilities (Biody etc.){" "}
                <button className="text-emerald-700 hover:underline" disabled={busy}
                  onClick={() => editSetting("other_liabilities_isk", "Known liabilities ISK (Biody machines, unpaid nurse, …)", inv.other_liabilities_isk)}>
                  edit
                </button>
              </span>
              <span className="font-medium">−{isk(inv.other_liabilities_isk)}</span>
            </div>
            <div className="flex justify-between">
              <span>− Accrued unpaid doctor pay</span>
              <span className="font-medium">−{isk(inv.doctor_accrued_isk)}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-gray-100 font-bold text-gray-900">
              <span>Investing capacity</span>
              <span className={inv.capacity_isk < 0 ? "text-red-600" : "text-emerald-700"}>{isk(inv.capacity_isk)}</span>
            </div>
            <div className="text-[11px] text-gray-500">
              Overhead burn {isk(inv.monthly_overhead_burn_isk)}/month
              {inv.runway_months != null ? ` → ~${inv.runway_months.toLocaleString("is-IS")} months runway at zero income` : ""}.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
