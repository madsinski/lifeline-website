"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

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
    if (upErr) { setError(upErr.message); return; }
    onSubmitted();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">{TITLES(t)[context]}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Takes 30 seconds. Individual answers stay private
            {companyId ? "; your company sees only aggregated trends." : " — we use the signal to keep improving the service."}
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <div className="text-sm font-medium text-gray-900 mb-2">{t("acct.survey.nps", "Hversu líklegt er að þú mælir með Lifeline við samstarfsfólk eða vini?")}</div>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => i).map((n) => {
                const selected = nps === n;
                const color = n <= 6 ? "red" : n <= 8 ? "amber" : "emerald";
                return (
                  <button
                    key={n}
                    onClick={() => setNps(n)}
                    className={`aspect-square rounded-lg border text-sm font-semibold transition-colors ${
                      selected
                        ? color === "red" ? "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-200"
                        : color === "amber" ? "border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-200"
                        : "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >{n}</button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{t("acct.survey.unlikely", "Ólíklegt")}</span>
              <span>{t("acct.survey.verylikely", "Mjög líklegt")}</span>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 mb-2">{t("acct.survey.howuseful", "Hversu gagnlegt var þetta fyrir þig?")}</div>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const selected = helpful === n;
                return (
                  <button
                    key={n}
                    onClick={() => setHelpful(n)}
                    className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${selected ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200" : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"}`}
                  >{n} {n === 1 ? "★" : n === 5 ? "★★★★★" : ""}</button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Ekki gagnlegt</span>
              <span>{t("acct.survey.veryuseful", "Mjög gagnlegt")}</span>
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t("acct.survey.better", "Eitthvað sem við gætum gert betur? (valfrjálst)")}</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
          </label>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Later</button>
          <button onClick={submit} disabled={saving || nps == null} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50">
            {saving ? "Saving…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
