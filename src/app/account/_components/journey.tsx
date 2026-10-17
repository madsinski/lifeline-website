"use client";

// "Skoðunin þín" — the steps of one heilsufarsskoðun, as one model.
//
// There were three components (SelfCheckinJourney, CheckinJourney,
// JourneyTimeline) and the timeline always rendered, so anyone on Endurmat
// or Sjálfsmat saw two "Heilsuferðin þín" lists stacked — the second for a
// package they had not bought, and under the name /app uses for something
// else. buildJourney() picks exactly one variant by package, and both the
// Heilsufarsskoðun tab (JourneyCard) and Yfirlit's "Næsta skref" read the
// same steps, so the two can never disagree about what is next.

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, Check, MapPin, Repeat, Smartphone, Video } from "lucide-react";
import { SAMEIND_STATIONS, fullAddress } from "@/lib/sameind-locations";
import { useI18n } from "@/lib/i18n";
import { Button, ButtonLink, accountInset, fmtDate, fmtDateTime, fmtIsk } from "@/app/components/account/ui";
import { hcKicker } from "@/app/components/hc/ui";
import PortalLink from "./PortalLink";
import { packageName } from "./packages";
import { DOCTOR_ADDON_ISK } from "./useBooking";
import type { AccountState, JourneyCheckKey } from "./types";

type T = (k: string, f?: string) => string;
type TV = (k: string, f: string, v: Record<string, string | number>) => string;

export interface StepCta { label: string; onClick?: () => void; href?: string; busy?: boolean }

export interface JourneyStep {
  key: string;
  title: string;
  description: string;
  done: boolean;
  active: boolean;
  cta?: StepCta;
  portal?: boolean;
  body?: ReactNode;
  manualCheck?: { key: JourneyCheckKey; label: string };
}

export interface Journey {
  variant: "full" | "checkin" | "self";
  intro: string;
  packageLabel: string | null;
  canChangePackage: boolean;
  steps: JourneyStep[];
  allDone: boolean;
}

export interface JourneyHandlers {
  onGoToBiody: () => void;
  onPickBodyCompSlot: () => void;
  onPickBloodTestDay: () => void;
  onPickInPersonDoctorSlot: () => void;
  onConfirmVideoPortal: () => void;
  onClearVideoPortal: () => void;
  onPayDoctorAddon: () => void;
  videoConfirmBusy: boolean;
  payingDoctorAddon: boolean;
}

