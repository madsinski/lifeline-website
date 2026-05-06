"use client";

// Surveys hub. Lists every client-feedback survey with its current
// status and quick links into the editor / results. Visible to admin
// and medical_advisor; admin can edit, medical_advisor reviews +
// approves.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  type FeedbackSurvey,
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
} from "@/lib/feedback-survey-types";

export default function SurveysHubPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<FeedbackSurvey[]>([]);
  const [counts, setCounts] = useState<Record<string, { sent: number; completed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newError, setNewError] = useState<string | null>(null);

  const cloneSurvey = async (sourceId: string) => {
    if (!confirm("Clone this survey into a new draft (next version)? You'll edit the new copy without affecting the current version.")) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${sourceId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Clone failed");
      router.push(`/admin/surveys/${j.new_id}`);
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  };

  // Duplicate into a brand-new survey under a different key. Useful for
  // building a new survey that starts from an existing one as a template
  // rather than versioning the same key.
  const duplicateSurvey = async (source: FeedbackSurvey) => {
    const defaultKey = `${source.key}-copy`;
    const newKeyRaw = prompt(
      "New key (slug) for the duplicate. Leave blank to cancel.",
      defaultKey,
    );
    if (newKeyRaw === null) return;
    const newKeyClean = newKeyRaw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!newKeyClean) { alert("Key required."); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${source.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_key: newKeyClean, new_version: 1 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Duplicate failed");
      router.push(`/admin/surveys/${j.new_id}`);
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  };

  const createNewSurvey = async () => {
    setNewError(null);
    const key = newKey.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const title = newTitle.trim();
    if (!key) { setNewError("Slug-style key required (e.g. follow-up-3m)."); return; }
    if (!title) { setNewError("Title required."); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, title_is: title }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Create failed");
      router.push(`/admin/surveys/${j.new_id}`);
    } catch (e) {
      setNewError((e as Error).message);
      setBusy(false);
    }
  };

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
        {canEdit && (
          <button
            type="button"
            onClick={() => { setNewOpen(true); setNewError(null); setNewKey(""); setNewTitle(""); }}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + New survey
          </button>
        )}
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
                    <Link
                      href={`/admin/surveys/${s.id}/preview`}
                      className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      Preview &amp; test
                    </Link>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => duplicateSurvey(s)}
                        className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                      >
                        Duplicate
                      </button>
                    )}
                    {canEdit && (s.status === "approved" || s.status === "archived") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => cloneSurvey(s.id)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        Clone &amp; edit
                      </button>
                    )}
                    <Link
                      href={`/admin/surveys/${s.id}/results`}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        s.status === "approved"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                          : "text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                      title={s.status === "approved" ? "View aggregated results + CSV export" : "Results page (will show 0 responses until the survey is approved + sent)"}
                    >
                      Results &amp; export
                    </Link>
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

      {newOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setNewOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <header className="px-5 py-4 border-b border-gray-100">
              <h4 className="text-base font-semibold text-[#1F2937]">New survey</h4>
              <p className="text-xs text-gray-500 mt-1">
                Creates an empty draft. You&apos;ll add questions on the next screen, then submit it for medical-advisor approval.
              </p>
            </header>
            <div className="px-5 py-4 space-y-3">
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Key (slug)</span>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. follow-up-3m"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono text-gray-900"
                />
                <span className="block text-[11px] text-gray-400 mt-1">Lowercase letters, numbers, dashes. Becomes part of the URL and CSV filename.</span>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Title (íslenska)</span>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Þjónustukönnun – 3 mánaða eftirfylgd"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                />
              </label>
              {newError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {newError}
                </div>
              )}
            </div>
            <footer className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createNewSurvey}
                disabled={busy}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create draft"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
