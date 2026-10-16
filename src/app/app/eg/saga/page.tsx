"use client";

// Vikan þín — what the participant has logged over the last fortnight:
// workouts (including what they did instead of a planned session), meals
// and habits, day by day. Reached from Ég. Own data only (/api/hc/activity).

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import JourneyNav, { JourneyHeader } from "@/app/components/hc/JourneyNav";
import BackLink from "@/app/components/hc/BackLink";
import ActivityLog from "@/app/components/hc/ActivityLog";
import { PageHero } from "@/app/components/account/ui";
import { hcPage } from "@/app/components/hc/ui";

export default function Page() {
  return <Suspense><Saga /></Suspense>;
}

function Saga() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined) } });
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace(`/account/login?next=${encodeURIComponent("/app/eg/saga")}`); return; }
      setTimeout(() => setReady(true), 0);
    })();
  }, [router]);

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        <JourneyHeader />
        <div className="sm:mb-4"><JourneyNav active="me" /></div>
        <BackLink href="/app/eg" label="Til baka" />

        <PageHero kicker="Ég" title="Vikan þín"
          body="Það sem þú hefur skráð síðustu 14 daga. Þegar þú gerir eitthvað annað en áætlunin segir telst það líka með." />

        {!ready ? (
          <div className="h-80 rounded-hc-card hc-shimmer" aria-busy="true" aria-label="Hleð" />
        ) : (
          <ActivityLog api={api} path="/api/hc/activity?days=14" audience="participant" title="Síðustu 14 dagar" />
        )}
      </div>
    </div>
  );
}
