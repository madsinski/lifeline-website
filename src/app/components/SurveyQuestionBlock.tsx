"use client";

// Renders a single survey question in the client-facing form. Used by:
//   - /survey/[token]            — real client form (submits to /api/feedback)
//   - /admin/surveys/[id]/preview — admin/medical-advisor preview (no submit)
// Keep this file in lockstep with the QuestionType union in
// src/lib/feedback-survey-types.ts.

import { useMemo } from "react";

export interface SurveyOption {
  value: string;
  label_is: string;
  label_en?: string;
}

export type SurveyQuestionType =
  | "likert5"
  | "singleselect"
  | "multiselect"
  | "nps10"
  | "open"
  | "consent_optional";

export interface SurveyRenderQuestion {
  id: string;
  order_index: number;
  // Chapter index. Used by page-level pagination (SurveyQuestionBlock itself
  // doesn't render headers — sections are grouped + headed at the page level).
  section_index?: number;
  section_title_is?: string | null;
  question_type: SurveyQuestionType;
  label_is: string;
  helper_is: string | null;
  options_jsonb: SurveyOption[] | null;
  required: boolean;
  allow_skip: boolean;
  skip_label_is: string | null;
}

export interface SurveyAnswerState {
  value?: string;
  values_array?: string[];
  text_value?: string;
  skipped?: boolean;
}

export const SURVEY_SKIP_VALUE = "__skipped__";

export interface SurveyChapter {
  index: number;
  title: string;
  questions: SurveyRenderQuestion[];
}

// Group questions into chapters by section_index, preserving original order.
// Single-section / legacy surveys collapse to one unnamed chapter.
export function groupSurveyChapters(qs: SurveyRenderQuestion[]): SurveyChapter[] {
  if (qs.length === 0) return [];
  const map = new Map<number, SurveyChapter>();
  for (const q of qs) {
    const key = q.section_index ?? 1;
    if (!map.has(key)) {
      map.set(key, { index: key, title: q.section_title_is || "", questions: [] });
    }
    map.get(key)!.questions.push(q);
  }
  return Array.from(map.values()).sort((a, b) => a.index - b.index);
}

export function SurveyQuestionBlock({
  q, idx, answer, hasError, onChange,
}: {
  q: SurveyRenderQuestion;
  idx: number;
  answer: SurveyAnswerState | undefined;
  hasError: boolean;
  onChange: (patch: SurveyAnswerState) => void;
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
                onChange={() => onChange({ skipped: true, value: SURVEY_SKIP_VALUE })}
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
