"use client";

// Results + analytics for a single survey.
// - AI insight panel (themes, praise, concerns, action items).
// - Headline metrics (responses, completion rate, NPS).
// - Per-chapter breakdown — questions grouped by section_index, with
//   means for likert / numeric singleselect, distributions for closed
//   questions, NPS bar chart, and a searchable / copyable free-text
//   browser for open & consent_optional questions.
// - CSV export (admin + medical_advisor).
//
// Free-text values are encrypted at rest (migration-encrypt-feedback-
// responses.sql). We read through feedback_responses_decrypted, a view
// that calls decrypt_text() under security_invoker so RLS still
// applies — staff already has the right policy.

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

interface ThemeRow { title: string; description: string }
interface ConcernRow { title: string; description: string; severity: "low" | "medium" | "high" }
interface ActionRow  { title: string; description: string; priority: "low" | "medium" | "high" }

interface AISummary {
  survey_id: string;
  summary_md: string | null;
  themes_jsonb: ThemeRow[] | null;
  praise_jsonb: ThemeRow[] | null;
  concerns_jsonb: ConcernRow[] | null;
  action_items_jsonb: ActionRow[] | null;
  responses_count: number;
  model: string | null;
  generated_by_name: string | null;
  generated_at: string;
}

export default function SurveyResultsPage() {
  const params = useParams<{ id: string }>();
  const surveyId = params?.id;
  const [role, setRole] = useState<string | null>(null);
  const [survey, setSurvey] = useState<FeedbackSurvey | null>(null);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
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
          .order("section_index", { ascending: true })
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
            // Read from the decrypted view — text_value is encrypted at rest.
            const { data: rRows } = await supabase
              .from("feedback_responses_decrypted")
              .select("*")
              .in("assignment_id", completedIds);
            if (cancelled) return;
            setResponses(((rRows || []) as ResponseRow[]));
          }
        }

        // Best-effort AI summary load (silent on error — empty state is fine).
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            const r = await fetch(`/api/admin/surveys/${surveyId}/ai-summary`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (r.ok) {
              const j = await r.json();
              if (!cancelled && j.summary) setAiSummary(j.summary as AISummary);
            }
          }
        } catch { /* noop */ }
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

  // Group questions by chapter (section_index). Keep questions in order.
  const chapters = useMemo(() => {
    const map = new Map<number, { index: number; title: string; questions: FeedbackQuestion[] }>();
    for (const q of questions) {
      const key = q.section_index ?? 1;
      if (!map.has(key)) {
        map.set(key, { index: key, title: q.section_title_is || "", questions: [] });
      }
      map.get(key)!.questions.push(q);
    }
    return Array.from(map.values()).sort((a, b) => a.index - b.index);
  }, [questions]);

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

  const handleGenerateAI = async () => {
    if (!survey) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${survey.id}/ai-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "AI generation failed");
      setAiSummary(j.summary as AISummary);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  if (loading) return <div className="px-8 pt-6 text-sm text-gray-400">Loading…</div>;
  if (!survey) return <div className="px-8 pt-6 text-sm text-red-700">Survey not found.</div>;

  const canExport = role === "admin" || role === "medical_advisor";
  const canRunAi = role === "admin" || role === "medical_advisor";

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

      {/* AI insights */}
      {canRunAi && totals.completed > 0 && (
        <AIInsightPanel
          summary={aiSummary}
          busy={aiBusy}
          error={aiError}
          onGenerate={handleGenerateAI}
        />
      )}

      {totals.completed === 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-900">
          No completed responses yet. Once invitations come back, results populate here automatically.
        </div>
      )}

      {/* Per-chapter breakdown */}
      {totals.completed > 0 && (
        <div className="space-y-6">
          {chapters.map((ch) => {
            const numberOffset = questions.findIndex((q) => q.id === ch.questions[0].id);
            return (
              <ChapterBlock
                key={ch.index}
                index={ch.index}
                total={chapters.length}
                title={ch.title}
                questions={ch.questions}
                numberOffset={numberOffset}
                responsesByQuestion={responsesByQuestion}
                completedCount={totals.completed}
              />
            );
          })}
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

function ChapterBlock({
  index, total, title, questions, numberOffset, responsesByQuestion, completedCount,
}: {
  index: number;
  total: number;
  title: string;
  questions: FeedbackQuestion[];
  numberOffset: number;
  responsesByQuestion: Map<string, ResponseRow[]>;
  completedCount: number;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-baseline gap-3">
        <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-700">
          Kafli {index} / {total}
        </span>
        {title && <h2 className="text-lg font-bold text-[#1F2937]">{title}</h2>}
      </header>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionResults
            key={q.id}
            q={q}
            idx={numberOffset + i}
            responses={responsesByQuestion.get(q.id) || []}
            completedCount={completedCount}
          />
        ))}
      </div>
    </section>
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
  const answered = responses.filter((r) => !r.skipped);
  const skipped = responses.filter((r) => r.skipped).length;

  // Mean for likert5 / numeric singleselect. Only computed when every
  // selected option has a numeric value.
  const mean = useMemo(() => {
    if (q.question_type !== "likert5" && q.question_type !== "singleselect") return null;
    const numeric = answered
      .map((r) => parseInt(r.value || "", 10))
      .filter((n) => Number.isFinite(n));
    if (numeric.length === 0 || numeric.length !== answered.length) return null;
    const sum = numeric.reduce((a, b) => a + b, 0);
    return Math.round((sum / numeric.length) * 100) / 100;
  }, [answered, q.question_type]);

  const meanLabel = (() => {
    if (mean === null) return null;
    const max = Math.max(...((q.options_jsonb || []).map((o) => parseInt(o.value, 10)).filter(Number.isFinite)), 5);
    return `${mean} / ${max}`;
  })();

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <header className="mb-3">
        <p className="text-[11px] font-mono text-gray-400">Q{idx + 1} · {q.question_type}</p>
        <h3 className="text-base font-semibold text-gray-900">{q.label_is}</h3>
        <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
          <span>
            {answered.length} of {completedCount} answered
            {skipped > 0 && <> · {skipped} skipped</>}
          </span>
          {meanLabel && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
              meðaltal {meanLabel}
            </span>
          )}
        </div>
      </header>
      <DistributionRenderer q={q} responses={answered} />
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
      const texts = responses.map((r) => r.text_value || "").filter(Boolean);
      return <FreeTextBrowser texts={texts} accent="emerald" />;
    }
    case "consent_optional": {
      const yes = responses.filter((r) => r.value === "yes").length;
      const no = responses.filter((r) => r.value === "no").length;
      const stories = responses.filter((r) => r.value === "yes" && r.text_value).map((r) => r.text_value || "");
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            <strong>{yes}</strong> agreed · <strong>{no}</strong> declined · <strong>{stories.length}</strong> wrote a story
          </p>
          {stories.length > 0 && <FreeTextBrowser texts={stories} accent="emerald" />}
        </div>
      );
    }
    default:
      return <p className="text-xs text-gray-400">Distribution view not implemented for this type.</p>;
  }
}

