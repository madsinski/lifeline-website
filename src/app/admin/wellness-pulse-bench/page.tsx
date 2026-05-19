"use client";

// Wellness Pulse test bench — staff-only preview of the in-app
// monthly self-assessment. Renders every question from the catalog
// and shows the computed Lífstílseinkunn + pillar breakdown live as
// answers change. Nothing is persisted; refresh resets state.
//
// Purpose: let the wellness team see how question weights interact,
// validate that no validated clinical instrument has crept in, and
// iterate on copy before locking a new release of the mobile catalog.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  WELLNESS_PULSE_QUESTIONS, PILLAR_LABELS, type Pillar, type PulseAnswers,
  computeLifestyleScore, pulseBand, pulseBandColor, pulseBandLabel,
} from "@/lib/wellnessPulse";

export default function WellnessPulseBenchPage() {
  const [answers, setAnswers] = useState<PulseAnswers>({});
  const [showCatalogMeta, setShowCatalogMeta] = useState(false);

  const result = useMemo(() => computeLifestyleScore(answers), [answers]);

  const setAnswer = (qid: string, a: PulseAnswers[string]) =>
    setAnswers((cur) => ({ ...cur, [qid]: a }));

  const clearAll = () => setAnswers({});
  const fillRandom = () => {
    const out: PulseAnswers = {};
    for (const q of WELLNESS_PULSE_QUESTIONS) {
      if (q.format.type === "choice") {
        const opts = q.format.options;
        const pick = opts[Math.floor(Math.random() * opts.length)];
        out[q.id] = { type: "choice", code: pick.code ?? pick.label };
      } else if (q.format.type === "slider1to10") {
        out[q.id] = { type: "slider1to10", value: Math.ceil(Math.random() * 10) };
      } else if (q.format.type === "multiselect") {
        const opts = q.format.options;
        const codes = opts.filter(() => Math.random() < 0.3).map((o) => o.code);
        out[q.id] = { type: "multiselect", codes };
      }
    }
    setAnswers(out);
  };

  const grouped = useMemo(() => {
    const g: Record<Pillar, typeof WELLNESS_PULSE_QUESTIONS> = {
      sleep: [], exercise: [], nutrition: [], mental: [], addictive: [],
    };
    for (const q of WELLNESS_PULSE_QUESTIONS) g[q.pillar].push(q);
    return g;
  }, []);

  return (
    <div className="px-8 py-6 max-w-6xl">
      <div className="flex items-start justify-between mb-4 gap-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Wellness pulse bench</h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            Preview the in-app monthly self-assessment. Answer any subset of the 23 questions
            and watch the Lífstílseinkunn and pillar scores compute live. Nothing is saved —
            this is staff-only test ground. The catalog is mirrored from
            <code className="px-1 py-0.5 mx-1 rounded bg-gray-100 text-xs">src/lib/wellnessPulse.ts</code>
            in the RN app; keep them in sync.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowCatalogMeta((v) => !v)}
            className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
          >
            {showCatalogMeta ? "Hide" : "Show"} catalog meta
          </button>
          <button
            onClick={fillRandom}
            className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100"
          >
            Random fill
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium hover:bg-gray-200"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left + middle: questions grouped by pillar */}
        <div className="lg:col-span-2 space-y-5">
          {(Object.keys(grouped) as Pillar[]).map((p) => {
            const qs = grouped[p];
            const breakdown = result.pillarScores.find((x) => x.pillar === p);
            const band = breakdown ? pulseBand(breakdown.score) : "lelegt";
            const bColor = breakdown && breakdown.questionCount > 0 ? pulseBandColor(band) : "#9CA3AF";
            return (
              <div key={p} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900">{PILLAR_LABELS[p]}</h2>
                  {breakdown && breakdown.questionCount > 0 && (
                    <span style={{ color: bColor }} className="text-xl font-extrabold">
                      {breakdown.score.toFixed(1)} <span className="text-xs font-semibold">/10</span>
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                  {qs.map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      answer={answers[q.id]}
                      onAnswer={(a) => setAnswer(q.id, a)}
                      showMeta={showCatalogMeta}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: live score panel (sticky on desktop) */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sticky top-4">
            <ScorePanel result={result} totalQ={WELLNESS_PULSE_QUESTIONS.length} />

            {/* Catalog provenance audit */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Catalog provenance</h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>· Reused from Heilsumat habits: <strong>{WELLNESS_PULSE_QUESTIONS.filter((q) => q.source === "heilsumat").length}</strong> qs</li>
                <li>· Lifeline-authored (no validated screens): <strong>{WELLNESS_PULSE_QUESTIONS.filter((q) => q.source === "lifeline").length}</strong> qs</li>
                <li>· Total: <strong>{WELLNESS_PULSE_QUESTIONS.length}</strong> qs across 5 pillars</li>
              </ul>
              <p className="text-[10px] text-gray-400 mt-3 leading-snug">
                No PHQ-9 · No GAD-7 · No PSS-10 · No WHO-5 · No AUDIT · No Fagerström.
                Clinical scores stay in Medalia (regulated platform); the app is wellness-only.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <Link
                href="/admin/onboarding-bench"
                className="text-xs text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                ↗ Onboarding bench
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  question, answer, onAnswer, showMeta,
}: {
  question: typeof WELLNESS_PULSE_QUESTIONS[number];
  answer: PulseAnswers[string] | undefined;
  onAnswer: (a: PulseAnswers[string]) => void;
  showMeta: boolean;
}) {
  return (
    <div className="border-l-2 border-gray-200 pl-3">
      <p className="text-sm font-semibold text-gray-800">{question.prompt}</p>
      {question.hint && (
        <p className="text-xs text-gray-500 mt-0.5 italic">{question.hint}</p>
      )}
      {showMeta && (
        <p className="text-[10px] text-gray-400 mt-1 font-mono">
          {question.id} · source: {question.source}
          {question.heilsumatLinkId ? ` · heilsumat: ${question.heilsumatLinkId}` : ""}
        </p>
      )}

      <div className="mt-2">
        {question.format.type === "choice" && (
          <div className="flex flex-wrap gap-2">
            {question.format.options.map((opt) => {
              const code = opt.code ?? opt.label;
              const active = answer?.type === "choice" && answer.code === code;
              return (
                <button
                  key={code}
                  onClick={() => onAnswer({ type: "choice", code })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                  <span className={`ml-2 text-[10px] ${active ? "text-emerald-100" : "text-gray-400"}`}>
                    {opt.score}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {question.format.type === "slider1to10" && (
          <div className="flex gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const active = answer?.type === "slider1to10" && answer.value === n;
              return (
                <button
                  key={n}
                  onClick={() => onAnswer({ type: "slider1to10", value: n })}
                  className={`flex-1 py-2 rounded-md text-xs font-bold border transition-colors ${
                    active
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        )}

        {question.format.type === "multiselect" && (
          <div className="flex flex-wrap gap-2">
            {question.format.options.map((opt) => {
              const codes = answer?.type === "multiselect" ? answer.codes : [];
              const active = codes.includes(opt.code);
              return (
                <button
                  key={opt.code}
                  onClick={() => {
                    const next = active
                      ? codes.filter((c) => c !== opt.code)
                      : [...codes, opt.code];
                    onAnswer({ type: "multiselect", codes: next });
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ScorePanel({
  result, totalQ,
}: {
  result: ReturnType<typeof computeLifestyleScore>;
  totalQ: number;
}) {
  const band = pulseBand(result.lifestyleScore);
  const bColor = pulseBandColor(band);
  const answered = Math.round(result.completeness * totalQ);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Lífstílseinkunn</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span style={{ color: bColor }} className="text-5xl font-black leading-none">
          {result.lifestyleScore.toFixed(1)}
        </span>
        <span style={{ color: bColor }} className="text-sm font-bold">
          {pulseBandLabel(band)}
        </span>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        {answered}/{totalQ} questions answered · {Math.round(result.completeness * 100)}% complete
      </p>

      <div className="mt-4 space-y-2">
        {result.pillarScores.map((p) => {
          const empty = p.questionCount === 0;
          const c = empty ? "#D1D5DB" : pulseBandColor(pulseBand(p.score));
          return (
            <div key={p.pillar}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-gray-700">{PILLAR_LABELS[p.pillar]}</span>
                <span style={{ color: c }} className="font-bold">
                  {empty ? "—" : p.score.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                <div
                  style={{
                    width: `${empty ? 0 : (p.score / 10) * 100}%`,
                    backgroundColor: c,
                  }}
                  className="h-full transition-all"
                />
              </div>
            </div>
          );
        })}
      </div>

      {result.flags.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-xs font-bold text-amber-800 mb-1">Flagged as out of balance:</p>
          <p className="text-xs text-amber-700">{result.flags.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
