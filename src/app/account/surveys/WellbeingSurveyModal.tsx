"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  companyId: string | null;
  onClose: () => void;
  onSubmitted: () => void;
};

const WHO5_QUESTIONS: Array<{ key: "w1_cheerful" | "w2_calm" | "w3_active" | "w4_rested" | "w5_interest"; label: string }> = [
  { key: "w1_cheerful", label: "I have felt cheerful and in good spirits" },
  { key: "w2_calm", label: "I have felt calm and relaxed" },
  { key: "w3_active", label: "I have felt active and vigorous" },
  { key: "w4_rested", label: "I woke up feeling fresh and rested" },
  { key: "w5_interest", label: "My daily life has been filled with things that interest me" },
];

const SCALE: Array<{ value: number; label: string }> = [
  { value: 5, label: "All of the time" },
  { value: 4, label: "Most of the time" },
  { value: 3, label: "More than half of the time" },
  { value: 2, label: "Less than half of the time" },
  { value: 1, label: "Some of the time" },
  { value: 0, label: "At no time" },
];

export default function WellbeingSurveyModal({ companyId, onClose, onSubmitted }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allAnswered = WHO5_QUESTIONS.every((q) => answers[q.key] != null);

  async function submit() {
    if (!allAnswered) { setError("Please answer every question."); return; }
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setError("Not signed in."); return; }
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
          <h2 className="text-xl font-semibold">Wellbeing check-in</h2>
          <p className="text-sm text-gray-600 mt-1">
            Over the last two weeks — choose the answer that best fits.{" "}
            {companyId
              ? "Your individual answers stay private; only aggregated trends (min 5 people) are shared with your company."
              : "Your answers stay private — used to personalise your insights and track your wellbeing over time."}
          </p>
        </div>
        <div className="p-6 space-y-5">
          {WHO5_QUESTIONS.map((q, idx) => (
            <div key={q.key}>
              <div className="text-sm font-medium text-gray-900 mb-2">{idx + 1}. {q.label}</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {SCALE.map((s) => {
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
            <span className="text-sm font-medium text-gray-700">Anything else you want to share? (optional, never shared with your employer)</span>
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
