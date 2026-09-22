"use client";

// The customer's published action plan — cards and dropdowns on screen, a
// complete multi-page layout in print (see PlanView).

import { Suspense, useEffect, useState } from "react";
import BackLink from "@/app/components/hc/BackLink";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PlanView from "@/app/components/hc/PlanView";
import type { ActionPlan } from "@/lib/hc/types";

export default function PlanPage() {
  return <Suspense><PlanPageInner /></Suspense>;
}

function PlanPageInner() {
  const router = useRouter();
  const journey = useSearchParams().get("journey");
  const [plan, setPlan] = useState<ActionPlan | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token;
      if (!t) { router.replace(`/account/login?next=${encodeURIComponent("/account/heilsuferd/aaetlun")}`); return; }
      const r = await fetch(`/api/hc/plan${journey ? `?journey=${encodeURIComponent(journey)}` : ""}`, { headers: { Authorization: `Bearer ${t}` } });
      const j = await r.json().catch(() => ({}));
      setPlan(j.plan ?? null);
      setName(j.client_name ?? null);
    })();
  }, [journey, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#ecfdf5] print:bg-white">
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:pt-28 print:max-w-none print:p-0">
        <BackLink href="/account/heilsuferd" label="Heilsuferðin" />
        <div className="mt-4">
          {plan === undefined && <p className="text-slate-500">Hleð…</p>}
          {plan === null && (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
              <p className="text-lg font-semibold text-slate-800">Áætlunin er ekki tilbúin enn</p>
              <p className="mt-1 text-slate-500">Hún birtist hér eftir viðtalið við hjúkrunarfræðinginn.</p>
            </div>
          )}
          {plan && <PlanView plan={plan} clientName={name} author={plan.created_by ?? null} />}
        </div>
      </div>
    </div>
  );
}
