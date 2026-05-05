"use client";

// Surveys hub. Lists every client-feedback survey with its current
// status and quick links into the editor / results. Visible to admin
// and medical_advisor; admin can edit, medical_advisor reviews +
// approves.

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  type FeedbackSurvey,
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
} from "@/lib/feedback-survey-types";

export default function SurveysHubPage() {
  const [role, setRole] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<FeedbackSurvey[]>([]);
  const [counts, setCounts] = useState<Record<string, { sent: number; completed: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

        const { data: surveyRows } = await supabase
          .from("feedback_surveys")
          .select("*")
          .order("status", { ascending: true })
          .order("updated_at", { ascending: false });
        if (cancelled) return;
        const list = (surveyRows || []) as FeedbackSurvey[];
        setSurveys(list);

        if (list.length > 0) {
          const ids = list.map((s) => s.id);
          const { data: assignments } = await supabase
            .from("feedback_assignments")
            .select("survey_id, completed_at")
            .in("survey_id", ids);
          const tally: Record<string, { sent: number; completed: number }> = {};
          for (const a of (assignments || []) as { survey_id: string; completed_at: string | null }[]) {
            const t = tally[a.survey_id] || { sent: 0, completed: 0 };
            t.sent += 1;
            if (a.completed_at) t.completed += 1;
            tally[a.survey_id] = t;
          }
          if (!cancelled) setCounts(tally);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isAdmin = role === "admin";
  const isMedicalAdvisor = role === "medical_advisor";
  const canEdit = isAdmin;

  return (
    <div className="px-8 pt-6 pb-12 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Surveys</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed">
            Client surveys initiated by admin after each assessment. The medical advisor approves
            the question structure before any survey can be sent. Once approved, admin sends the
            survey to specific clients via email; results are aggregated here.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : surveys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          No surveys yet. Run the migration{" "}
          <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">migration-feedback-surveys.sql</code> to
          seed the default post-assessment survey.
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map((s) => {
            const c = counts[s.id] || { sent: 0, completed: 0 };
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-[#1F2937] truncate">
                        {s.title_is}
                      </h3>
                      <span className="text-xs font-mono text-gray-400">
                        {s.key} v{s.version}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE_CLASS[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {s.estimated_minutes} mín · {c.completed}/{c.sent} svör
                      {s.approved_at && (
                        <>
                          {" · "}
                          approved by {s.approved_by_name || "—"}{" "}
                          {new Date(s.approved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/surveys/${s.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {canEdit ? "Edit" : "Review"}
                    </Link>
                    {s.status === "approved" && (
                      <Link
                        href={`/admin/surveys/${s.id}/results`}
                        className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        Results &amp; export
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isMedicalAdvisor && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-900">
          <strong>Velkomin/n.</strong> Open any survey above to review the question structure. Use
          the action buttons at the bottom of the editor to <em>approve</em> or <em>request changes</em>.
          Once approved, results land at the <em>Results &amp; export</em> link on each survey card.
        </div>
      )}
    </div>
  );
}
