"use client";

// "Aðgangur": the account, inside the heilsuferð. Everything that used to be
// on "Mínar síður" and still matters — personal details, sign-in (password,
// PIN, sign-out), calendar, reminders, payments and receipts, signed
// documents, privacy and data requests, company access, deleting the account.
// Lives under /app so it is reachable whatever the site gate.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import JourneyNav, { JourneyHeader } from "@/app/components/hc/JourneyNav";
import SettingsCard from "@/app/components/hc/SettingsCard";
import SetupFlow from "@/app/components/hc/SetupFlow";
import TrackChoice from "@/app/components/hc/TrackChoice";
import InstallGuide from "@/app/components/hc/InstallGuide";
import ReportUpload from "@/app/components/hc/ReportUpload";
import BillingPanel from "@/app/components/BillingPanel";
import ContextSwitcher from "@/app/components/ContextSwitcher";
import SignedDocumentsList from "@/app/account/SignedDocumentsList";
import DataPrivacyPanel from "@/app/components/account/DataPrivacyPanel";
import { DeleteAccountCard, PasswordCard, ProfileCard, SignOutButton } from "@/app/components/account/AccountCards";
import { hcPage } from "@/app/components/hc/ui";
import * as cache from "@/lib/hc/client-cache";

export default function AdgangurPage() {
  return <Suspense><Adgangur /></Suspense>;
}

const card = "rounded-3xl bg-hc-surface p-5 shadow-sm ring-1 ring-slate-200 sm:p-6";

function Adgangur() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  // Seeded from the cache so the nav is there on the first paint when the
  // participant has come from the plan — the other pages prefetch this.
  const [hasPlan, setHasPlan] = useState(
    () => !!cache.peek<{ has_plan?: boolean }>("/api/hc/journey/exists")?.body?.has_plan);
  /* Which route this journey is on, for "Skipta um leið" — offered only
     while it can still change (not paid, not an employer-paid check). */
  const [route, setRoute] = useState<{ entry: string | null; paid: boolean } | null>(null);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData)
    // A multipart boundary is part of the Content-Type; naming the type
    // without one leaves the body unparseable on the server.
    ? { "Content-Type": "application/json" } : {}) } });
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace(`/account/login?next=${encodeURIComponent("/app/adgangur")}`); return; }
      setUserId(data.session.user.id);
      const e = await cache.load(api, "/api/hc/journey/exists");
      const eb = e.body as { exists?: boolean; has_plan?: boolean; entry?: string | null; paid?: boolean };
      setHasPlan(!!eb.has_plan);
      setRoute(eb.exists ? { entry: eb.entry ?? null, paid: !!eb.paid } : null);
      // Going back to the plan should be instant, so warm what it reads.
      cache.prefetch(api, ["/api/hc/actions", "/api/hc/plan"]);
    })();
  }, [api, router]);

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        <JourneyHeader />
        {hasPlan && <JourneyNav active="account" />}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-2xl font-bold text-hc-ink sm:text-3xl">Stillingar</h1>
          {userId && <SignOutButton />}
        </div>

        {/* The heading and the way back are up already; the cards need the
            session, so they are the only part that waits. */}
        {!userId && (
          <div className="space-y-4" aria-busy="true" aria-label="Hleð aðgangi">
            <div className="h-28 rounded-3xl hc-shimmer" />
            <div className="h-40 rounded-3xl hc-shimmer" />
            <div className="h-28 rounded-3xl hc-shimmer" />
          </div>
        )}
        {userId && (<>

        <ProfileCard />

        <section className={card} aria-labelledby="acc-login">
          <h2 id="acc-login" className="text-lg font-bold text-hc-ink">Innskráning</h2>
          <div className="mt-3 space-y-4">
            <PasswordCard />
          </div>
        </section>

        {/* The onboarding, reviewable.
            It runs at the profile step and then was gone for good, which
            left the four things it sets up — coach, dagatal, ábyrgðarfélagi,
            áminning — with no single place to go and look at them again.
            Two of them, NudgeSettings and PartnerCard, used to sit loose on
            this page further down; they are inside this card now rather than
            on it twice, which also takes three full-width cards off a page
            that was the longest in the app. */}
        <SetupFlow api={api} place="settings" />

        {route && !route.paid && route.entry !== "b2b" && (
          <section className={card} aria-labelledby="acc-route">
            <h2 id="acc-route" className="text-lg font-bold text-hc-ink">Skipta um leið</h2>
            <p className="mt-1 text-sm text-hc-ink-2">
              Þú ert núna í {route.entry === "coach" || route.entry === "app" ? "þjálfun í appinu" : "heilsufarsskoðun"}.
            </p>
            <div className="mt-3">
              <TrackChoice api={api} bare onDone={async () => {
                cache.invalidate("/api/hc/journey");
                router.push("/app?ferd=1");
              }} />
            </div>
          </section>
        )}

        <SettingsCard />
        <InstallGuide />
        {/* A permanent home for this, independent of journey stage.
            Everywhere else it appears is conditional — the report tab needs
            a report, the first-run card disappears once there is one — so
            somebody who simply has a new PDF had nowhere reliable to go. */}
        <ReportUpload api={api} onDone={() => { /* nothing on this page reads it */ }}
          heading="Hlaða upp skýrslu"
          blurb="Sóttu Grunnheilsa-skýrsluna þína í sjúklingagáttina og settu hana hér inn. Þú getur gert þetta hvenær sem er, líka eftir endurmat." />
        <section className={card} aria-labelledby="acc-pay">
          <h2 id="acc-pay" className="mb-3 text-lg font-bold text-hc-ink">Greiðslur og kvittanir</h2>
          <BillingPanel ownerType="client" ownerId={userId} />
        </section>

        <section className={card} aria-labelledby="acc-docs">
          <h2 id="acc-docs" className="mb-3 text-lg font-bold text-hc-ink">Undirrituð skjöl</h2>
          <SignedDocumentsList />
        </section>

        <section className={card} aria-labelledby="acc-privacy">
          <h2 id="acc-privacy" className="mb-3 text-lg font-bold text-hc-ink">Persónuvernd</h2>
          <DataPrivacyPanel userId={userId} />
          <div className="mt-5 border-t border-hc-hairline pt-4"><DeleteAccountCard /></div>
        </section>

        <ContextSwitcher current="personal" />
        </>)}
      </div>
    </div>
  );
}