/** Blood-test practicalities: fasting + every Sameind station. */
function SameindInfo({ t }: { t: T }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-hc-element bg-hc-warn-surface px-3 py-2.5 text-xs text-hc-warn-ink ring-1 ring-amber-200">
        <p className="font-semibold">{t("acct.p.fasta-fra-midnaetti", "Fasta frá miðnætti")}</p>
        {t("acct.q.wateronly", "Aðeins vatn — enginn matur, kaffi, te, safi eða áfengi.")}
      </div>
      <details className={`group ${accountInset}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-hc-ink-2">
          <span>{t("acc.sameind.stations", "Stöðvar Sameindar (rannsóknarstofu) — þú mátt mæta á hvaða stöð sem er")}</span>
          <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <ul className="divide-y divide-hc-hairline border-t border-hc-hairline px-3">
          {SAMEIND_STATIONS.map((s) => (
            <li key={s.id} className="py-2 text-xs">
              <p className="font-medium text-hc-ink">{s.name}</p>
              <p className="text-hc-ink-2">{fullAddress(s)}</p>
              <p className="text-hc-ink-3">{s.hours}</p>
            </li>
          ))}
        </ul>
      </details>
      <p className="text-xs leading-snug text-hc-ink-3">
        {t("acc.sameind.note", "Engin bókun nauðsynleg. Hafðu skilríki meðferðis. Best er að mæta milli 08:00 og 12:00; niðurstöðurnar birtast í skýrslunni nokkrum dögum síðar.")}
      </p>
    </div>
  );
}

/** In person or by video: the two ways to meet the doctor. */
function DoctorOptions({ t, hasSlots, h }: { t: T; hasSlots: boolean; h: JourneyHandlers }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className={`${accountInset} p-3`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-hc-ink"><MapPin className="h-4 w-4 text-hc-brand-text" aria-hidden />{t("acct.p.a-stadnum", "Á staðnum")}</p>
        <p className="mb-2 mt-1 text-xs leading-snug text-hc-ink-2">{t("acc.doctor.inperson-desc", "Hittu lækninn á starfsstöð Lifeline á tíma sem þú velur.")}</p>
        {hasSlots
          ? <Button size="sm" onClick={h.onPickInPersonDoctorSlot}>{t("acct.q.picktime", "Veldu tíma")}</Button>
          : <p className="text-xs text-hc-ink-3">{t("acct.p.engir-timar-a-stadnum-lausir", "Engir tímar á staðnum lausir eins og er.")}</p>}
      </div>
      <div className={`${accountInset} p-3`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-hc-ink"><Video className="h-4 w-4 text-hc-brand-text" aria-hidden />{t("acct.q.videoportal", "Myndsímtal í sjúklingagátt")}</p>
        <p className="mb-2 mt-1 text-xs leading-snug text-hc-ink-2">{t("acc.doctor.video-desc", "Myndsímtöl eru bókuð í sjúklingagáttinni. Bókaðu þar og staðfestu svo hér.")}</p>
        <div className="flex flex-wrap gap-2">
          <PortalLink variant="secondary" label={t("acct.p.boka-myndsimtal-i-gattinni", "Bóka myndsímtal í gáttinni")} />
          <Button size="sm" onClick={h.onConfirmVideoPortal} busy={h.videoConfirmBusy}>{t("acc.video.booked", "Ég hef bókað — staðfesta")}</Button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-hc-ink-3">{t("acc.video.selfreport", "Í bili þarf að staðfesta bókunina hér. Síðar samstillist hún sjálfkrafa við sjúklingagáttina.")}</p>
      </div>
    </div>
  );
}

export function buildJourney(s: AccountState, h: JourneyHandlers, t: T, tv: TV, locale: string): Journey {
  const isB2C = !s.companyId;
  const status = s.bodyCompStatus;
  const completed = status === "completed";
  const booked = status === "booked" || completed;
  const pkg = s.bodyCompPackage;
  const checks = s.journeyChecks;
  const canChangePackage = isB2C && status !== "none";
  const packageLabel = isB2C && status !== "none" ? packageName(pkg ?? "foundational", locale) : null;
  const when = (iso: string | null) => (iso ? fmtDateTime(iso, { weekday: true }, locale) : null);

  const biodyStep = (activeWhen: boolean): JourneyStep => ({
    key: "biody",
    title: t("acc.j.biody", "Upplýsingar fyrir líkamssamsetningarmælingu"),
    description: s.biodyActivated
      ? t("acct.p.upplysingarnar-thinar-eru-samstill", "Upplýsingarnar þínar eru samstilltar við Biody. Þú getur breytt þeim hvenær sem er.")
      : t("acc.j.biody-todo", "Staðfestu hæð, þyngd og hreyfingu. Þær fara til Biody, sem sér um líkamssamsetningarmælinguna. Tekur um mínútu."),
    done: s.biodyActivated,
    active: activeWhen && !s.biodyActivated,
    cta: { label: s.biodyActivated ? t("acct.p.breyta-upplysingum", "Breyta upplýsingum") : t("acct.q.activate", "Virkja"), onClick: h.onGoToBiody },
  });

  const resultsStep = (ready: boolean, viewed: boolean): JourneyStep => ({
    key: "results",
    title: t("acct.p.sja-nidurstodurnar-i-sjuklingagatt", "Sjá niðurstöðurnar í sjúklingagáttinni"),
    description: viewed
      ? t("acct.p.merkt-sem-yfirfarid-thu-kemst", "Merkt sem yfirfarið. Þú kemst alltaf í skýrsluna þína í Medalia.")
      : ready
        ? t("acc.j.results-ready", "Skýrslan, heilsueinkunnin og aðgerðaáætlunin eru tilbúnar í sjúklingagáttinni. Opnaðu hana og hakaðu svo við hér.")
        : t("acc.j.results-later", "Þegar mælingum, blóðprufu og viðtali við lækni er lokið birtist skýrslan þín í sjúklingagáttinni."),
    done: viewed,
    active: !viewed && ready,
    portal: true,
    manualCheck: { key: "results_viewed", label: t("acc.j.check-results", "Ég hef farið yfir skýrsluna") },
  });

  // ── Sjálfsmat: fully remote, just the questionnaire ──────────────────────
  if (isB2C && pkg === "self-checkin" && status !== "none") {
    const steps: JourneyStep[] = [
      {
        key: "booked", title: t("acct.p.sjalfsmat-bokad", "Sjálfsmat bókað"),
        description: t("acc.j.self-booked", "Fjarmatið þitt er skráð."), done: true, active: false,
      },
      {
        key: "questionnaire",
        title: t("acct.p.svaradu-spurningalistanum-i-sjukli", "Svaraðu spurningalistanum í sjúklingagáttinni"),
        description: completed
          ? t("acc.j.self-done", "Lokið. Fagaðili hjá Lifeline hefur farið yfir svörin og hefur samband ef eitthvað þarf að skoða nánar.")
          : t("acc.j.self-todo", "Opnaðu sjúklingagáttina (Medalia) og svaraðu spurningalistanum. Fagaðili fer yfir svörin og hefur samband ef eitthvað þarf að skoða nánar; annars birtast uppfærð heilsueinkunn og ábendingar í gáttinni."),
        done: completed, active: !completed, portal: !completed,
      },
    ];
    return { variant: "self", intro: t("acc.j.self-intro", "Sjálfsmat fer allt fram á netinu: engin heimsókn og engin blóðprufa."), packageLabel, canChangePackage, steps, allDone: completed };
  }

  // ── Endurmat: booked → Biody → measurement → optional doctor → results ────
  if (isB2C && pkg === "checkin" && status !== "none") {
    const hasDoctorBooking = !!s.myDoctorSlot || !!s.videoPortalConfirmedAt;
    const addonPaid = !!s.checkinDoctorAddonPaidAt;
    const doctor: JourneyStep = hasDoctorBooking
      ? { key: "doctor", title: t("acc.j.doctor", "Viðtal við lækni"), description: s.myDoctorSlot ? tv("acc.j.doctor-booked-at", "Viðtalið er bókað {{when}}.", { when: when(s.myDoctorSlot.slot_at) ?? "" }) : t("acc.j.doctor-video-ok", "Myndsímtal staðfest — þú bókaðir það í sjúklingagáttinni."), done: true, active: false }
      : !addonPaid
        ? {
            key: "doctor", title: t("acc.j.doctor-optional", "Viðtal við lækni (valfrjálst)"),
            description: tv("acc.j.addon-desc", "Viðbót við endurmatið: viðtal við lækni þar sem farið er yfir framvinduna og áætlunin uppfærð. Greitt sérstaklega, {{amount}}.", { amount: fmtIsk(DOCTOR_ADDON_ISK) }),
            done: false, active: false,
            cta: { label: tv("acc.j.addon-cta", "Bæta við fyrir {{amount}}", { amount: fmtIsk(DOCTOR_ADDON_ISK) }), onClick: h.onPayDoctorAddon, busy: h.payingDoctorAddon },
          }
        : {
            key: "doctor", title: t("acc.j.doctor", "Viðtal við lækni"),
            description: t("acct.p.greitt-veldu-hvernig-thu-vilt", "Greitt. Veldu hvernig þú vilt hitta lækninn þinn hjá Lifeline."),
            done: false, active: true,
            body: <DoctorOptions t={t} hasSlots={s.upcomingDoctorSlots.length > 0} h={h} />,
          };
    const steps: JourneyStep[] = [
      {
        key: "booked", title: t("acc.j.checkin-booked", "Endurmat bókað"),
        description: s.bodyCompBookingAt ? tv("acc.j.booked-at", "Bókað {{when}}.", { when: when(s.bodyCompBookingAt) ?? "" }) : t("acc.j.registered", "Bókunin er skráð."),
        done: true, active: false,
      },
      biodyStep(true),
      {
        key: "measurement", title: t("acc.j.measurement", "Mæling"),
        description: completed
          ? t("acct.p.maelingu-lokid-framvinduskyrslan-t", "Mælingu lokið. Framvinduskýrslan þín er í vinnslu.")
          : s.bodyCompBookingAt
            ? tv("acc.j.measurement-at", "Áætluð {{when}}.", { when: when(s.bodyCompBookingAt) ?? "" })
            : t("acct.p.vid-stadfestum-timann-thegar-maeli", "Við staðfestum tímann þegar mælingatíminn þinn er frágenginn."),
        done: completed, active: !completed && s.biodyActivated,
      },
      doctor,
      {
        key: "results",
        title: t("acct.p.sja-nidurstodurnar-i-sjuklingagatt", "Sjá niðurstöðurnar í sjúklingagáttinni"),
        description: completed
          ? t("acct.p.framvinduskyrslan-uppfaerd-heilsue", "Framvinduskýrslan, uppfærð heilsueinkunn og ný áætlun eru í Medalia.")
          : t("acc.j.checkin-results-later", "Eftir mælinguna (og viðtal við lækni ef þú bættir því við) birtist framvinduskýrslan í sjúklingagáttinni."),
        done: false, active: completed, portal: completed,
      },
    ];
    return { variant: "checkin", intro: t("acc.j.checkin-intro", "Endurmat: mæling, samanburður við fyrri niðurstöður og uppfærð áætlun."), packageLabel, canChangePackage, steps, allDone: false };
  }

  // ── Full assessment (Grunnstoð heilsu, and every B2B employee) ───────────
  const questionnaireDone = !!checks.questionnaire;
  const bloodTestDone = !!checks.blood_test;
  const resultsViewed = !!checks.results_viewed;
  const hasSlot = !!s.mySlotAt;
  const hasBlood = !!s.myBloodTestBooking;
  const eventLabel = s.companyEvent
    ? `${fmtDate(s.companyEvent.event_date, { weekday: true, year: false }, locale)}, ${s.companyEvent.start_time.slice(0, 5)}–${s.companyEvent.end_time.slice(0, 5)}${s.companyEvent.location ? ` · ${s.companyEvent.location}` : ""}`
    : "";

  const onboarding: JourneyStep = {
    key: "onboarding", title: t("acc.j.account", "Aðgangur stofnaður"),
    description: t("acc.j.account-desc", "Skráningu og samþykki er lokið."),
    done: true, active: false,
    cta: { label: t("acct.p.horfa-a-kynningu", "Horfa á kynningu"), href: "/account/welcome?preview=1" },
  };
  const b2cBook: JourneyStep = {
    key: "book",
    title: t("acct.p.bokadu-heilsufarsskodunina-thina", "Bókaðu heilsufarsskoðunina þína"),
    description: completed
      ? t("acct.p.lokid-nidurstodurnar-thinar-eru-i", "Lokið. Niðurstöðurnar þínar eru í sjúklingagáttinni.")
      : booked
        ? (s.bodyCompBookingAt ? tv("acc.j.booked-at", "Bókað {{when}}.", { when: when(s.bodyCompBookingAt) ?? "" }) : t("acc.j.registered", "Bókunin er skráð."))
        : t("acc.j.book-desc", "Veldu pakka og tíma og greiddu. Ein heimsókn nær yfir mælingarnar og beiðni um blóðprufu."),
    done: booked, active: !booked,
    cta: !booked ? { label: t("acct.p.boka-a-maelingastod", "Bóka á mælingastöð"), href: "/account/book" } : undefined,
  };
  const b2bMeasure: JourneyStep = {
    key: "measure",
    title: t("acct.p.maelingar-bokadu-tima", "Mælingar — bókaðu tíma"),
    description: hasSlot
      ? tv("acc.j.slot-at", "Tíminn þinn er {{when}}.", { when: when(s.mySlotAt) ?? "" })
      : s.companyEvent
        ? tv("acc.j.onsite", "Mælt er á vinnustaðnum {{event}}. Veldu 5 mínútna tíma.", { event: eventLabel })
        : t("acct.p.fyrirtaekid-thitt-akvedur-maelinga", "Fyrirtækið þitt ákveður mælingadaginn. Þú færð tilkynningu."),
    done: hasSlot, active: s.biodyActivated && !hasSlot && !!s.companyEvent,
    cta: !hasSlot && s.companyEvent ? { label: t("acct.p.veldu-tima", "Veldu tíma"), onClick: h.onPickBodyCompSlot } : undefined,
  };
  const questionnaire: JourneyStep = isB2C
    ? {
        key: "questionnaire", title: t("acc.j.questionnaire", "Heilsufarsspurningalisti"),
        description: booked
          ? t("acc.j.q-b2c-ready", "Áður en kemur að blóðprufunni virkjar þú heilsufarsskoðunina og svarar spurningalistanum í sjúklingagáttinni (Medalia).")
          : t("acc.j.q-b2c-later", "Bókaðu skoðunina fyrst. Þú færð hlekk á spurningalistann í SMS þegar bókunin er staðfest."),
        done: questionnaireDone, active: !questionnaireDone && booked, portal: true,
        manualCheck: { key: "questionnaire", label: t("acc.j.check-q", "Ég hef svarað spurningalistanum") },
      }
    : {
        key: "questionnaire", title: t("acc.j.questionnaire", "Heilsufarsspurningalisti"),
        description: hasSlot && hasBlood
          ? t("acc.j.q-b2b-ready", "Þú færð SMS frá Lifeline með hlekk á spurningalistann. Hann er í sjúklingagáttinni (Medalia).")
          : t("acc.j.q-b2b-later", "Þú færð spurningalistann í SMS innan 7 daga frá því að þú bókar mælingu og blóðprufu. Hann verður í sjúklingagáttinni (Medalia)."),
        done: questionnaireDone, active: !questionnaireDone && hasSlot && hasBlood, portal: true,
        manualCheck: { key: "questionnaire", label: t("acc.j.check-q", "Ég hef svarað spurningalistanum") },
      };
  const bloodDone = bloodTestDone || completed;
  const blood: JourneyStep = isB2C
    ? {
        key: "blood", title: t("acc.j.blood", "Blóðprufa hjá Sameind"),
        description: bloodDone
          ? t("acct.p.lokid-nidurstodurnar-birtast-i-sky", "Lokið — niðurstöðurnar birtast í skýrslunni þinni.")
          : booked
            ? t("acct.p.maettu-a-hvada-sameind-stod-2", "Mættu á hvaða Sameind-stöð sem er á opnunartíma — engin bókun nauðsynleg.")
            : t("acc.j.blood-later", "Beiðni um blóðprufu hjá Sameind er gefin út þegar þú hefur bókað skoðunina."),
        done: bloodDone, active: !bloodDone && booked,
        body: booked && !completed ? <SameindInfo t={t} /> : undefined,
        manualCheck: { key: "blood_test", label: t("acc.j.check-blood", "Ég hef farið í blóðprufu") },
      }
    : {
        key: "blood", title: t("acct.p.blodprufa-hja-sameind-veldu-dag", "Blóðprufa hjá Sameind — veldu dag"),
        description: hasBlood
          ? t("acct.p.dagur-valinn-maettu-a-hvada", "Dagur valinn. Mættu á hvaða Sameind-stöð sem er á opnunartíma.")
          : s.upcomingBloodDays.length > 0
            ? t("acc.j.blood-days", "Fyrirtækið þitt hefur samþykkt daga fyrir blóðprufu. Mættu á hvaða stöð Sameindar sem er á opnunartíma.")
            : t("acct.p.fyrirtaekid-thitt-samthykkir-daga-", "Fyrirtækið þitt samþykkir daga fyrir blóðprufu. Þú færð tilkynningu."),
        done: hasBlood, active: s.biodyActivated && !hasBlood && s.upcomingBloodDays.length > 0,
        cta: !hasBlood && s.upcomingBloodDays.length > 0 ? { label: t("acc.j.pick-day", "Veldu dag"), onClick: h.onPickBloodTestDay } : undefined,
      };
  const inPerson = !!s.myDoctorSlot;
  const video = !!s.videoPortalConfirmedAt;
  const anyDoctor = inPerson || video;
  const canBookDoctor = s.upcomingDoctorSlots.length > 0 || hasSlot;
  const doctor: JourneyStep = {
    key: "doctor", title: t("acc.j.doctor", "Viðtal við lækni"),
    description: video && !inPerson
      ? t("acc.j.doctor-video-ok", "Myndsímtal staðfest — þú bókaðir það í sjúklingagáttinni.")
      : inPerson
        ? tv("acc.j.doctor-booked-at", "Viðtalið er bókað {{when}}.", { when: when(s.myDoctorSlot!.slot_at) ?? "" })
        : canBookDoctor
          ? t("acct.p.veldu-hvernig-thu-vilt-hitta", "Veldu hvernig þú vilt hitta lækninn til að setja saman aðgerðaáætlunina.")
          : t("acct.p.thegar-skyrslan-thin-er-tilbuin", "Þegar skýrslan þín er tilbúin opnar Lifeline fyrir viðtalstíma."),
    done: anyDoctor, active: !anyDoctor,
    body: !anyDoctor
      ? <DoctorOptions t={t} hasSlots={s.upcomingDoctorSlots.length > 0} h={h} />
      : video && !inPerson
        ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PortalLink />
            <Button variant="link" onClick={h.onClearVideoPortal} disabled={h.videoConfirmBusy}>{t("acct.q.clearconf", "Hreinsa staðfestingu")}</Button>
          </div>
        ) : undefined,
  };
  const steps: JourneyStep[] = [
    onboarding,
    // B2C books first (pay, reserve a time), then the Biody profile.
    ...(isB2C ? [b2cBook, biodyStep(true)] : [biodyStep(true), b2bMeasure]),
    // Questionnaire before the blood test: clinicians read the answers first.
    questionnaire,
    blood,
    doctor,
    resultsStep(completed || anyDoctor, resultsViewed),
  ];
  return {
    variant: "full",
    intro: t("acc.j.full-intro", "Skrefin í heilsufarsskoðuninni, eitt af öðru."),
    packageLabel, canChangePackage, steps,
    allDone: steps.every((x) => x.done),
  };
}

/** The step to show on Yfirlit: the first one waiting on the person, else the first open one. */
export function nextStepOf(j: Journey): JourneyStep | null {
  return j.steps.find((x) => x.active && !x.done) ?? j.steps.find((x) => !x.done) ?? null;
}

function StepCtaButton({ cta, primary }: { cta: StepCta; primary: boolean }) {
  const variant = primary ? "primary" : "secondary";
  return cta.href
    ? <ButtonLink href={cta.href} size="sm" variant={variant}>{cta.label}</ButtonLink>
    : <Button size="sm" variant={variant} onClick={cta.onClick} busy={cta.busy}>{cta.label}</Button>;
}

export function JourneyCard({ journey, isB2C, onChangePackage, onToggleCheck }: {
  journey: Journey;
  isB2C: boolean;
  onChangePackage: () => void;
  onToggleCheck: (k: JourneyCheckKey) => void;
}) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="journey-title" className="rounded-hc-card bg-hc-surface p-5 shadow-hc-card ring-1 ring-slate-200 sm:p-6">
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h2 id="journey-title" className="flex-1 text-lg font-bold text-hc-ink">{t("acc.j.title", "Skoðunin þín")}</h2>
        {journey.packageLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-hc-brand-surface px-2.5 py-1 text-xs font-semibold text-hc-brand-text ring-1 ring-emerald-200">
            {t("acc.j.package", "Pakki")}: {journey.packageLabel}
          </span>
        )}
        {journey.canChangePackage && (
          <Button variant="link" onClick={onChangePackage}>{t("acct.q.changepkg", "Skipta um pakka")}</Button>
        )}
      </div>
      <p className="mb-6 text-sm text-hc-ink-2">{journey.intro}</p>
      <ol className="relative ml-3 border-l-2 border-hc-hairline">
        {journey.steps.map((st, i) => {
          const dot = st.done
            ? "bg-hc-brand-dark text-white"
            : st.active
              ? "bg-hc-focus text-white ring-4 ring-hc-focus-ring"
              : "bg-slate-200 text-hc-ink-2";
          return (
            <li key={st.key} className="relative pb-6 pl-6 last:pb-0">
              <span aria-hidden className={`absolute -left-[13px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${dot}`}>
                {st.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`font-semibold ${st.done ? "text-hc-ink-2" : st.active ? "text-hc-ink" : "text-hc-ink-3"}`}>{st.title}</h3>
                    <span className="sr-only">
                      {st.done ? t("acc.j.state-done", "(lokið)") : st.active ? t("acc.j.state-next", "(næsta skref)") : t("acc.j.state-later", "(síðar)")}
                    </span>
                    {st.active && !st.done && (
                      <span aria-hidden className="rounded-full bg-hc-brand-surface px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-hc-brand-text ring-1 ring-hc-brand/40">
                        {t("acct.p.naesta-skref", "Næsta skref")}
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 text-sm leading-relaxed ${st.active ? "text-hc-ink-2" : "text-hc-ink-3"}`}>{st.description}</p>
                  {st.portal && <div className="mt-3"><PortalLink variant={st.active ? "primary" : "secondary"} /></div>}
                  {st.body}
                  {st.manualCheck && (
                    <label className="mt-3 inline-flex cursor-pointer select-none items-center gap-2">
                      <input type="checkbox" checked={st.done} onChange={() => onToggleCheck(st.manualCheck!.key)} className="h-4 w-4 rounded accent-[#047857]" />
                      <span className="text-sm text-hc-ink-2">{st.manualCheck.label}</span>
                    </label>
                  )}
                </div>
                {st.cta && <StepCtaButton cta={st.cta} primary={st.active && !st.done} />}
              </div>
            </li>
          );
        })}
      </ol>
      {journey.allDone && <WhatsNext isB2C={isB2C} />}
    </section>
  );
}

