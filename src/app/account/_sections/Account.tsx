"use client";

// Aðgangur: personal details, sign-in, the app subscription and payments,
// signed documents, privacy and data requests, and deleting the account.
// Persónuupplýsingar used to be a separate section reachable only through
// "Breyta" here; it is the first card now.

import { useEffect, useState } from "react";
import { BadgeCheck, FileSignature, KeyRound, Lock, MessageSquareMore, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import BillingPanel from "@/app/components/BillingPanel";
import DataPrivacyPanel from "@/app/components/account/DataPrivacyPanel";
import { DeleteAccountCard, PasswordCard } from "@/app/components/account/AccountCards";
import { Button, PageHero, SectionCard, Switch, fmtDate, useDialog } from "@/app/components/account/ui";
import SignedDocumentsList from "../SignedDocumentsList";
import ProfileDetailsCard from "../_components/ProfileDetailsCard";
import { BiodyReconsentBanner } from "../_components/HealthCards";
import { tierName } from "../_components/OverviewCards";
import type { SectionProps } from "../_components/context";

/** The beta feedback button's visibility; the widget listens for the event. */
function FeedbackToggle() {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(false);
  const [hasPreviewCookie, setHasPreviewCookie] = useState(false);
  useEffect(() => {
    // Read after mount: localStorage and cookies are not there on the server.
    const timer = setTimeout(() => {
      try { setHidden(localStorage.getItem("ll-hide-feedback") === "1"); } catch { /* private mode */ }
      setHasPreviewCookie(document.cookie.includes("site_preview=lifelinepreview2026"));
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  if (!hasPreviewCookie) return null;
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem("ll-hide-feedback", next ? "1" : "0"); } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent("ll-feedback-visibility", { detail: { hidden: next } }));
  };
  return (
    <SectionCard icon={MessageSquareMore} title={t("acc.feedback.title", "Ábendingarhnappur (prófunarútgáfa)")}
      description={t("acct.p.syna-eda-fela-abendingarhnappinn-n", "Sýna eða fela ábendingarhnappinn neðst á síðunni")}
      action={<Switch checked={!hidden} onChange={toggle} label={t("acc.feedback.toggle", "Sýna ábendingarhnappinn")} />} />
  );
}

export default function AccountSection({ user, state: s, patch }: SectionProps) {
  const { t, tv, locale } = useI18n();
  const { confirm } = useDialog();
  const [cancelling, setCancelling] = useState(false);
  const sub = s.subscription;
  const paidTier = sub && sub.tier !== "free-trial" ? tierName(sub.tier, locale) : null;

  const cancelSubscription = async () => {
    if (!sub) return;
    const ok = await confirm({
      title: t("acc.sub.cancel-title", "Segja upp áskriftinni?"),
      body: t("acct.p.ertu-viss-thu-heldur-adganginum", "Ertu viss? Þú heldur aðganginum út yfirstandandi greiðslutímabil."),
      confirmLabel: t("acct.p.ja-segja-upp", "Já, segja upp"),
      cancelLabel: t("acc.sub.keep", "Halda áskriftinni"),
      tone: "danger",
    });
    if (!ok) return;
    setCancelling(true);
    await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
    patch({ subscription: null });
    setCancelling(false);
  };

  return (
    <>
      <PageHero icon={Settings}
        kicker={t("acc.nav.account", "Aðgangur")}
        title={t("acct.hero.settings.title", "Aðgangurinn þinn")}
        body={t("acct.hero.settings.body", "Upplýsingar, greiðslur, samþykki og persónuvernd — allt á einum stað.")} />

      <ProfileDetailsCard user={user} profile={s.profile} onSaved={(profile) => patch({ profile })} />

      <SectionCard icon={KeyRound} title={t("acc.signin.title", "Innskráning")}>
        <PasswordCard />
      </SectionCard>

      {/* App subscription — only while a paid plan is active; the app is sold on /coaching. */}
      {sub && paidTier && (
        <SectionCard id="subscription" icon={BadgeCheck} title={t("acct.p.askrift-ad-lifeline-appinu", "Áskrift að Lifeline appinu")}
          description={<>
            <span className="mr-2 rounded-full bg-hc-brand-surface px-2.5 py-0.5 text-xs font-semibold text-hc-brand-text ring-1 ring-emerald-200">{paidTier}</span>
            {sub.current_period_end && tv("acct.p.next-payment", "Næsta greiðsla {{date}}", { date: fmtDate(sub.current_period_end, {}, locale) })}
          </>}
          action={<Button size="sm" variant="dangerOutline" busy={cancelling} onClick={cancelSubscription}>{t("acct.p.segja-upp-askrift", "Segja upp áskrift")}</Button>} />
      )}

      {/* Payment cards + history: the shared panel. */}
      <BillingPanel ownerType="client" ownerId={user.id} />

      <SectionCard icon={FileSignature} title={t("acct.p.logleg-samthykki", "Lögleg samþykki")}
        description={t("acct.p.skjol-sem-thu-hefur-undirritad", "Skjöl sem þú hefur undirritað rafrænt — sækja PDF.")}>
        <SignedDocumentsList />
      </SectionCard>

      <SectionCard id="privacy" icon={Lock} title={t("comp.dp.title", "Gögn og persónuvernd")}>
        {/* The re-consent nudge sits on the switch it asks about. */}
        {s.biodyActivated && <div className="mb-4"><BiodyReconsentBanner userId={user.id} targetId="privacy-biody" /></div>}
        <DataPrivacyPanel userId={user.id} />
      </SectionCard>

      <FeedbackToggle />

      <SectionCard>
        <DeleteAccountCard />
      </SectionCard>
    </>
  );
}
