"use client";

// Public survey page. The `token` in the URL is the auth — no
// session is required. We fetch survey + questions via the public
// /api/feedback/[token] endpoint, render the form, then POST back
// to the same endpoint on submit. Server validates required
// completeness against the canonical question list.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

interface Option { value: string; label_is: string; label_en?: string }
interface Question {
  id: string;
  order_index: number;
  question_type: "likert5" | "singleselect" | "multiselect" | "nps10" | "open" | "consent_optional";
  label_is: string;
  helper_is: string | null;
  options_jsonb: Option[] | null;
  required: boolean;
  allow_skip: boolean;
  skip_label_is: string | null;
}
interface Survey {
  id: string;
  title_is: string;
  intro_is: string | null;
  outro_is: string | null;
  estimated_minutes: number;
}

interface AnswerState {
  value?: string;
  values_array?: string[];
  text_value?: string;
  skipped?: boolean;
}

const SKIP_VALUE = "__skipped__";

export default function PublicSurveyPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/feedback/${token}`);
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          setLoadError(j.error || "Tókst ekki að hlaða könnuninni.");
          return;
        }
        setSurvey(j.survey);
        setQuestions(j.questions || []);
        setRecipientName(j.recipient_name || null);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const setAnswer = (qid: string, patch: AnswerState) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
    setValidationErrors((prev) => {
      const next = new Set(prev);
      next.delete(qid);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    // Client-side required check (server re-validates).
    const missing = new Set<string>();
    for (const q of questions) {
      const a = answers[q.id];
      if (!q.required) continue;
      const isAnswered = (() => {
        if (!a) return false;
        if (a.skipped) return true;
        switch (q.question_type) {
          case "likert5":
          case "singleselect":
          case "nps10":
            return !!a.value;
          case "multiselect":
            return Array.isArray(a.values_array) && a.values_array.length > 0;
          case "open":
            return !!(a.text_value && a.text_value.trim());
          case "consent_optional":
            return !!a.value;
        }
      })();
      if (!isAnswered) missing.add(q.id);
    }
    if (missing.size > 0) {
      setValidationErrors(missing);
      const first = document.getElementById(`q-${Array.from(missing)[0]}`);
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        answers: questions
          .filter((q) => answers[q.id] !== undefined)
          .map((q) => {
            const a = answers[q.id];
            return {
              question_id: q.id,
              skipped: !!a.skipped,
              value: a.value ?? null,
              values_array: a.values_array ?? null,
              text_value: a.text_value ?? null,
            };
          }),
      };
      const res = await fetch(`/api/feedback/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Tókst ekki að senda svörin.");
      setSubmitted(true);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <CenteredCard><p className="text-sm text-gray-500">Hleð könnun...</p></CenteredCard>;
  }
  if (loadError) {
    return (
      <CenteredCard>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Ekki tókst að opna könnunina</h1>
        <p className="text-sm text-gray-600">{loadError}</p>
        <p className="text-xs text-gray-400 mt-6">Lifeline Health · contact@lifelinehealth.is</p>
      </CenteredCard>
    );
  }
  if (submitted && survey) {
    return (
      <CenteredCard>
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Takk fyrir!</h1>
        <p className="text-sm text-gray-600 whitespace-pre-line text-center">
          {survey.outro_is || "Þín endurgjöf skiptir okkur miklu máli."}
        </p>
        <p className="text-xs text-gray-400 mt-8 text-center">— Lifeline Health</p>
      </CenteredCard>
    );
  }
  if (!survey) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-1">
            Lifeline Health · Þjónustukönnun
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{survey.title_is}</h1>
          {survey.intro_is && (
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{survey.intro_is}</div>
          )}
          {recipientName && (
            <p className="text-xs text-gray-400 mt-3">Sent á {recipientName.split(" ")[0]}.</p>
          )}
        </header>

        <div className="space-y-4">
          {questions.map((q, idx) => (
            <QuestionBlock
              key={q.id}
              q={q}
              idx={idx}
              answer={answers[q.id]}
              hasError={validationErrors.has(q.id)}
              onChange={(patch) => setAnswer(q.id, patch)}
            />
          ))}
        </div>

        {validationErrors.size > 0 && (
          <div className="mt-6 bg-orange-50 border border-orange-200 text-orange-800 rounded-lg px-4 py-3 text-sm">
            Vinsamlegast svaraðu öllum spurningum sem eru merktar með *.
          </div>
        )}
        {submitError && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {submitError}
          </div>
        )}

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="px-6 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "Sendi..." : "Senda svör"}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-12">
          Lifeline Health ehf. · Reykjavík · contact@lifelinehealth.is
        </p>
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-8">
        {children}
      </div>
    </div>
  );
}

