"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">{t("acct.who5.title", "Líðanmat")}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Over the last two weeks — choose the answer that best fits.{" "}
            {companyId
              ? t("acct.who5.aggregate", "Svörin þín eru trúnaðarmál. Aðeins samanteknar niðurstöður (minnst 5 manns) fara til fyrirtækisins.")
              : t("acct.who5.confidential", "Svörin þín eru trúnaðarmál — notuð til að sníða ráðleggingar að þér og fylgjast með líðan yfir tíma.")}
          </p>
        </div>
        <div className="p-6 space-y-5">
          {WHO5_QUESTIONS(t).map((q, idx) => (
            <div key={q.key}>
              <div className="text-sm font-medium text-gray-900 mb-2">{idx + 1}. {q.label}</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {SCALE(t).map((s) => {
                  const selected = answers[q.key] === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setAnswers((a) => ({ ...a, [q.key]: s.value }))}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium text-center leading-tight transition-colors ${selected ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200" : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300"}`}
                    >
                      <div className="text-base font-bold mb-0.5">{s.value}</div>
                      <div className="text-[10px] text-gray-500">{s.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t("acct.who5.addanything", "Viltu bæta einhverju við? (valfrjálst, fer aldrei til vinnuveitanda)")}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400" />
          </label>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Later</button>
          <button onClick={submit} disabled={saving || !allAnswered} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50">
            {saving ? "Saving…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
