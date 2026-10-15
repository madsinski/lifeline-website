"use client";

// Appið og þjálfun: one page for what used to be two ("Appið" and
// "Þjálfun"), which said the same thing in two places. What the app is, how
// to put it on the home screen, what is in it, how coaching works, and the
// two things to do next: open it, or subscribe.

import { Smartphone, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { COACHING_DEFAULTS_EN, COACHING_DEFAULTS_IS } from "@/lib/site-content/coaching";
import InstallGuide from "@/app/components/hc/InstallGuide";
import { ButtonLink, PageHero, SectionCard, accountInset } from "@/app/components/account/ui";
import AppFeatures from "../_components/AppFeatures";
import type { SectionProps } from "../_components/context";

export default function AppAndCoachingSection({ state: s, hrefFor }: SectionProps) {
  const { t, locale } = useI18n();
  const subscribed = !!s.subscription && s.subscription.tier !== "free-trial";

  // The coaching steps are read from the /coaching page's own content, in
  // the current locale, so this page and the one that sells coaching cannot
  // drift apart. Edit them on /admin/website.
  const cc = locale === "en" ? COACHING_DEFAULTS_EN : COACHING_DEFAULTS_IS;
  const steps = [1, 2, 3, 4]
    .map((n) => ({ n, title: String(cc[`h${n}_title`] ?? ""), desc: String(cc[`h${n}_desc`] ?? "") }))
    .filter((x) => x.title);

  return (
    <>
      <PageHero icon={Smartphone}
        kicker={t("acct.p.lifeline-appid", "Lifeline appið")}
        title={t("acct.p.dagleg-thjalfun-i-simanum", "Dagleg þjálfun í símanum")}
        body={t("acct.p.aefingar-naering-svefn-og-andleg", "Æfingar, næring, svefn og andleg líðan — dag frá degi, með áætlun sem er þín og þjálfara sem þú nærð í. Appið keyrir í vafranum og þarf enga uppsetningu úr verslun.")}>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href="/app" variant="inverse">{t("acct.p.opna-appid", "Opna appið")}</ButtonLink>
          {!subscribed && <ButtonLink href="/app/adgangur#askrift" variant="inverseOutline">{t("account.coaching.subscribe", "Skrá mig í áskrift")}</ButtonLink>}
        </div>
      </PageHero>

      {/* Installing it on the home screen: the same guide /app uses. */}
      <InstallGuide />

      <AppFeatures />

      {steps.length > 0 && (
        <SectionCard icon={Sparkles} title={t("account.coaching.how", "Svona virkar heilsuþjálfun")} description={String(cc.how_subtitle ?? "")}>
          <ol className="space-y-4">
            {steps.map((st) => (
              <li key={st.n} className="flex gap-4">
                <span aria-hidden className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hc-brand-surface text-sm font-bold text-hc-brand-text">{st.n}</span>
                <span className="min-w-0">
                  <span className="block font-semibold text-hc-ink">{st.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-hc-ink-2">{st.desc}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className={`${accountInset} mt-6 p-4`}>
            <p className="text-sm leading-relaxed text-hc-ink">
              {t("account.coaching.inapp", "Allt þetta gerist í Lifeline appinu — daglegu aðgerðirnar, æfingarnar, næringin og eftirfylgnin. Þjálfunin er valkvæð og greidd sérstaklega.")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href="/app">{t("account.coaching.try", "Prófaðu appið")}</ButtonLink>
              {/* Somebody who already subscribes is not a lead. */}
              {subscribed
                ? <ButtonLink href={`${hrefFor("adgangur")}#subscription`} scroll={false} replace variant="secondary">{t("account.coaching.mysub", "Áskriftin þín")}</ButtonLink>
                : <ButtonLink href="/app/adgangur#askrift" variant="secondary">{t("account.coaching.subscribe", "Skrá mig í áskrift")}</ButtonLink>}
            </div>
          </div>
        </SectionCard>
      )}
    </>
  );
}
