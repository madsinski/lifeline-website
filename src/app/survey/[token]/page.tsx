"use client";

// Public survey page. The `token` in the URL is the auth — no
// session is required. We fetch survey + questions via the public
// /api/feedback/[token] endpoint, render the form, then POST back
// to the same endpoint on submit. Server validates required
// completeness against the canonical question list.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  SurveyQuestionBlock,
  type SurveyRenderQuestion as Question,
  type SurveyAnswerState as AnswerState,
} from "@/app/components/SurveyQuestionBlock";

interface Survey {
  id: string;
  title_is: string;
  intro_is: string | null;
  outro_is: string | null;
  estimated_minutes: number;
}

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
            <SurveyQuestionBlock
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