function FreeTextBrowser({ texts, accent }: { texts: string[]; accent: "emerald" | "gray" }) {
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return texts;
    return texts.filter((t) => t.toLowerCase().includes(q));
  }, [texts, filter]);
  const totalWords = useMemo(
    () => texts.reduce((sum, t) => sum + t.trim().split(/\s+/).filter(Boolean).length, 0),
    [texts],
  );
  const avgWords = texts.length > 0 ? Math.round(totalWords / texts.length) : 0;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(filtered.join("\n\n— —\n\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  };

  const tone = accent === "emerald" ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-100";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Leita í svörum…"
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900"
        />
        <button
          type="button"
          onClick={copyAll}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {copied ? "Afritað ✓" : `Afrita ${filtered.length}`}
        </button>
        <span className="text-[11px] text-gray-500">
          {filtered.length} / {texts.length} svör · ~{avgWords} orð að meðaltali
        </span>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Engin svör passa við leitina.</p>
        ) : (
          filtered.map((t, i) => (
            <div key={i} className={`${tone} border rounded-lg px-3 py-2`}>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{t}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AIInsightPanel({
  summary, busy, error, onGenerate,
}: {
  summary: AISummary | null;
  busy: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  return (
    <section className="bg-gradient-to-br from-indigo-50 via-white to-emerald-50 border border-indigo-100 rounded-2xl p-5 space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-700 mb-1">
            AI insights
          </p>
          <h2 className="text-base font-bold text-[#1F2937]">
            Samantekt og aðgerðir út frá svörum
          </h2>
          {summary && (
            <p className="text-[11px] text-gray-500 mt-1">
              Síðast keyrt {new Date(summary.generated_at).toLocaleString("is-IS")}
              {summary.generated_by_name && <> af {summary.generated_by_name}</>}
              {" · "}{summary.responses_count} svör
              {summary.model && <> · {summary.model}</>}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy}
          className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {busy ? "Greini…" : summary ? "Endurkeyra greiningu" : "Búa til AI samantekt"}
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!summary && !busy && !error && (
        <p className="text-sm text-gray-600">
          Smelltu á <em>Búa til AI samantekt</em> til að fá hröð yfirsýn yfir helstu þemu, hrós og áhyggjuefni úr svörum þátttakenda — auk lista af aðgerðum sem teymið ætti að taka.
        </p>
      )}

      {summary && (
        <>
          {summary.summary_md && (
            <div className="bg-white/70 backdrop-blur rounded-xl p-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {summary.summary_md}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InsightList
              title="Aðgerðir"
              items={(summary.action_items_jsonb || []).map((a) => ({
                title: a.title,
                description: a.description,
                badge: a.priority,
                badgeTone: a.priority === "high" ? "bg-red-100 text-red-700" :
                  a.priority === "medium" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-600",
              }))}
              accent="indigo"
              empty="Engar aðgerðir tilgreindar."
            />
            <InsightList
              title="Áhyggjuefni"
              items={(summary.concerns_jsonb || []).map((c) => ({
                title: c.title,
                description: c.description,
                badge: c.severity,
                badgeTone: c.severity === "high" ? "bg-red-100 text-red-700" :
                  c.severity === "medium" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-600",
              }))}
              accent="red"
              empty="Engar sérstakar áhyggjur."
            />
          </div>

          {showFullAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InsightList
                title="Helstu þemu"
                items={(summary.themes_jsonb || []).map((t) => ({ title: t.title, description: t.description }))}
                accent="indigo"
                empty="Engin þemu greind."
              />
              <InsightList
                title="Hrós"
                items={(summary.praise_jsonb || []).map((p) => ({ title: p.title, description: p.description }))}
                accent="emerald"
                empty="Ekkert sérstakt hrós úr svörum."
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowFullAnalysis((s) => !s)}
            className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
          >
            {showFullAnalysis ? "Fela þemu og hrós ↑" : "Sýna þemu og hrós ↓"}
          </button>
        </>
      )}
    </section>
  );
}

function InsightList({
  title, items, accent, empty,
}: {
  title: string;
  items: { title: string; description: string; badge?: string; badgeTone?: string }[];
  accent: "indigo" | "emerald" | "red";
  empty: string;
}) {
  const accentClass = accent === "indigo"
    ? "border-indigo-200 bg-white"
    : accent === "emerald"
      ? "border-emerald-200 bg-white"
      : "border-red-200 bg-white";
  return (
    <div className={`border rounded-xl p-3 ${accentClass}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-sm">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-900 flex-1 leading-snug">{it.title}</span>
                {it.badge && (
                  <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${it.badgeTone || "bg-gray-100 text-gray-600"}`}>
                    {it.badge}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">{it.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