function QuestionBlock({
  q, idx, answer, hasError, onChange,
}: {
  q: Question;
  idx: number;
  answer: AnswerState | undefined;
  hasError: boolean;
  onChange: (patch: AnswerState) => void;
}) {
  const options = useMemo(() => q.options_jsonb || [], [q.options_jsonb]);
  const skipLabel = q.skip_label_is || "Á ekki við";
  const isSkipped = answer?.skipped === true;

  return (
    <section
      id={`q-${q.id}`}
      className={`bg-white rounded-xl border p-5 transition-colors ${
        hasError ? "border-orange-300 bg-orange-50/30" : "border-gray-200"
      }`}
    >
      <div className="mb-3">
        <p className="text-[11px] font-mono text-gray-400 mb-0.5">Spurning {idx + 1} / {q.required ? "*" : "valfrjáls"}</p>
        <h3 className="text-base font-semibold text-gray-900 leading-snug">{q.label_is}</h3>
        {q.helper_is && <p className="text-xs text-gray-500 mt-1">{q.helper_is}</p>}
      </div>

      {/* likert5 / singleselect — radio buttons */}
      {(q.question_type === "likert5" || q.question_type === "singleselect") && (
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt.value} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${
              !isSkipped && answer?.value === opt.value
                ? "border-emerald-500 bg-emerald-50"
                : "border-gray-200 hover:border-gray-300"
            }`}>
              <input
                type="radio"
                name={`q-${q.id}`}
                checked={!isSkipped && answer?.value === opt.value}
                onChange={() => onChange({ value: opt.value, skipped: false })}
                className="w-4 h-4 text-emerald-600"
              />
              <span className="text-sm text-gray-800">{opt.label_is}</span>
            </label>
          ))}
          {q.allow_skip && (
            <label className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${
              isSkipped ? "border-gray-400 bg-gray-100" : "border-gray-200 hover:border-gray-300"
            }`}>
              <input
                type="radio"
                name={`q-${q.id}`}
                checked={isSkipped}
                onChange={() => onChange({ skipped: true, value: SKIP_VALUE })}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-500 italic">{skipLabel}</span>
            </label>
          )}
        </div>
      )}

      {/* multiselect — checkboxes */}
      {q.question_type === "multiselect" && (
        <div className="space-y-2">
          {options.map((opt) => {
            const checked = (answer?.values_array || []).includes(opt.value);
            return (
              <label key={opt.value} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${
                checked ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
              }`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const cur = answer?.values_array || [];
                    const next = e.target.checked ? [...cur, opt.value] : cur.filter((v) => v !== opt.value);
                    onChange({ values_array: next, skipped: false });
                  }}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="text-sm text-gray-800">{opt.label_is}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* nps10 — 0-10 scale */}
      {q.question_type === "nps10" && (
        <div>
          <div className="grid grid-cols-11 gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
              const selected = answer?.value === String(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ value: String(n), skipped: false })}
                  className={`aspect-square rounded-lg text-sm font-semibold transition-colors ${
                    selected
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-1">
            <span>Ólíklegt</span>
            <span>Mjög líklegt</span>
          </div>
        </div>
      )}

      {/* open — textarea */}
      {q.question_type === "open" && (
        <textarea
          value={answer?.text_value || ""}
          onChange={(e) => onChange({ text_value: e.target.value, skipped: false })}
          rows={4}
          maxLength={5000}
          placeholder="Þín svör..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
        />
      )}

      {/* consent_optional — yes/no + optional text */}
      {q.question_type === "consent_optional" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {["yes", "no"].map((v) => {
              const selected = answer?.value === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ value: v })}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selected
                      ? v === "yes"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-gray-400 bg-gray-100 text-gray-800"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {v === "yes" ? "Já, ég vil deila" : "Nei takk"}
                </button>
              );
            })}
          </div>
          {answer?.value === "yes" && (
            <textarea
              value={answer?.text_value || ""}
              onChange={(e) => onChange({ text_value: e.target.value, value: "yes" })}
              rows={4}
              maxLength={5000}
              placeholder="Saga þín... (nafnlaus, ekki skylda að fylla út)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
            />
          )}
        </div>
      )}
    </section>
  );
}
