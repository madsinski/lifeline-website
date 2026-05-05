"use client";

// Results + analytics for a single survey.
// - Headline metrics (responses, completion rate, NPS).
// - Per-question distribution (Likert + multi-select bar charts,
//   NPS breakdown, single-select counts).
// - Open-text browser (scrollable list of free-text answers).
// - CSV export button (admin + medical_advisor both).
//
// Visible to admin and medical_advisor.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { FeedbackSurvey, FeedbackQuestion, QuestionType } from "@/lib/feedback-survey-types";

interface AssignmentRow {
  id: string;
  sent_at: string;
  completed_at: string | null;
  expires_at: string;
}
interface ResponseRow {
  id: string;
  assignment_id: string;
  question_id: string;
  value: string | null;
  values_array: string[] | null;
  text_value: string | null;
  skipped: boolean;
  created_at: string;
}

export default function SurveyResultsPage() {
  const params = useParams<{ id: string }>();
  const surveyId = params?.id;
  const [role, setRole] = useState<string | null>(null);
  const [survey, setSurvey] = useState<FeedbackSurvey | null>(null);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!surveyId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: staffRow } = await supabase
            .from("staff")
            .select("role")
            .eq("email", user.email)
            .maybeSingle();
          if (!cancelled) setRole((staffRow?.role as string) || null);
        }

        const { data: surveyRow } = await supabase
          .from("feedback_surveys")
          .select("*")
          .eq("id", surveyId)
          .maybeSingle();
        if (cancelled) return;
        setSurvey((surveyRow as FeedbackSurvey) || null);

        const { data: qRows } = await supabase
          .from("feedback_questions")
          .select("*")
          .eq("survey_id", surveyId)
          .order("order_index", { ascending: true });
        if (cancelled) return;
        setQuestions(((qRows || []) as FeedbackQuestion[]));

        const { data: aRows } = await supabase
          .from("feedback_assignments")
          .select("id, sent_at, completed_at, expires_at")
          .eq("survey_id", surveyId)
          .order("sent_at", { ascending: false });
        if (cancelled) return;
        const assignmentList = ((aRows || []) as AssignmentRow[]);
        setAssignments(assignmentList);

        if (assignmentList.length > 0) {
          const completedIds = assignmentList.filter((a) => a.completed_at).map((a) => a.id);
          if (completedIds.length > 0) {
            const { data: rRows } = await supabase
              .from("feedback_responses")
              .select("*")
              .in("assignment_id", completedIds);
            if (cancelled) return;
            setResponses(((rRows || []) as ResponseRow[]));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [surveyId]);

  const totals = useMemo(() => {
    const sent = assignments.length;
    const completed = assignments.filter((a) => a.completed_at).length;
    const completionRate = sent > 0 ? Math.round((completed / sent) * 100) : 0;
    return { sent, completed, completionRate };
  }, [assignments]);

  const responsesByQuestion = useMemo(() => {
    const map = new Map<string, ResponseRow[]>();
    for (const r of responses) {
      const arr = map.get(r.question_id) || [];
      arr.push(r);
      map.set(r.question_id, arr);
    }
    return map;
  }, [responses]);

  const npsQuestion = questions.find((q) => q.question_type === "nps10");
  const npsScore = useMemo(() => {
    if (!npsQuestion) return null;
    const list = (responsesByQuestion.get(npsQuestion.id) || []).filter((r) => !r.skipped && r.value);
    if (list.length === 0) return null;
    let promoters = 0, passives = 0, detractors = 0;
    for (const r of list) {
      const n = parseInt(r.value || "0", 10);
      if (n >= 9) promoters += 1;
      else if (n >= 7) passives += 1;
      else detractors += 1;
    }
    const total = promoters + passives + detractors;
    const score = Math.round(((promoters - detractors) / total) * 100);
    return { score, promoters, passives, detractors, total };
  }, [npsQuestion, responsesByQuestion]);

  const handleExport = async () => {
    if (!survey) return;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${survey.id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${survey.key}-v${survey.version}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="px-8 pt-6 text-sm text-gray-400">Loading…</div>;
  if (!survey) return <div className="px-8 pt-6 text-sm text-red-700">Survey not found.</div>;

  const canExport = role === "admin" || role === "medical_advisor";

  return (
    <div className="px-8 pt-6 pb-12 space-y-6">
      <Link href="/admin/surveys" className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">
        ← Back to all surveys
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">{survey.title_is}</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-mono">{survey.key} v{survey.version}</span> · Results &amp; analytics
          </p>
        </div>
        {canExport && (
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || totals.completed === 0}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        )}
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Sent" value={totals.sent} />
        <Metric label="Completed" value={totals.completed} />
        <Metric label="Completion rate" value={`${totals.completionRate}%`} />
        <Metric
          label="NPS"
          value={npsScore ? String(npsScore.score) : "—"}
          subtext={npsScore ? `${npsScore.promoters} P · ${npsScore.passives} N · ${npsScore.detractors} D` : "no responses"}
          tone={npsScore ? (npsScore.score >= 50 ? "good" : npsScore.score >= 0 ? "neutral" : "bad") : "neutral"}
        />
      </div>

      {totals.completed === 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-900">
          No completed responses yet. Send the survey to a few clients from <Link href="/admin/clients" className="underline">/admin/clients</Link>; results will populate here as they come in.
        </div>
      )}

      {/* Per-question */}
      {totals.completed > 0 && (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <QuestionResults
              key={q.id}
              q={q}
              idx={idx}
              responses={responsesByQuestion.get(q.id) || []}
              completedCount={totals.completed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, subtext, tone }: { label: string; value: string | number; subtext?: string; tone?: "good" | "neutral" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-[#1F2937]";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      {subtext && <p className="text-[11px] text-gray-400 mt-1">{subtext}</p>}
    </div>
  );
}

function QuestionResults({
  q, idx, responses, completedCount,
}: {
  q: FeedbackQuestion;
  idx: number;
  responses: ResponseRow[];
  completedCount: number;
}) {
  const answered = responses.filter((r) => !r.skipped).length;
  const skipped = responses.filter((r) => r.skipped).length;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <header className="mb-3">
        <p className="text-[11px] font-mono text-gray-400">Q{idx + 1} · {q.question_type}</p>
        <h3 className="text-base font-semibold text-gray-900">{q.label_is}</h3>
        <p className="text-[11px] text-gray-400 mt-1">
          {answered} of {completedCount} answered
          {skipped > 0 && <> · {skipped} skipped</>}
        </p>
      </header>
      <DistributionRenderer q={q} responses={responses.filter((r) => !r.skipped)} />
    </section>
  );
}

function DistributionRenderer({ q, responses }: { q: FeedbackQuestion; responses: ResponseRow[] }) {
  if (responses.length === 0) return <p className="text-xs text-gray-400 italic">No answers yet.</p>;

  switch (q.question_type as QuestionType) {
    case "likert5":
    case "singleselect": {
      const counts = new Map<string, number>();
      for (const r of responses) {
        if (!r.value) continue;
        counts.set(r.value, (counts.get(r.value) || 0) + 1);
      }
      const total = responses.length;
      const optList = q.options_jsonb || [];
      return (
        <div className="space-y-2">
          {optList.map((opt) => {
            const n = counts.get(opt.value) || 0;
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return (
              <div key={opt.value}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700">{opt.label_is}</span>
                  <span className="text-gray-500">{n} · {pct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    case "multiselect": {
      const counts = new Map<string, number>();
      for (const r of responses) {
        for (const v of r.values_array || []) {
          counts.set(v, (counts.get(v) || 0) + 1);
        }
      }
      const total = responses.length;
      const optList = q.options_jsonb || [];
      return (
        <div className="space-y-2">
          {optList.map((opt) => {
            const n = counts.get(opt.value) || 0;
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return (
              <div key={opt.value}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700">{opt.label_is}</span>
                  <span className="text-gray-500">{n} of {total} · {pct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    case "nps10": {
      const counts = new Array(11).fill(0) as number[];
      for (const r of responses) {
        const n = parseInt(r.value || "-1", 10);
        if (n >= 0 && n <= 10) counts[n]++;
      }
      const total = responses.length;
      const max = Math.max(...counts, 1);
      return (
        <div>
          <div className="flex gap-1 items-end h-24">
            {counts.map((n, i) => {
              const pct = (n / max) * 100;
              const tone = i >= 9 ? "bg-emerald-500" : i >= 7 ? "bg-amber-400" : "bg-red-400";
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end">
                  <div
                    className={`w-full rounded-t ${tone}`}
                    style={{ height: `${pct}%`, minHeight: n > 0 ? "4px" : "0" }}
                    title={`${i}: ${n} (${total > 0 ? Math.round((n / total) * 100) : 0}%)`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 mt-1">
            {counts.map((_, i) => (
              <div key={i} className="flex-1 text-center text-[10px] text-gray-400">{i}</div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-2">
            <span>0–6 detractors ({counts.slice(0, 7).reduce((a, b) => a + b, 0)})</span>
            <span>7–8 passives ({counts.slice(7, 9).reduce((a, b) => a + b, 0)})</span>
            <span>9–10 promoters ({counts.slice(9, 11).reduce((a, b) => a + b, 0)})</span>
          </div>
        </div>
      );
    }
    case "open": {
      return (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
          {responses.map((r) => (
            r.text_value ? (
              <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.text_value}</p>
              </div>
            ) : null
          ))}
        </div>
      );
    }
    case "consent_optional": {
      const yes = responses.filter((r) => r.value === "yes").length;
      const no = responses.filter((r) => r.value === "no").length;
      const stories = responses.filter((r) => r.value === "yes" && r.text_value);
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            <strong>{yes}</strong> agreed · <strong>{no}</strong> declined · <strong>{stories.length}</strong> wrote a story
          </p>
          {stories.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
              {stories.map((r) => (
                <div key={r.id} className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.text_value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    default:
      return <p className="text-xs text-gray-400">Distribution view not implemented for this type.</p>;
  }
}