/** Once every step is ticked: the app for every day, and when to come back. */
function WhatsNext({ isB2C }: { isB2C: boolean }) {
  const { t, locale } = useI18n();
  const rhythm = [
    { when: t("acct.q.everymonth", "Í hverjum mánuði"), what: t("acct.p.sjalfsmat", "Sjálfsmat"), desc: t("acct.q.freequest", "Gjaldfrjáls spurningalisti sem tekur fimm mínútur. Nemur breytingar snemma.") },
    { when: t("acct.q.every36", "Á 3–6 mánaða fresti"), what: packageName("checkin", locale) ?? "", desc: t("acct.p.endurtaktu-likamssamsetningu-og-he", "Endurtaktu líkamssamsetningu og helstu blóðgildi svo áætlunin haldist rétt stillt.") },
    { when: t("acct.q.every612", "Á 6–12 mánaða fresti"), what: t("acct.q.fullre", "Full endurtekin grunnskoðun"), desc: t("acct.p.full-blodprufa-uppfaerd-skyrsla-og", "Full blóðprufa, uppfærð skýrsla og nýtt mat læknis.") },
  ];
  return (
    <div className="mt-8 rounded-hc-card bg-hc-brand-surface p-5 ring-1 ring-emerald-200 sm:p-6">
      <p className={`${hcKicker} text-hc-brand-text`}>{t("acc.wn.kicker", "Heilsufarsskoðun lokið")}</p>
      <h3 className="mt-1 text-xl font-bold text-hc-ink">{t("acc.wn.title", "Næstu skref eftir skoðunina")}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-hc-ink-2">
        {t("acc.wn.body", "Þú ert með tölurnar þínar, aðgerðaáætlun sem læknir hefur farið yfir og skýra stefnu. Næst er að gera hana að daglegum venjum og koma reglulega aftur svo áætlunin byggi á nýjustu tölunum.")}
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-hc-card bg-hc-surface p-4 ring-1 ring-slate-200">
          <p className="flex items-center gap-2 font-semibold text-hc-ink"><Smartphone className="h-5 w-5 text-hc-brand-text" aria-hidden />{t("acc.wn.daily", "Daglega: Lifeline-appið")}</p>
          <ul className="mt-3 space-y-3 text-sm">
            <li>
              <p className="font-semibold text-hc-ink">{t("acct.q.selfmanaged", "Sjálfstýrð vegferð")}</p>
              <p className="text-hc-ink-2">{t("acc.wn.self", "Allt prógrammið á eigin hraða: daglegar aðgerðir, prógrömm í öllum fjórum stoðunum og mælingar.")}</p>
            </li>
            <li>
              <p className="font-semibold text-hc-ink">{t("acct.q.personalcoaching", "Persónuleg þjálfun")}</p>
              <p className="text-hc-ink-2">{t("acc.wn.coached", "Allt hitt, auk þjálfara sem fylgist með framvindunni, aðlagar áætlunina og heyrir í þér vikulega.")}</p>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/app" size="sm">{t("acct.p.opna-appid", "Opna appið")}</ButtonLink>
            <Link href="/account?s=appid" scroll={false} className="inline-flex items-center text-sm font-semibold text-hc-brand-text underline-offset-2 hover:underline">{t("acct.q.learncoaching", "Kynntu þér þjálfunina")}</Link>
          </div>
        </div>
        <div className="rounded-hc-card bg-hc-surface p-4 ring-1 ring-slate-200">
          <p className="flex items-center gap-2 font-semibold text-hc-ink"><Repeat className="h-5 w-5 text-hc-brand-text" aria-hidden />{t("acc.wn.rhythm", "Komdu aftur reglulega")}</p>
          <ul className="mt-3 space-y-3">
            {rhythm.map((r) => (
              <li key={r.when} className="flex gap-3 text-sm">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-hc-ink-3" aria-hidden />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-hc-ink-3">{r.when}</p>
                  <p className="font-semibold text-hc-ink">{r.what}</p>
                  <p className="text-hc-ink-2">{r.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2">
            {isB2C ? (
              <ButtonLink href="/account/book" size="sm" variant="secondary">{t("acc.wn.book", "Bóka endurmat")}</ButtonLink>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-hc-ink-2">{t("acc.wn.employer", "Vinnuveitandinn þinn skipuleggur næstu heildarumferð. Við sendum þér póst þegar opnað er fyrir bókanir.")}</p>
                <p className="text-xs leading-relaxed text-hc-ink-3">{t("acct.q.extracheckin", "Viltu aukaeftirfylgd fyrr? Þú getur greitt fyrir hana á milli umferða hjá vinnuveitanda.")}</p>
                <ButtonLink href="/account/book" size="sm" variant="secondary">{t("acct.q.bookextra", "Bóka aukaeftirfylgd")}</ButtonLink>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

