"use client";

// Tilkynningar — the full list.
//
// Opening the page clears the dot for things that are merely unseen
// (messages, kveðjur). Things waiting on an answer — a report to confirm,
// a retention question — stay marked, because looking at them is not
// answering them.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import JourneyNav from "@/app/components/hc/JourneyNav";
import { NotificationList, useNotifications } from "@/app/components/hc/Notifications";
import { hcPage } from "@/app/components/hc/ui";

export default function Page() {
  return <Suspense><Tilkynningar /></Suspense>;
}

function Tilkynningar() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    return fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/account/login?next=/account/heilsuferd/tilkynningar"); return; }
      setTimeout(() => setReady(true), 0);
    })();
  }, [router]);

  const { items, markSeen } = useNotifications(api);

  // Seen on open, once. A ref rather than state: this guards an effect and
  // nothing renders from it, so setting state here would only cost a
  // render — which is what the lint rule is about.
  const seen = useRef(false);
  useEffect(() => {
    if (!ready || seen.current) return;
    seen.current = true;
    void markSeen();
  }, [ready, markSeen]);

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        <div className="sm:mb-4"><JourneyNav active="notifications" /></div>
        <h1 className="mb-4 text-2xl font-bold text-hc-ink sm:text-3xl">Tilkynningar</h1>
        {ready
          ? <NotificationList items={items} />
          : <div className="h-40 animate-pulse rounded-hc-card bg-white" aria-hidden />}
      </div>
    </div>
  );
}
