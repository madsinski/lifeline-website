"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Alert, Button, Modal, accountInput, accountLabel, friendlyError } from "@/app/components/account/ui";

type Props = {
  companyId: string | null;
  context: "body_comp" | "doctor" | "overall";
  onClose: () => void;
  onSubmitted: () => void;
};

const TITLES = (t: (k: string, f?: string) => string) => (
  {
  body_comp: t("acct.survey.bodycomp", "Hvernig var líkamssamsetningarmælingin?"),
  doctor: t("acct.survey.doctor", "Hvernig var viðtalið við lækninn?"),
  overall: t("acct.survey.howwas", "Hvernig var upplifunin hjá Lifeline?"),
}
);

export default function SatisfactionSurveyModal({ companyId, context, onClose, onSubmitted }: Props) {
  const { t } = useI18n();
  const [nps, setNps] = useState<number | null>(null);
  const [helpful, setHelpful] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (nps == null) { setError(t("acct.survey.pick010", "Veldu einkunn frá 0 til 10.")); return; }
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setError(t("acct.mustsignin", "Þú þarft að skrá þig inn.")); return; }
    const { error: upErr } = await supabase.from("client_satisfaction_surveys").upsert({
      client_id: user.id,
      company_id: companyId,
      context,
      nps,
      helpful: helpful ?? null,
      comment: comment.trim() || null,
    }, { onConflict: "client_id,context" });
    setSaving(false);
    if (upErr) { setError(friendlyError(upErr, t("acct.survey.sendfailed", "Svörin sendust ekki. Reyndu aftur."))); return; }
    onSubmitted();
    onClose();
  }

  const pick = (on: boolean) =>
    `rounded-hc-element py-2 text-sm font-semibold ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
      on ? "bg-hc-brand-surface text-hc-brand-text ring-2 ring-hc-brand-dark" : "bg-hc-surface text-hc-ink-2 ring-slate-200 hover:ring-hc-control"}`;

  return (
    <Modal title={TITLES(t)[context]} onClose={onClose} dismissable={!saving}
      description={companyId
        ? t("acct.survey.lead-b2b", "Tekur um 30 sekúndur. Svörin þín eru trúnaðarmál; fyrirtækið sér aðeins samantekna heildarmynd.")
        : t("acct.survey.lead", "Tekur um 30 sekúndur. Svörin þín eru trúnaðarmál og hjálpa okkur að bæta þjónustuna.")}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t("acct.q.later", "Síðar")}</Button>
        <Button onClick={submit} busy={saving} disabled={nps == null}>{t("acct.survey.submit", "Senda")}</Button>
      </>}>
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-hc-ink">{t("acct.survey.nps", "Hversu líklegt er að þú mælir með Lifeline við samstarfsfólk eða vini?")}</legend>
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-11">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button key={n} type="button" aria-pressed={nps === n} onClick={() => setNps(n)} className={pick(nps === n)}>{n}</button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-hc-ink-3">
            <span>{t("acct.survey.unlikely", "Ólíklegt")}</span>
            <span>{t("acct.survey.verylikely", "Mjög líklegt")}</span>
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-hc-ink">{t("acct.survey.howuseful", "Hversu gagnlegt var þetta fyrir þig?")}</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-pressed={helpful === n} onClick={() => setHelpful(n)} className={pick(helpful === n)}>{n}</button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-hc-ink-3">
            <span>{t("acct.q.notuseful", "Ekki gagnlegt")}</span>
            <span>{t("acct.survey.veryuseful", "Mjög gagnlegt")}</span>
          </div>
        </fieldset>
        <label className="block">
          <span className={accountLabel}>{t("acct.survey.better", "Eitthvað sem við gætum gert betur? (valfrjálst)")}</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className={`${accountInput} mt-1`} />
        </label>
        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}
