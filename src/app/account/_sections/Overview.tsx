"use client";

// Yfirlit: who you are, anything that needs saying (a refund decision, an
// unpaid booking), the one next step, your bookings, and the app.

import { useI18n } from "@/lib/i18n";
import AccountPromoCard from "@/app/components/AccountPromoCard";
import { Alert, Button, ButtonLink, fmtDateTime, fmtIsk } from "@/app/components/account/ui";
import CurrentBookings from "../_components/CurrentBookings";
import { AppCard, ContinueCard, NextStepCard, StartChoices, WelcomeHero } from "../_components/OverviewCards";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/signup-consent";
import { packageName } from "../_components/packages";
import type { SectionProps } from "../_components/context";

export default function OverviewSection({ user, state: s, patch, actions, open, journey, hrefFor }: SectionProps) {
  const { t, tv, locale } = useI18n();
  const isB2C = !s.companyId;
  const rr = s.resolvedRefund;
  const pending = isB2C && s.bodyCompStatus === "none" ? s.pendingBooking : null;
  /* Nothing booked, bought or started yet: a new personal account. */
  const isNew = isB2C && s.bodyCompStatus === "none" && !s.pendingBooking && !s.subscription
    && Object.keys(s.journeyChecks ?? {}).length === 0;
  const next = safeNextPath(useSearchParams().get("next"));

  return (
    <>
      <WelcomeHero user={user} firstName={s.profile.firstName} avatarUrl={s.avatarUrl} companyName={s.companyName}
        tier={s.subscription?.tier ?? null} onAvatar={(url) => patch({ avatarUrl: url })} />

      {/* A refund request resolved in the last 14 days. */}
      {isB2C && rr && (
        <Alert tone={rr.status === "approved" ? "ok" : "bad"} onDismiss={() => patch({ resolvedRefund: null })} dismissLabel={t("acct.q.dismiss", "Loka")}
          title={rr.status === "approved"
            ? tv("acc.refund.approved", "Afbókun samþykkt: við endurgreiðum {{amount}}", { amount: fmtIsk(rr.approved_isk ?? 0) })
            : t("acc.refund.denied", "Ekki var hægt að samþykkja endurgreiðslu")}>
          {rr.admin_note && <p className="whitespace-pre-wrap">{rr.admin_note}</p>}
          <p className={rr.admin_note ? "mt-2" : ""}>
            {rr.status === "approved"
              ? t("acc.refund.approved-note", "Upphæðin berst á kortið þitt innan 3–5 virkra daga.")
              : t("acc.refund.denied-note", "Bókunin þín stendur óbreytt. Svaraðu á contact@lifelinehealth.is ef þú vilt ræða málið.")}
          </p>
        </Alert>
      )}

      {/* A booking started but not paid for. */}
      {pending && (
        <Alert tone="warn" title={t("acct.q.incomplete", "Þú átt ófrágengna bókun.")}
          actions={<>
            <ButtonLink href={`/account/book?resume=${pending.id}`} size="sm">{t("acct.q.finishbooking", "Ljúka bókun")}</ButtonLink>
            <Button size="sm" variant="secondary" busy={actions.cancelBusy} onClick={actions.cancelPendingBooking}>{t("acct.q.cancelstart", "Hætta við og byrja upp á nýtt")}</Button>
          </>}>
          {tv("acc.pending.body", "Bókunin ({{pkg}}{{when}}) er frátekin en ekki greidd. Ljúktu greiðslunni til að staðfesta hana.", {
            pkg: packageName(pending.package, locale) ?? t("acct.p.skodunin-thin", "Skoðunin þín"),
            when: pending.scheduled_at ? `, ${fmtDateTime(pending.scheduled_at, { weekday: "short" }, locale)}` : "",
          })}
        </Alert>
      )}

      {/* Signup carried a purchase intent (?next=): one tap back to it. */}
      {next && <ContinueCard next={next} />}

      {/* A new account chooses where to start; nothing opens by itself. */}
      {!pending && isNew && <StartChoices />}
      {!pending && !isNew && (
        <NextStepCard journey={journey} hasBooking={!isB2C || s.bodyCompStatus !== "none"} sectionHref={hrefFor("heilsumat")} />
      )}

      <CurrentBookings
        s={s}
        cancelBusy={actions.cancelBusy}
        onChangeBcSlot={open.bodyCompSlot}
        onChangeBloodDay={open.bloodTestDay}
        onChangeDoctorSlot={open.doctorSlot}
        onCancelDoctorSlot={actions.cancelDoctorSlot}
        onCancelBcBooking={actions.cancelBodyCompBooking}
        onWithdrawRefundRequest={actions.withdrawRefundRequest}
        onClearVideoPortal={actions.clearVideoPortal}
      />

      <AppCard sectionHref={hrefFor("appid")} />

      {/* Managed in /admin/website → "Aðgangur"; hidden unless published. */}
      <AccountPromoCard />
    </>
  );
}
