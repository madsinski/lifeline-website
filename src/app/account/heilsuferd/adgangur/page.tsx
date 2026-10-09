"use client";

// "Aðgangur": the account, inside the heilsuferð. Everything that used to be
// on "Mínar síður" and still matters — personal details, sign-in (password,
// PIN, sign-out), calendar, reminders, payments and receipts, signed
// documents, privacy and data requests, company access, deleting the account.
// Lives under /account/heilsuferd so it is reachable whatever the site gate.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import JourneyNav from "@/app/components/hc/JourneyNav";
import SettingsCard from "@/app/components/hc/SettingsCard";
import NudgeSettings from "@/app/components/hc/NudgeSettings";
import PartnerCard from "@/app/components/hc/PartnerCard";
import ReportUpload from "@/app/components/hc/ReportUpload";
import BillingPanel from "@/app/components/BillingPanel";
import ContextSwitcher from "@/app/components/ContextSwitcher";
import SignedDocumentsList from "@/app/account/SignedDocumentsList";
import DataPrivacyPanel from "@/app/components/account/DataPrivacyPanel";
import { DeleteAccountCard, PasswordCard, ProfileCard, SignOutButton } from "@/app/components/account/AccountCards";
import { hcPage } from "@/app/components/hc/ui";
import BackLink from "@/app/components/hc/BackLink";
import * as cache from "@/lib/hc/client-cache";

export default function AdgangurPage() {
  return <Suspense><Adgangur /></Suspense>;
}

const card = "rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6";

function Adgangur() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  // Seeded from the cache so the nav is there on the first paint when the
  // participant has come from the plan — the other pages prefetch this.
  const [hasPlan, setHasPlan] = useState(
    () => !!cache.peek<{ has_plan?: boolean }>("/api/hc/journey/exists")?.body?.has_plan);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}) } });
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace(`/account/login?next=${encodeURIComponent("/account/heilsuferd/adgangur")}`); return; }
      setUserId(data.session.user.id);
      const e = await cache.load(api, "/api/hc/journey/exists");
      setHasPlan(!!(e.body as { has_plan?: boolean }).has_plan);
      // Going back to the plan should be instant, so warm what it reads.
      cache.prefetch(api, ["/api/hc/actions", "/api/hc/plan"]);
    })();
  }, [api, router]);

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        {/* Never gated on anything. The session check below is a round trip,
            and a participant with no published plan still has a journey to
            get back to — gating this on hasPlan left them with no way out of
            the page at all. */}
        <div className="mb-3 print:hidden">
          <BackLink
            href={hasPlan ? "/account/heilsuferd/aaetlun?tab=today" : "/account/heilsuferd"}
            label="Heilsuferðin" />
        </div>
        {hasPlan && <JourneyNav active="account" />}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-2xl font-bold text-slate-900 sm:text-3xl">Aðgangurinn minn</h1>
          {userId && <SignOutButton />}
        </div>

        {/* The heading and the way back are up already; the cards need the
            session, so they are the only part that waits. */}
        {!userId && (
          <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Hleð aðgangi">
            <div className="h-28 rounded-3xl bg-slate-200/70" />
            <div className="h-40 rounded-3xl bg-slate-200/60" />
            <div className="h-28 rounded-3xl bg-slate-200/50" />
          </div>
        )}
        {userId && (<>

        <ProfileCard />

        <section className={card} aria-labelledby="acc-login">
          <h2 id="acc-login" className="text-lg font-bold text-slate-900">Innskráning</h2>
          <div className="mt-3 space-y-4">
            <PasswordCard />
          </div>
        </section>

        <SettingsCard />
        <NudgeSettings api={api} />
        {/* A permanent home for this, independent of journey stage.
            Everywhere else it appears is conditional — the report tab needs
            a report, the first-run card disappears once there is one — so
            somebody who simply has a new PDF had nowhere reliable to go. */}
        <ReportUpload api={api} onDone={() => { /* nothing on this page reads it */ }}
          heading="Hlaða upp skýrslu"
          blurb="Sóttu Grunnheilsa-skýrsluna þína í sjúklingagáttina og settu hana hér inn. Þú getur gert þetta hvenær sem er, líka eftir endurmat." />
        <PartnerCard api={api} />

        <section className={card} aria-labelledby="acc-pay">
          <h2 id="acc-pay" className="mb-3 text-lg font-bold text-slate-900">Greiðslur og kvittanir</h2>
          <BillingPanel ownerType="client" ownerId={userId} />
        </section>

        <section className={card} aria-labelledby="acc-docs">
          <h2 id="acc-docs" className="mb-3 text-lg font-bold text-slate-900">Undirrituð skjöl</h2>
          <SignedDocumentsList />
        </section>

        <section className={card} aria-labelledby="acc-privacy">
          <h2 id="acc-privacy" className="mb-3 text-lg font-bold text-slate-900">Persónuvernd</h2>
          <DataPrivacyPanel userId={userId} />
          <div className="mt-5 border-t border-slate-100 pt-4"><DeleteAccountCard /></div>
        </section>

        <ContextSwitcher current="personal" />
        </>)}
      </div>
    </div>
  );
}
