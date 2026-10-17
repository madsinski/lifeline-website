"use client";

/*
 * Mínar síður (/account).
 *
 * Four tabs, each its own URL so a link, a refresh or the back button lands
 * where it should:
 *
 *   ?s=yfirlit    Yfirlit            welcome, next step, bookings, the app
 *   ?s=heilsumat  Heilsufarsskoðun   the assessment's steps, portal, results
 *   ?s=appid      Appið og þjálfun   the app and coaching (was two tabs)
 *   ?s=adgangur   Aðgangur           details, payments, documents, privacy
 *
 * Older links keep working: ?upgrade=<tier> (the pricing page) opens
 * Appið og þjálfun; s=billing / settings / profile open Aðgangur, and
 * s=overview / assessment / app / upgrade map to their new tabs.
 *
 * The page is the frame: data (useAccountData), booking actions
 * (useBooking), and every modal. The modals used to be mounted inside
 * Yfirlit only, so the pickers on Heilsufarsskoðun did nothing until you
 * switched tabs; they live here now, above all four.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ClipboardList, LayoutDashboard, Smartphone, UserCog } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ToastProvider, useToast } from "../components/hc/Toast";
import ContextSwitcher from "../components/ContextSwitcher";
import { SignOutButton } from "../components/account/AccountCards";
import { AccountLoading, AccountShell, DialogProvider, type ShellNavItem } from "../components/account/ui";
import PaymentReturn from "../components/hc/PaymentReturn";
import SlotPicker from "./welcome/SlotPicker";
import WellbeingSurveyModal from "./surveys/WellbeingSurveyModal";
import SatisfactionSurveyModal from "./surveys/SatisfactionSurveyModal";
import { fetchMyDoctorSlot, fetchMyEventSlot, fetchOpenDoctorSlots, useAccountData } from "./_components/useAccountData";
import { useBooking } from "./_components/useBooking";
import { buildJourney } from "./_components/journey";
import { BloodTestDayPickerModal, DoctorSlotPickerModal, RefundRequestModal } from "./_components/BookingModals";
import BiodyProfileModal from "./_components/BiodyProfileModal";
import type { ModalOpeners, SectionProps } from "./_components/context";
import type { SatisfactionContext, SectionId } from "./_components/types";
import OverviewSection from "./_sections/Overview";
import AssessmentSection from "./_sections/Assessment";
import AppAndCoachingSection from "./_sections/AppAndCoaching";
import AccountSection from "./_sections/Account";

const SECTION_ALIASES: Record<string, SectionId> = {
  yfirlit: "yfirlit", overview: "yfirlit",
  heilsumat: "heilsumat", assessment: "heilsumat",
  appid: "appid", app: "appid", upgrade: "appid", coaching: "appid",
  adgangur: "adgangur", settings: "adgangur", billing: "adgangur", profile: "adgangur",
};

function sectionFrom(params: URLSearchParams): SectionId {
  const s = params.get("s") ?? params.get("section");
  if (s && SECTION_ALIASES[s]) return SECTION_ALIASES[s];
  if (params.get("upgrade")) return "appid";
  return "yfirlit";
}

type ModalState =
  | { kind: "bodyCompSlot" | "bloodTestDay" | "doctorSlot" | "biody" | "refundRequest" | "wellbeing" }
  | { kind: "satisfaction"; ctx: SatisfactionContext }
  | null;

function AccountPageInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { t, tv, locale } = useI18n();
  const upgradeParam = searchParams.get("upgrade");
  const section = sectionFrom(searchParams);
  const { user, loading, state, patch } = useAccountData(upgradeParam);
  const [modal, setModal] = useState<ModalState>(null);
  /* Pickers and forms that close on success say so here, since the button
     that was pressed is gone; their failures stay inside the modal. */
  const toast = useToast();

  /* Other parameters (an old ?upgrade=) are carried along unchanged, so
     switching tabs never re-runs the data load. */
  const hrefFor = useCallback((id: SectionId) => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("section");
    p.set("s", id);
    return `${pathname}?${p.toString()}`;
  }, [searchParams, pathname]);

  /* A new section starts at its own top — after the new layout exists, so
     it does not scroll against the old page's height. A #fragment (e.g.
     #subscription from the app tab) is honoured instead. */
  useEffect(() => {
    if (loading) return;
    const id = window.location.hash.slice(1);
    const el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, [section, loading]);

  const open: ModalOpeners = useMemo(() => ({
    bodyCompSlot: () => setModal({ kind: "bodyCompSlot" }),
    bloodTestDay: () => setModal({ kind: "bloodTestDay" }),
    doctorSlot: () => setModal({ kind: "doctorSlot" }),
    biody: () => setModal({ kind: "biody" }),
    refundRequest: () => setModal({ kind: "refundRequest" }),
    wellbeing: () => setModal({ kind: "wellbeing" }),
    satisfaction: (ctx) => setModal({ kind: "satisfaction", ctx }),
  }), []);
  const close = useCallback(() => setModal(null), []);

  const actions = useBooking({ user, state, patch, openRefundRequest: open.refundRequest });

  const journey = useMemo(() => buildJourney(state, {
    onGoToBiody: open.biody,
    onPickBodyCompSlot: open.bodyCompSlot,
    onPickBloodTestDay: open.bloodTestDay,
    onPickInPersonDoctorSlot: open.doctorSlot,
    onConfirmVideoPortal: actions.confirmVideoPortal,
    onClearVideoPortal: actions.clearVideoPortal,
    onPayDoctorAddon: actions.payDoctorAddon,
    videoConfirmBusy: actions.videoConfirmBusy,
    payingDoctorAddon: actions.payingDoctorAddon,
  }, t, tv, locale), [state, open, actions, t, tv, locale]);

  const nav: ShellNavItem<SectionId>[] = useMemo(() => [
    { id: "yfirlit", label: t("account.nav.overview", "Yfirlit"), shortLabel: t("account.nav.overview", "Yfirlit"), icon: LayoutDashboard, href: hrefFor("yfirlit") },
    { id: "heilsumat", label: t("account.nav.assessment", "Heilsufarsskoðun"), shortLabel: t("acc.nav.assessment-short", "Skoðun"), icon: ClipboardList, href: hrefFor("heilsumat") },
    { id: "appid", label: t("acc.nav.app", "Appið og þjálfun"), shortLabel: t("acc.nav.app-short", "Appið"), icon: Smartphone, href: hrefFor("appid") },
    { id: "adgangur", label: t("acc.nav.account", "Aðgangur"), shortLabel: t("acc.nav.account", "Aðgangur"), icon: UserCog, href: hrefFor("adgangur") },
  ], [t, hrefFor]);

  if (loading) return <AccountLoading label={t("acct.loading", "Augnablik…")} />;
  if (!user) return null;

  const props: SectionProps = { user, state, patch, actions, open, journey, hrefFor };

  return (
    <AccountShell
      kicker={t("acct.nav.mypages", "Mínar síður")}
      headerActions={<><ContextSwitcher current="personal" /><SignOutButton /></>}
      nav={nav}
      active={section}
      appLabel={t("account.nav.openapp", "Opna appið")}
      appShortLabel={t("account.nav.openapp", "Opna appið")}
      navLabel={t("acc.nav.label", "Mínar síður")}
    >
      {section === "yfirlit" && <OverviewSection {...props} />}
      {section === "heilsumat" && <AssessmentSection {...props} />}
      {section === "appid" && <AppAndCoachingSection {...props} />}
      {section === "adgangur" && <AccountSection {...props} />}

      {/* ── Every modal, above all four tabs ─────────────────────────── */}
      {modal?.kind === "bodyCompSlot" && state.companyEvent && (
        <SlotPicker event={state.companyEvent} onClose={close}
          onBooked={async () => patch({ mySlotAt: await fetchMyEventSlot(user.id) })} />
      )}
      {modal?.kind === "bloodTestDay" && state.companyId && (
        <BloodTestDayPickerModal companyId={state.companyId} days={state.upcomingBloodDays} existing={state.myBloodTestBooking} onClose={close}
          onBooked={(b) => { patch({ myBloodTestBooking: b }); toast.show(t("acc.bt.booked", "Dagurinn fyrir blóðprufuna er skráður.")); }}
          onCancelled={() => { patch({ myBloodTestBooking: null }); toast.show(t("acc.bt.cancelled", "Dagurinn fyrir blóðprufuna var afbókaður.")); }} />
      )}
      {modal?.kind === "doctorSlot" && (
        <DoctorSlotPickerModal slots={state.upcomingDoctorSlots} existing={state.myDoctorSlot} onClose={close}
          onBooked={async () => {
            const [mine, open] = await Promise.all([fetchMyDoctorSlot(user.id), fetchOpenDoctorSlots()]);
            patch({ myDoctorSlot: mine, upcomingDoctorSlots: open });
            toast.show(t("acc.dr.booked", "Viðtalið við lækninn er bókað."));
          }}
          onCancelled={() => { patch({ myDoctorSlot: null }); toast.show(t("acc.doctor.cancelled", "Viðtalið við lækninn var afbókað.")); }} />
      )}
      {modal?.kind === "biody" && (
        <BiodyProfileModal userId={user.id} onClose={close} onActivated={() => patch({ biodyActivated: true })}
          onSaved={({ sex, dob }) => patch((st) => ({ profile: { ...st.profile, sex, dob: dob || st.profile.dob } }))} />
      )}
      {modal?.kind === "refundRequest" && state.booking.id && (
        <RefundRequestModal bookingId={state.booking.id} clientId={user.id} amountIsk={state.booking.amount}
          includeCheckinAddon={state.bodyCompPackage === "checkin" && !!state.checkinDoctorAddonPaidAt}
          scheduledAt={state.booking.scheduledAt} onClose={close}
          onSubmitted={(id) => { patch({ pendingRefundRequestId: id }); close(); toast.show(t("acc.rr.sent", "Afbókunarbeiðnin er send. Við svörum í tölvupósti innan eins virks dags.")); }} />
      )}
      {modal?.kind === "wellbeing" && (
        <WellbeingSurveyModal companyId={state.companyId} onClose={close}
          onSubmitted={() => { patch({ lastWellbeingAt: new Date().toISOString() }); toast.show(t("acc.survey.thanks", "Takk fyrir svörin.")); }} />
      )}
      {modal?.kind === "satisfaction" && (
        <SatisfactionSurveyModal companyId={state.companyId} context={modal.ctx} onClose={close}
          onSubmitted={() => { const ctx = modal.ctx; patch((s) => ({ satisfactionDone: { ...s.satisfactionDone, [ctx]: true } })); toast.show(t("acc.survey.thanks", "Takk fyrir svörin.")); }} />
      )}
    </AccountShell>
  );
}

/* Suspense for useSearchParams; the dialog provider so every confirm on the
   page is the styled one; the toast for "done" after a modal closes. */
export default function AccountPage() {
  return (
    <Suspense fallback={<AccountLoading />}>
      {/* No JourneyNav docked here: the toast sits on the bottom edge,
          above the home indicator only. */}
      <ToastProvider dockOffset="env(safe-area-inset-bottom, 0px)">
        <DialogProvider>
          <AccountPageInner />
          <PaymentReturn />
        </DialogProvider>
      </ToastProvider>
    </Suspense>
  );
}
