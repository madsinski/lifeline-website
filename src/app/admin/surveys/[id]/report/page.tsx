"use client";

// Printable two-page A4 report for a survey — built for the
// Vestmannaeyjabær follow-up (Eftirfylgni) but generic over any survey
// that uses the same question types.
//
//   Page 1 — results: headline tiles, self-rated change (diverging
//            stacked bars over the likert5 questions of chapter 1) and
//            the top answers of the multiselect questions.
//   Page 2 — stories: consent_optional answers where the respondent
//            said "yes". A first name is shown ONLY when that respondent
//            also answered the first-name consent question with
//            "ja-fornafn". Admin can leave stories out before printing.
//
// Data is read exactly like /results (anon client + RLS; responses via
// feedback_responses_decrypted), so only admin / medical_advisor see
// answers. `?demo=1` renders synthetic data, watermarked on every page,
// so the layout can be reviewed before real answers arrive.
//
// Print: the report is portalled to <body> and everything else is hidden
// (same pattern as components/hc/PlanView.tsx).

import { Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getMyStaffRole } from "@/lib/staff-role";
import type { FeedbackSurvey, FeedbackQuestion } from "@/lib/feedback-survey-types";
import { PRINT_CSS, ReportPages, buildDemo, type AssignmentRow, type ResponseRow, type Story } from "./ReportPages";

// ─── Page ─────────────────────────────────────────────────────────
// useSearchParams() needs a Suspense boundary.
export default function SurveyReportRoute() {
  return (
    <Suspense fallback={<div className="px-8 pt-6 text-sm text-gray-400">Hleð…</div>}>
      <SurveyReportPage />
    </Suspense>
  );
}

function SurveyReportPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const surveyId = params?.id;
  const demo = search?.get("demo") === "1";

  const [role, setRole] = useState<string | null>(null);
  const [survey, setSurvey] = useState<FeedbackSurvey | null>(null);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [showNames, setShowNames] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!surveyId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const r = await getMyStaffRole(user.email);
          if (!cancelled) setRole(r);
        }
        const [{ data: sRow }, { data: qRows }] = await Promise.all([
          supabase.from("feedback_surveys").select("*").eq("id", surveyId).maybeSingle(),
          supabase
            .from("feedback_questions")
            .select("*")
            .eq("survey_id", surveyId)
            .order("section_index", { ascending: true })
            .order("order_index", { ascending: true }),
        ]);
        if (cancelled) return;
        const qs = (qRows || []) as FeedbackQuestion[];
        setSurvey((sRow as FeedbackSurvey) || null);
        setQuestions(qs);

        if (demo) {
          const d = buildDemo(qs);
          setAssignments(d.assignments);
          setResponses(d.responses);
          return;
        }
        const { data: aRows } = await supabase
          .from("feedback_assignments")
          .select("id, sent_at, completed_at, client_name")
          .eq("survey_id", surveyId);
        if (cancelled) return;
        const list = (aRows || []) as AssignmentRow[];
        setAssignments(list);
        const completedIds = list.filter((a) => a.completed_at).map((a) => a.id);
        if (completedIds.length > 0) {
          const { data: rRows } = await supabase
            .from("feedback_responses_decrypted")
            .select("assignment_id, question_id, value, values_array, text_value, skipped")
            .in("assignment_id", completedIds);
          if (!cancelled) setResponses((rRows || []) as ResponseRow[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [surveyId, demo]);

  const stories = useMemo<Story[]>(() => {
    const consentQ = questions.find((q) => q.question_type === "consent_optional");
    if (!consentQ) return [];
    const nameQ = questions.find((q) => (q.options_jsonb || []).some((o) => o.value === "ja-fornafn"));
    const byId = new Map(assignments.map((a) => [a.id, a]));
    return responses
      .filter((r) => r.question_id === consentQ.id && r.value === "yes" && r.text_value?.trim())
      .map((r) => {
        const nameOk = nameQ && responses.some((x) => x.assignment_id === r.assignment_id && x.question_id === nameQ.id && x.value === "ja-fornafn");
        const full = byId.get(r.assignment_id)?.client_name || "";
        return { id: r.assignment_id, text: r.text_value!.trim(), firstName: nameOk ? full.split(" ")[0] || null : null };
      });
  }, [questions, responses, assignments]);

  if (loading) return <div className="px-8 pt-6 text-sm text-gray-400">Hleð…</div>;
  if (!survey) return <div className="px-8 pt-6 text-sm text-red-700">Könnun fannst ekki.</div>;

  const canSeeAnswers = role === "admin" || role === "medical_advisor";
  const shownStories = stories
    .filter((s) => !excluded.has(s.id))
    .map((s) => (showNames ? s : { ...s, firstName: null }));

  const report = (
    <ReportPages
      survey={survey}
      questions={questions}
      assignments={assignments}
      responses={responses}
      stories={shownStories}
      demo={demo}
    />
  );

  return (
    <div className="px-8 pt-6 pb-12 space-y-6 print:hidden">
      <Link href={`/admin/surveys/${survey.id}/results`} className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">
        ← Til baka í niðurstöður
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Skýrsla: {survey.title_is}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tvær A4-síður — niðurstöður og frásagnir. Prentaðu eða vistaðu sem PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={demo ? `/admin/surveys/${survey.id}/report` : `/admin/surveys/${survey.id}/report?demo=1`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {demo ? "Sýna raunveruleg svör" : "Sýnishorn með tilbúnum gögnum"}
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            Prenta / vista PDF
          </button>
        </div>
      </div>

      {demo && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Sýnishorn: allar tölur og frásagnir eru tilbúin gögn og merktar sem slíkar á hverri síðu. Ekki senda þessa útgáfu út.
        </div>
      )}
      {!demo && !canSeeAnswers && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Aðeins stjórnendur (admin) og læknisfræðilegur ráðgjafi hafa aðgang að svörum. Skráðu þig inn með stjórnandaaðgangi.
        </div>
      )}

      {stories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1F2937]">Frásagnir á síðu 2 ({shownStories.length} af {stories.length})</h2>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
              Birta fornafn þar sem leyfi er fyrir hendi
            </label>
          </div>
          <ul className="space-y-2">
            {stories.map((s) => (
              <li key={s.id} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!excluded.has(s.id)}
                  onChange={(e) => {
                    const next = new Set(excluded);
                    if (e.target.checked) next.delete(s.id); else next.add(s.id);
                    setExcluded(next);
                  }}
                />
                <span className="text-gray-700">
                  {s.text}
                  <span className="text-gray-400"> — {s.firstName ? `${s.firstName} (leyfi fyrir fornafni)` : "nafnlaust"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-gray-200 rounded-xl p-6 overflow-x-auto">
        <div className="mx-auto w-fit space-y-6">{report}</div>
      </div>

      {mounted && createPortal(<div className="survey-report-print hidden print:block">{report}</div>, document.body)}
      <style>{PRINT_CSS}</style>
    </div>
  );
}


