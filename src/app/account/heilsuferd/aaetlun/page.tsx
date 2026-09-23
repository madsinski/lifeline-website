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
import type { ActionPlan } from "@/lib/hc/types";
import type { ActionLog, ActionPref } from "@/lib/hc/adherence";

type Tab = "today" | "plan" | "results";

interface Loaded {
  journey_id: string;
  plan: ActionPlan | null;
  logs: ActionLog[];
  prefs: ActionPref[];
  flagged: FlaggedValue[];
}

export default function PlanPage() {
  return <Suspense><PlanPageInner /></Suspense>;
}

function PlanPageInner() {
  const router = useRouter();
  const journey = useSearchParams().get("journey");
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("today");

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
      setData(a.ok ? { journey_id: aj.journey_id, plan: aj.plan ?? pj.plan ?? null, logs: aj.logs ?? [], prefs: aj.prefs ?? [], flagged: aj.flagged ?? [] } : null);
    })();
  }, [journey, router, api]);

  const plan = data?.plan ?? null;
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "today", label: "Í dag", show: !!plan },
    { key: "plan", label: "Áætlunin", show: !!plan },
    { key: "results", label: "Niðurstöður", show: !!data?.flagged.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#ecfdf5] print:bg-white">
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:pt-28 print:max-w-none print:p-0">
        <div className="print:hidden">
          <BackLink href="/account/heilsuferd" label="Heilsuferðin" />
        </div>

        {data === undefined && <p className="mt-4 text-slate-500">Hleð…</p>}

        {data !== undefined && !plan && (
          <div className="mt-4 rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">Áætlunin er ekki tilbúin enn</p>
            <p className="mt-1 text-slate-500">Hún birtist hér eftir viðtalið við hjúkrunarfræðinginn.</p>
          </div>
        )}

        {plan && data && (
          <>
            <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden" role="tablist">
              {tabs.filter((t) => t.show).map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                  className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === t.key ? "border-emerald-600 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "today" && (
                <div className="print:hidden">
                  <MyActions api={api} journeyId={data.journey_id} plan={plan} logs={data.logs} prefs={data.prefs} />
                </div>
              )}
              {tab === "results" && (
                <div className="print:hidden">
                  <ResultSignals flagged={data.flagged} />
                </div>
              )}
              {tab === "plan" && <PlanView plan={plan} clientName={name} author={plan.created_by ?? null} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
