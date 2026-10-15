"use client";

// Heilsufarsskoðun: the steps of the person's own assessment (exactly one
// journey, chosen by package), the patient portal, their measurements,
// Lyfja walk-in days, other packages, and the not-a-medical-record note.

import { ClipboardList } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PageHero } from "@/app/components/account/ui";
import { JourneyCard } from "../_components/journey";
import { BodyCompositionCard, PortalCard, WellnessFramingNote } from "../_components/HealthCards";
import { MeasurementDaysCard, PackagesCard } from "../_components/AssessmentCards";
import { SatisfactionPromptCard, WellbeingPromptCard } from "../_components/SurveyPrompts";
import type { SectionProps } from "../_components/context";

export default function AssessmentSection({ user, state: s, actions, open, journey }: SectionProps) {
  const { t } = useI18n();
  return (
    <>
      <PageHero icon={ClipboardList}
        kicker={t("acct.hero.assessment.kicker", "Heilsufarsskoðun")}
        title={t("acct.hero.assessment.title", "Þjónustan þín hjá Lifeline")}
        body={t("acc.hero.assessment.body", "Skrefin í skoðuninni, mælingarnar þínar og leiðin í sjúklingagáttina, þar sem sjúkraskráin er varðveitt.")} />

      <JourneyCard journey={journey} isB2C={!s.companyId} onChangePackage={actions.changePackage} onToggleCheck={actions.toggleJourneyCheck} />

      <SatisfactionPromptCard bodyCompStatus={s.bodyCompStatus} myDoctorSlot={s.myDoctorSlot} satisfactionDone={s.satisfactionDone} onStart={open.satisfaction} />
      {s.companyId && <WellbeingPromptCard lastWellbeingAt={s.lastWellbeingAt} onStart={open.wellbeing} />}

      <PortalCard />
      {s.biodyActivated && <BodyCompositionCard userId={user.id} />}
      <MeasurementDaysCard days={s.upcomingMeasurementDays} />
      <PackagesCard companyName={s.companyName} />

      {/* Required framing, verbatim: this is not the sjúkraskrá. */}
      <WellnessFramingNote />
    </>
  );
}
