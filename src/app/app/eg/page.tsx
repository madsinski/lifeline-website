"use client";

// Ég — everything that is about the participant rather than about today.
//
// The fifth tab. The report, the journey map, fræðsla, notifications and the
// settings were all real destinations, but they sat behind a "Meira" menu
// that differed between phone and desktop, and the journey itself was only
// reachable through it. One page of plain links instead: each is one tap
// from the bar, and none of them competes with Í dag for room.

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, ChevronRight, Compass, ExternalLink, FileHeart, Settings, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import JourneyNav, { JourneyHeader } from "@/app/components/hc/JourneyNav";
import { useNotifications } from "@/app/components/hc/Notifications";
import { badgeClass } from "@/app/components/hc/Badge";
import { PageHero, accountCard } from "@/app/components/account/ui";
import { hcPage } from "@/app/components/hc/ui";
import * as cache from "@/lib/hc/client-cache";

export default function EgPage() {
  return <Suspense><Eg /></Suspense>;
}

function Row({ href, Icon, title, body, count }: {
  href: string; Icon: LucideIcon; title: string; body: string; count?: number;
}) {
  return (
    <li>
      <Link href={href}
        className="flex min-h-16 items-center gap-4 px-4 py-3.5 transition hover:bg-hc-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hc-brand sm:px-5">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-hc-element bg-hc-brand-surface text-hc-brand-text">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold text-hc-ink">
            {title}
            {!!count && (
              <span className="relative inline-flex">
                <span className="absolute inset-0 rounded-full bg-hc-bad-ink/50 motion-safe:animate-ping" aria-hidden />
                <span className={`${badgeClass("count")} relative`}>{count > 9 ? "9+" : count}<span className="sr-only"> {count === 1 ? "ný tilkynning" : "nýjar tilkynningar"}</span></span>
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-hc-ink-2">{body}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-hc-ink-3" aria-hidden />
      </Link>
    </li>
  );
}

function Eg() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined) } });
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace(`/account/login?next=${encodeURIComponent("/app/eg")}`); return; }
      setReady(true);
      const seed = cache.peek<{ client_name?: string | null }>("/api/hc/plan")?.body?.client_name;
      if (seed) setName(seed);
      // Warm the pages behind these links.
      cache.prefetch(api, ["/api/hc/journey", "/api/hc/plan", "/api/hc/lectures"], 60_000);
    })();
  }, [api, router]);

  const { unread } = useNotifications(api);

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        <JourneyHeader />
        <div className="sm:mb-4"><JourneyNav active="me" /></div>

        <PageHero kicker="Heilsuferðin" title="Ég"
          body={`${name ? `Hæ ${name.split(" ")[0]}. ` : ""}Skýrslan þín, ferðin í heild, fræðslan og stillingarnar.`} />

        {!ready ? (
          <div className="h-80 rounded-hc-card hc-shimmer" aria-busy="true" aria-label="Hleð" />
        ) : (
          <>
            <section aria-labelledby="eg-mine" className={`${accountCard} overflow-hidden`}>
              <h2 id="eg-mine" className="sr-only">Mitt</h2>
              <ul className="divide-y divide-hc-hairline">
                <Row href="/app/aaetlun?tab=report" Icon={FileHeart} title="Skýrslan og mælingar"
                  body="Niðurstöðurnar þínar, mælingar milli skýrslna og ný skýrsla." />
                <Row href="/app?ferd=1" Icon={Compass} title="Heilsuferðin"
                  body="Skrefin, fyrri áætlanir, virkjunarkóði og umsóknir til stéttarfélags." />
                <Row href="/app/fraedsla" Icon={BookOpen} title="Fræðsla"
                  body="Fyrirlestrarnir í áætluninni þinni og allt safnið." />
                <Row href="/app/tilkynningar" Icon={Bell} title="Tilkynningar" count={unread}
                  body="Á döfinni og það sem hefur borist." />
              </ul>
            </section>

            <section aria-labelledby="eg-account" className={`${accountCard} overflow-hidden`}>
              <h2 id="eg-account" className="sr-only">Aðgangur</h2>
              <ul className="divide-y divide-hc-hairline">
                <Row href="/app/adgangur" Icon={Settings} title="Stillingar og áskrift"
                  body="Upplýsingar, innskráning, áminningar, dagatal, áskrift og greiðslur." />
                <Row href="/account" Icon={ExternalLink} title="Mínar síður"
                  body="Aðgangurinn þinn á vef Lifeline." />
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
