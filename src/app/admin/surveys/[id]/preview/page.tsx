"use client";

// Admin/medical-advisor preview of a survey. Renders the exact same form
// clients see at /survey/[token] — paginated by chapter (section_index)
// — but loads survey + questions directly from supabase (staff RLS)
// instead of via a completion token, and replaces submit with a
// "preview only" notice. A toggle flips to the success/outro screen so
// staff can verify what the client sees after submitting.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  SurveyQuestionBlock,
  groupSurveyChapters,
  type SurveyRenderQuestion,
  type SurveyAnswerState,
  type SurveyChapter,
} from "@/app/components/SurveyQuestionBlock";
import {
  type FeedbackSurvey,
  type FeedbackQuestion,
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
} from "@/lib/feedback-survey-types";

const isAnswered = (q: SurveyRenderQuestion, a: SurveyAnswerState | undefined): boolean => {
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

export default function SurveyPreviewPage() {
  const params = useParams<{ id: string }>();
  const surveyId = params?.id;

  const [survey, setSurvey] = useState<FeedbackSurvey | null>(null);
  const [questions, setQuestions] = useState<SurveyRenderQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerState>>({});
  const [chapterIdx, setChapterIdx] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoadError("Not signed in.");
          return;
        }
        const [{ data: surveyRow, error: sErr }, { data: questionRows, error: qErr }] = await Promise.all([
          supabase.from("feedback_surveys").select("*").eq("id", surveyId).maybeSingle(),
          supabase
            .from("feedback_questions")
            .select("*")
            .eq("survey_id", surveyId)
            .order("section_index", { ascending: true })
            .order("order_index", { ascending: true }),
        ]);
        if (cancelled) return;
        if (sErr || !surveyRow) {
          setLoadError(sErr?.message || "Survey not found.");
          return;
        }
        if (qErr) {
          setLoadError(qErr.message);
          return;
        }
        setSurvey(surveyRow as FeedbackSurvey);
        setQuestions(((questionRows || []) as FeedbackQuestion[]).map((q) => ({
          id: q.id,
          order_index: q.order_index,
          section_index: q.section_index,
          section_title_is: q.section_title_is,
          question_type: q.question_type,
          label_is: q.label_is,
          helper_is: q.helper_is,
          options_jsonb: q.options_jsonb,
          required: q.required,
          allow_skip: q.allow_skip,
          skip_label_is: q.skip_label_is,
        })));
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [surveyId]);

  const chapters = useMemo<SurveyChapter[]>(() => groupSurveyChapters(questions), [questions]);
  const currentChapter = chapters[chapterIdx];
  const isFirst = chapterIdx === 0;
  const isLast = chapterIdx === chapters.length - 1;

  const setAnswer = (qid: string, patch: SurveyAnswerState) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
    setValidationErrors((prev) => {
      const next = new Set(prev);
      next.delete(qid);
      return next;
    });
  };

  const findMissing = (qs: SurveyRenderQuestion[]): Set<string> => {
    const missing = new Set<string>();
    for (const q of qs) {
      if (!q.required) continue;
      if (!isAnswered(q, answers[q.id])) missing.add(q.id);
    }
    return missing;
  };

  const goToChapter = (next: number) => {
    setValidationErrors(new Set());
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

  const handlePreviewSubmit = () => {
    const missing = findMissing(questions);
    if (missing.size > 0) {
      const firstMissingId = Array.from(missing)[0];
      const idx = chapters.findIndex((c) => c.questions.some((q) => q.id === firstMissingId));
      if (idx >= 0 && idx !== chapterIdx) setChapterIdx(idx);
      setValidationErrors(missing);
      setTimeout(() => {
        const first = document.getElementById(`q-${firstMissingId}`);
        if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setShowSuccess(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetPreview = () => {
    setShowSuccess(false);
    setAnswers({});
    setChapterIdx(0);
    setValidationErrors(new Set());
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>;
  }
  if (loadError || !survey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Could not load preview</h1>
        <p className="text-sm text-gray-600 mb-6">{loadError || "Survey not found."}</p>
        <Link href="/admin/surveys" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 underline">
          ← Back to surveys
        </Link>
      </div>
    );
  }

  // Question numbering across the whole survey, not within the chapter.
  const questionNumberMap = new Map(questions.map((q, i) => [q.id, i] as const));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <PreviewBanner survey={survey} showSuccess={showSuccess} onReset={resetPreview} />

      {showSuccess ? (
        <div className="flex items-center justify-center px-4 py-16">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-8">
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
          </div>
        </div>
      ) : (
        <div className="py-10 px-4">
          <div className="max-w-2xl mx-auto">
            <header className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-1">
                Lifeline Health · Þjónustukönnun
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{survey.title_is}</h1>
              {isFirst && survey.intro_is && (
                <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mt-3">{survey.intro_is}</div>
              )}
              {isFirst && (
                <p className="text-xs text-gray-400 mt-3">Áætlaður tími: {survey.estimated_minutes} mín</p>
              )}
            </header>

            {chapters.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                Engar spurningar eru í þessari könnun. Bættu við spurningum í ritlinum.
              </div>
            ) : (
              <>
                <ChapterProgress chapters={chapters} currentIdx={chapterIdx} />

                {currentChapter && (
                  <>
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

                    <div className="mt-8 flex items-center justify-between gap-3 flex-wrap">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => goToChapter(chapterIdx - 1)}
                        className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ← Til baka
                      </button>
                      {isLast ? (
                        <button
                          type="button"
                          onClick={handlePreviewSubmit}
                          className="px-6 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Senda svör (preview)
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
                  </>
                )}
              </>
            )}

            <p className="text-xs text-gray-400 text-center mt-12">
              Lifeline Health ehf. · Reykjavík · contact@lifelinehealth.is
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewBanner({
  survey, showSuccess, onReset,
}: {
  survey: FeedbackSurvey;
  showSuccess: boolean;
  onReset: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-semibold uppercase tracking-wide">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview mode
          </span>
          <span className="text-amber-900">
            <span className="font-mono">{survey.key} v{survey.version}</span>
            {" · "}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${STATUS_BADGE_CLASS[survey.status]}`}>
              {STATUS_LABEL[survey.status]}
            </span>
          </span>
          <span className="text-amber-800/80 hidden sm:inline">Engin svör verða vistuð.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1 text-[11px] font-medium text-amber-900 bg-white border border-amber-300 rounded-md hover:bg-amber-100 transition-colors"
          >
            {showSuccess ? "← Test again" : "Reset"}
          </button>
          <Link
            href={`/admin/surveys/${survey.id}`}
            className="px-3 py-1 text-[11px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            ← Back to editor
          </Link>
        </div>
      </div>
    </div>
  );
}

function ChapterProgress({ chapters, currentIdx }: { chapters: SurveyChapter[]; currentIdx: number }) {
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
