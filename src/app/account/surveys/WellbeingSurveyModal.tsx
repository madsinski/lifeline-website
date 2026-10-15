"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { Alert, Button, Modal, accountInput, accountLabel } from "@/app/components/account/ui";

type Props = {
  companyId: string | null;
  onClose: () => void;
  onSubmitted: () => void;
};

const WHO5_QUESTIONS = (t: (k: string, f?: string) => string) =>
  [
  { key: "w1_cheerful", label: t("acct.who5.q1", "I have felt cheerful and in good spirits") },
  { key: "w2_calm", label: t("acct.who5.q2", "I have felt calm and relaxed") },
  { key: "w3_active", label: t("acct.who5.q3", "I have felt active and vigorous") },
  { key: "w4_rested", label: t("acct.who5.q4", "I woke up feeling fresh and rested") },
  { key: "w5_interest", label: t("acct.who5.q5", "Daglegt líf mitt hefur verið fullt af því sem vekur áhuga minn") },
];

/*
 * The WHO-5 response scale, in Icelandic.
 *
 * The numbering is the original instrument's: 5 for "allan tímann" down to
 * 0 for "aldrei", so a higher total means better wellbeing and the raw
 * score is comparable with every published WHO-5 result.
 *
 * Worth knowing, because it looks like a contradiction: the University of
 * Iceland's Matstækjaskrá describes its Icelandic WHO-5 as running "frá 0
 * (alltaf) til 5 (aldrei)" — the reverse numbering — while also saying a
 * higher score means better wellbeing. Those two statements cannot both
 * hold for positively-worded items, so the entry is either describing a
 * reverse-scored variant or summarising loosely. Renumbering ours on the
 * strength of an ambiguous secondary source would invert every score we
 * have already stored, so the labels moved and the values did not. Worth a
 * look at the 2014 validation paper before anybody changes it.
 */
const SCALE = (t: (k: string, f?: string) => string) =>
  [
  { value: 5, label: t("acct.who5.s5", "Allan tímann") },
  { value: 4, label: t("acct.who5.s4", "Oftast") },
  { value: 3, label: t("acct.who5.s3", "Meira en helming tímans") },
  { value: 2, label: t("acct.who5.s2", "Minna en helming tímans") },
  { value: 1, label: t("acct.who5.s1", "Stundum") },
  { value: 0, label: t("acct.who5.s0", "Aldrei") },
];

export default function WellbeingSurveyModal({ companyId, onClose, onSubmitted }: Props) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allAnswered = WHO5_QUESTIONS(t).every((q) => answers[q.key] != null);

  async function submit() {
    if (!allAnswered) { setError(t("acct.who5.answerall", "Svaraðu öllum spurningum.")); return; }
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setError(t("acct.mustsignin", "Þú þarft að skrá þig inn.")); return; }
    const { error: insErr } = await supabase.from("client_wellbeing_surveys").insert({
      client_id: user.id,
      company_id: companyId,
      w1_cheerful: answers.w1_cheerful,
      w2_calm: answers.w2_calm,
      w3_active: answers.w3_active,
      w4_rested: answers.w4_rested,
      w5_interest: answers.w5_interest,
      note: note.trim() || null,
    });
    setSaving(false);
    if (insErr) { setError(insErr.message); return; }
    onSubmitted();
    onClose();
  }

  const pick = (on: boolean) =>
    `rounded-hc-element px-2 py-2 text-center text-xs font-medium leading-tight ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
      on ? "bg-hc-brand-surface text-hc-brand-text ring-2 ring-hc-brand-dark" : "bg-hc-surface text-hc-ink-2 ring-slate-200 hover:ring-hc-control"}`;

  return (
    <Modal title={t("acct.who5.title", "Líðanmat")} onClose={onClose} dismissable={!saving}
      description={<>
        {t("acct.who5.lead", "Síðustu tvær vikur: veldu svarið sem á best við.")}{" "}
        {companyId
          ? t("acct.who5.aggregate", "Svörin þín eru trúnaðarmál. Aðeins samanteknar niðurstöður (minnst 5 manns) fara til fyrirtækisins.")
          : t("acct.who5.confidential", "Svörin þín eru trúnaðarmál — notuð til að sníða ráðleggingar að þér og fylgjast með líðan yfir tíma.")}
      </>}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t("acct.q.later", "Síðar")}</Button>
        <Button onClick={submit} busy={saving} disabled={!allAnswered}>{t("acct.who5.submit", "Senda")}</Button>
      </>}>
      <div className="space-y-5">
        {WHO5_QUESTIONS(t).map((q, idx) => (
          <fieldset key={q.key}>
            <legend className="mb-2 text-sm font-medium text-hc-ink">{idx + 1}. {q.label}</legend>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {SCALE(t).map((sc) => {
                const selected = answers[q.key] === sc.value;
                return (
                  <button key={sc.value} type="button" aria-pressed={selected} onClick={() => setAnswers((a) => ({ ...a, [q.key]: sc.value }))} className={pick(selected)}>
                    <span className="mb-0.5 block text-base font-bold">{sc.value}</span>
                    <span className="block text-[11px] text-hc-ink-3">{sc.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <label className="block">
          <span className={accountLabel}>{t("acct.who5.addanything", "Viltu bæta einhverju við? (valfrjálst, fer aldrei til vinnuveitanda)")}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${accountInput} mt-1`} />
        </label>
        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}
