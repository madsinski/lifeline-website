"use client";

// "Stillingar og áskrift": the account, inside the heilsuferð. Everything
// that used to be on "Mínar síður" and still matters — personal details,
// sign-in (password, PIN, sign-out), calendar, reminders, the subscription
// (#askrift, the one place it is sold and cancelled), payments and receipts,
// signed documents, privacy and data requests, company access, deleting the
// account. Reached from Ég; lives under /app so the site gate never hides it.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import JourneyNav, { JourneyHeader } from "@/app/components/hc/JourneyNav";
import SettingsCard from "@/app/components/hc/SettingsCard";
import SetupFlow from "@/app/components/hc/SetupFlow";
import NotifyPrefsCard from "@/app/components/hc/NotifyPrefsCard";
import TrackChoice from "@/app/components/hc/TrackChoice";
import InstallGuide from "@/app/components/hc/InstallGuide";
import ReportUpload from "@/app/components/hc/ReportUpload";
import BillingPanel from "@/app/components/BillingPanel";
import ContextSwitcher from "@/app/components/ContextSwitcher";
import SignedDocumentsList from "@/app/account/SignedDocumentsList";
import DataPrivacyPanel from "@/app/components/account/DataPrivacyPanel";
import { DeleteAccountCard, PasswordCard, ProfileCard, SignOutButton } from "@/app/components/account/AccountCards";
import { hcPage } from "@/app/components/hc/ui";
import { SubscriptionPanel } from "@/app/components/hc/Paywall";
import { PageHero, SectionCard } from "@/app/components/account/ui";
import * as cache from "@/lib/hc/client-cache";

export default function AdgangurPage() {
  return <Suspense><Adgangur /></Suspense>;
}

function Adgangur() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  /* Which route this journey is on, for "Skipta um leið" — offered only
     while it can still change (not paid, not an employer-paid check). */
  const [route, setRoute] = useState<{ entry: string | null; paid: boolean } | null>(null);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData)
    // A multipart boundary is part of the Content-Type; naming the type
    // without one leaves the body unparseable on the server.
    ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) } });
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        /* Keep #askrift: the trial banner and the journey link straight to
           the subscription card, and the login's next carries the fragment
           (encoded as %23) through to router.push afterwards. */
        const target = window.location.hash === "#askrift" ? "/app/adgangur#askrift" : "/app/adgangur";
        router.replace(`/account/login?next=${encodeURIComponent(target)}`);
        return;
      }
      setUserId(data.session.user.id);
      const e = await cache.load(api, "/api/hc/journey/exists").catch(() => null);
      const eb = (e && e.status < 400 ? e.body : {}) as { exists?: boolean; has_plan?: boolean; entry?: string | null; paid?: boolean };
      setRoute(eb.exists ? { entry: eb.entry ?? null, paid: !!eb.paid } : null);
      // Going back to the plan should be instant, so warm what it reads.
      cache.prefetch(api, ["/api/hc/actions", "/api/hc/plan"]);
    })();
  }, [api, router]);

  /* The trial banner and the journey link to #askrift. The cards render
     after the session check, so the browser's own jump on load found
     nothing to jump to. */
  useEffect(() => {
    if (!userId || typeof window === "undefined" || window.location.hash !== "#askrift") return;
    const t = setTimeout(() => document.getElementById("askrift")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    return () => clearTimeout(t);
  }, [userId]);

  const coaching = route?.entry === "coach" || route?.entry === "app";

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        <JourneyHeader />
        <div className="sm:mb-4"><JourneyNav active="account" /></div>
        <PageHero kicker="Ég" title="Stillingar og áskrift"
          body="Upplýsingarnar þínar, innskráning, áminningar, áskrift og greiðslur.">
          {userId && <div className="mt-4"><SignOutButton /></div>}
        </PageHero>

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

        <SectionCard id="acc-login" title="Innskráning">
          <div className="space-y-4">
            <PasswordCard />
          </div>
        </SectionCard>

        {/* The onboarding, reviewable.
            It runs at the profile step and then was gone for good, which
            left the four things it sets up — coach, dagatal, ábyrgðarfélagi,
            áminning — with no single place to go and look at them again.
            Two of them, NudgeSettings and PartnerCard, used to sit loose on
            this page further down; they are inside this card now rather than
            on it twice, which also takes three full-width cards off a page
            that was the longest in the app. */}
        <SectionCard id="tilkynningar" title="Tilkynningar frá Lifeline">
          <NotifyPrefsCard api={api} />
        </SectionCard>

        <SetupFlow api={api} place="settings" />

        {route && !route.paid && route.entry !== "b2b" && (
          <SectionCard id="acc-route" title="Skipta um leið"
            description={`Þú ert núna í ${coaching ? "þjálfun í appinu" : "heilsufarsskoðun"}.`}>
            <div>
              <TrackChoice api={api} bare onDone={async () => {
                cache.invalidate("/api/hc/journey");
                router.push("/app?ferd=1");
              }} />
            </div>
          </SectionCard>
        )}

        <SettingsCard />
        <InstallGuide />
        {/* A permanent home for this, independent of journey stage.
            Everywhere else it appears is conditional — the report tab needs
            a report, the first-run card disappears once there is one — so
            somebody who simply has a new PDF had nowhere reliable to go. */}
        {/* Worded for the track: the coaching track never had a nurse or a
            Grunnheilsa report promised to it, so it is offered as an
            option rather than an errand. */}
        <ReportUpload api={api} onDone={() => { /* nothing on this page reads it */ }}
          heading={coaching ? "Áttu skýrslu úr heilsufarsskoðun?" : "Hlaða upp skýrslu"}
          blurb={coaching
            ? "Ef þú hefur farið í heilsufarsskoðun hjá Lifeline getur þú sett Grunnheilsu-skýrsluna (PDF úr sjúklingagáttinni) hér inn. Þess þarf ekki til að nota appið."
            : "Sæktu Grunnheilsu-skýrsluna þína í sjúklingagáttina og settu hana hér inn. Þú getur gert þetta hvenær sem er, líka eftir endurmat."} />

        <SubscriptionPanel api={api} />

        <SectionCard id="acc-pay" title="Greiðslur og kvittanir">
          <BillingPanel ownerType="client" ownerId={userId} />
        </SectionCard>

        <SectionCard id="acc-docs" title="Undirrituð skjöl">
          <SignedDocumentsList />
        </SectionCard>

        <SectionCard id="acc-privacy" title="Persónuvernd">
          <DataPrivacyPanel userId={userId} />
          <div className="mt-5 border-t border-hc-hairline pt-4"><DeleteAccountCard /></div>
        </SectionCard>

        <ContextSwitcher current="personal" />
        </>)}
      </div>
    </div>
  );
}
