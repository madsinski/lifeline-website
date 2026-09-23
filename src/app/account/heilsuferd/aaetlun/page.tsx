"use client";

// The customer's action plan. Two ways in: "Í dag" is where the plan gets
// done (tick actions, see the week, set something aside), "Áætlunin" is the
// whole plan as the nurse wrote it, with the print layout behind it.

import { Suspense, useCallback, useEffect, useState } from "react";
import BackLink from "@/app/components/hc/BackLink";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PlanView from "@/app/components/hc/PlanView";
import MyActions from "@/app/components/hc/MyActions";
import ResultSignals, { type FlaggedValue } from "@/app/components/hc/ResultSignals";
import ReportView from "@/app/components/hc/ReportView";
import type { Grunnheilsa, Signal as ReportSignal } from "@/lib/hc/grunnheilsa";
import type { ReportReference } from "@/lib/hc/knowledge";
import type { ActionPlan } from "@/lib/hc/types";
import type { ActionLog, ActionPref } from "@/lib/hc/adherence";

type Tab = "today" | "plan" | "report" | "results";

interface Loaded {
  journey_id: string;
  plan: ActionPlan | null;
  logs: ActionLog[];
  prefs: ActionPref[];
  flagged: FlaggedValue[];
  report: {
    report: Grunnheilsa;
    signals: Record<string, ReportSignal | null>;
    reference?: Record<string, ReportReference>;
    sex?: "m" | "f" | null;
  } | null;
}

export default function PlanPage() {
  return <Suspense><PlanPageInner /></Suspense>;
}

function PlanPageInner() {
  const router = useRouter();
  const journey = useSearchParams().get("journey");
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab | null>(null);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    return fetch(url, {
      ...init,
      headers: {
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }, []);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) { router.replace(`/account/login?next=${encodeURIComponent("/account/heilsuferd/aaetlun")}`); return; }
      const qs = journey ? `?journey=${encodeURIComponent(journey)}` : "";
      const [a, p] = await Promise.all([api(`/api/hc/actions${qs}`), api(`/api/hc/plan${qs}`)]);
      const aj = await a.json().catch(() => ({}));
      const pj = await p.json().catch(() => ({}));
      setName(pj.client_name ?? null);
      const loaded = a.ok ? { journey_id: aj.journey_id, plan: aj.plan ?? pj.plan ?? null, logs: aj.logs ?? [], prefs: aj.prefs ?? [], flagged: aj.flagged ?? [], report: aj.report ?? null } : null;
      setData(loaded);
      // Land on the plan when there is one, otherwise on the report.
      setTabState(loaded?.plan ? "today" : loaded?.report ? "report" : "today");
    })();
  }, [journey, router, api]);

  const plan = data?.plan ?? null;
  // The report often lands before the plan is written; show it either way.
  const hasSomething = !!plan || !!data?.report;
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "today", label: "Í dag", show: !!plan },
    { key: "plan", label: "Áætlunin", show: !!plan },
    { key: "report", label: "Skýrslan mín", show: !!data?.report },
    { key: "results", label: "Niðurstöður", show: !!data?.flagged.length && !data?.report },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#ecfdf5] print:bg-white">
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:pt-28 print:max-w-none print:p-0">
        <div className="print:hidden">
          <BackLink href="/account/heilsuferd" label="Heilsuferðin" />
        </div>

        {data === undefined && <p className="mt-4 text-slate-500">Hleð…</p>}

        {data !== undefined && !hasSomething && (
          <div className="mt-4 rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">Áætlunin er ekki tilbúin enn</p>
            <p className="mt-1 text-slate-500">Hún birtist hér eftir viðtalið við hjúkrunarfræðinginn.</p>
          </div>
        )}

        {hasSomething && data && (
          <>
            <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden" role="tablist">
              {tabs.filter((t) => t.show).map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTabState(t.key)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === t.key ? "border-emerald-600 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "today" && plan && (
                <div className="print:hidden">
                  <MyActions api={api} journeyId={data.journey_id} plan={plan} logs={data.logs} prefs={data.prefs} />
                </div>
              )}
              {tab === "report" && data.report && (
                <div className="print:hidden">
                  <ReportView report={data.report.report} signals={data.report.signals}
                    reference={data.report.reference} sex={data.report.sex} audience="client" />
                  <p className="mt-4 px-1 text-xs leading-relaxed text-slate-500">
                    Þetta er heilsufarsskýrslan þín í einfaldaðri mynd. Læknir fer yfir niðurstöðurnar með þér og
                    fullbúna skýrslan er í sjúklingagáttinni.
                  </p>
                </div>
              )}
              {tab === "results" && (
                <div className="print:hidden">
                  <ResultSignals flagged={data.flagged} />
                </div>
              )}
              {tab === "plan" && plan && <PlanView plan={plan} clientName={name} author={plan.created_by ?? null} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
