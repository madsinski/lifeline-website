"use client";

// Public survey page. The `token` in the URL is the auth — no
// session is required. We fetch survey + questions via the public
// /api/feedback/[token] endpoint, render the form one chapter at a
// time (questions are grouped by section_index), and POST the
// combined answer set on the final chapter. Server validates
// required completeness against the canonical question list.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  SurveyQuestionBlock,
  groupSurveyChapters,
  type SurveyRenderQuestion as Question,
  type SurveyAnswerState as AnswerState,
  type SurveyChapter as Chapter,
} from "@/app/components/SurveyQuestionBlock";

interface Survey {
  id: string;
  title_is: string;
  intro_is: string | null;
  outro_is: string | null;
  estimated_minutes: number;
}

const isAnswered = (q: Question, a: AnswerState | undefined): boolean => {
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
};

export default function PublicSurveyPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [chapterIdx, setChapterIdx] = useState(0); // 0-based index into chapters
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

  const chapters = useMemo<Chapter[]>(() => groupSurveyChapters(questions), [questions]);
  const currentChapter = chapters[chapterIdx];
  const isFirst = chapterIdx === 0;
  const isLast = chapterIdx === chapters.length - 1;

  const setAnswer = (qid: string, patch: AnswerState) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
    setValidationErrors((prev) => {
      const next = new Set(prev);
      next.delete(qid);
      return next;
    });
  };

  // Validate required questions in `qs`. Returns the missing ids; empty if
  // everything required is answered (or skipped).
  const findMissing = (qs: Question[]): Set<string> => {
    const missing = new Set<string>();
    for (const q of qs) {
      if (!q.required) continue;
      if (!isAnswered(q, answers[q.id])) missing.add(q.id);
    }
    return missing;
  };

  const goToChapter = (next: number) => {
    setValidationErrors(new Set());
    setSubmitError(null);
    setChapterIdx(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleContinue = () => {
    if (!currentChapter) return;
    const missing = findMissing(currentChapter.questions);
    if (missing.size > 0) {
      setValidationErrors(missing);
      const first = document.getElementById(`q-${Array.from(missing)[0]}`);
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    goToChapter(chapterIdx + 1);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    // Final pass: validate all required across every chapter (defence in depth).
    const missing = findMissing(questions);
    if (missing.size > 0) {
      // Jump to the chapter holding the first missing question.
      const firstMissingId = Array.from(missing)[0];
      const idx = chapters.findIndex((c) => c.questions.some((q) => q.id === firstMissingId));
      if (idx >= 0 && idx !== chapterIdx) {
        setChapterIdx(idx);
      }
      setValidationErrors(missing);
      setTimeout(() => {
        const first = document.getElementById(`q-${firstMissingId}`);
        if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
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
  if (!currentChapter || chapters.length === 0) {
    return (
      <CenteredCard>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Engar spurningar</h1>
        <p className="text-sm text-gray-600">Þessi könnun er tóm. Hafðu samband við Lifeline.</p>
      </CenteredCard>
    );
  }

  // Question numbers across the whole survey, regardless of chapter.
  const questionNumberMap = new Map(questions.map((q, i) => [q.id, i] as const));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-1">
            Lifeline Health · Þjónustukönnun
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{survey.title_is}</h1>
          {isFirst && survey.intro_is && (
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mt-3">{survey.intro_is}</div>
          )}
          {isFirst && recipientName && (
            <p className="text-xs text-gray-400 mt-3">Sent á {recipientName.split(" ")[0]}.</p>
          )}
        </header>

        <ChapterProgress chapters={chapters} currentIdx={chapterIdx} />

        <section className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-1">
            Kafli {chapterIdx + 1} af {chapters.length}
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">{currentChapter.title}</h2>
        </section>

        <div className="space-y-4">
          {currentChapter.questions.map((q) => (
            <SurveyQuestionBlock
              key={q.id}
              q={q}
              idx={questionNumberMap.get(q.id) ?? 0}
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

        <div className="mt-8 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            disabled={isFirst || submitting}
            onClick={() => goToChapter(chapterIdx - 1)}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Til baka
          </button>
          {isLast ? (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="px-6 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {submitting ? "Sendi..." : "Senda svör"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              className="px-6 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Áfram →
            </button>
          )}
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

function ChapterProgress({ chapters, currentIdx }: { chapters: Chapter[]; currentIdx: number }) {
  const pct = chapters.length === 0 ? 0 : Math.round(((currentIdx + 1) / chapters.length) * 100);
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 mb-1.5">
        <span>{currentIdx + 1} / {chapters.length}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

