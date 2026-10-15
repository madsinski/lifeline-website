"use client";

// The two survey prompts. Both modals existed and nothing opened them; the
// prompts now sit on Heilsufarsskoðun — the page about the service being
// rated — rather than on Yfirlit, where asking somebody to rate a service
// on the page they open to see where they stand was the wrong place.

import { HeartPulse, MessageSquareText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button, SectionCard, useNow } from "@/app/components/account/ui";
import type { BodyCompStatus, MyDoctorSlot, SatisfactionContext } from "./types";

/** Monthly wellbeing check (B2B: the company sees anonymised group trends only). */
export function WellbeingPromptCard({ lastWellbeingAt, onStart }: { lastWellbeingAt: string | null; onStart: () => void }) {
  const { t } = useI18n();
  const now = useNow();
  const daysSince = lastWellbeingAt ? Math.floor((now - new Date(lastWellbeingAt).getTime()) / 86_400_000) : null;
  if (daysSince != null && daysSince < 30) return null;
  return (
    <SectionCard icon={HeartPulse}
      title={lastWellbeingAt ? t("acct.p.manadarlegt-lidanmat", "Mánaðarlegt líðanmat") : t("acct.p.svaradu-stuttu-lidanmati", "Svaraðu stuttu líðanmati")}
      description={t("acc.survey.wellbeing-desc", "Fimm spurningar, um 30 sekúndur. Svörin þín eru trúnaðarmál; fyrirtækið sér aðeins ópersónugreinanlega heildarmynd hópa með minnst 5 manns.")}
      action={<Button size="sm" onClick={onStart}>{t("acc.survey.start", "Svara")}</Button>} />
  );
}

/** "How was it?" after a finished measurement or doctor consultation. */
export function SatisfactionPromptCard({ bodyCompStatus, myDoctorSlot, satisfactionDone, onStart }: {
  bodyCompStatus: BodyCompStatus;
  myDoctorSlot: MyDoctorSlot | null;
  satisfactionDone: Record<SatisfactionContext, boolean>;
  onStart: (ctx: SatisfactionContext) => void;
}) {
  const { t } = useI18n();
  const now = useNow();
  const bcReady = bodyCompStatus === "completed" && !satisfactionDone.body_comp;
  const drReady = myDoctorSlot != null && new Date(myDoctorSlot.slot_at).getTime() < now && !satisfactionDone.doctor;
  if (!bcReady && !drReady) return null;
  const pending: Array<{ key: SatisfactionContext; title: string }> = [];
  if (bcReady) pending.push({ key: "body_comp", title: t("acct.survey.bodycomp", "Hvernig var líkamssamsetningarmælingin?") });
  if (drReady) pending.push({ key: "doctor", title: t("acct.survey.doctor", "Hvernig var viðtalið við lækninn?") });
  return (
    <>
      {pending.map((p) => (
        <SectionCard key={p.key} icon={MessageSquareText} title={p.title}
          description={t("acc.survey.sat-desc", "Tvær stuttar spurningar og athugasemd ef þú vilt, um 30 sekúndur.")}
          action={<Button size="sm" variant="secondary" onClick={() => onStart(p.key)}>{t("acct.q.feedback", "Senda ábendingu")}</Button>} />
      ))}
    </>
  );
}
