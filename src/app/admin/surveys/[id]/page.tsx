"use client";

// Survey editor + approval workflow.
// - Admin: edits title/intro/outro and the full question list
//   (add, remove, reorder, edit label/type/options/required).
//   Submits the survey for approval; once approved, edits are
//   blocked until status is reset to draft.
// - Medical advisor: read-only on the structure but can approve,
//   request changes (back to draft with a note), or archive.

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  type FeedbackSurvey,
  type FeedbackQuestion,
  type QuestionType,
  type QuestionOption,
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
  QUESTION_TYPE_LABEL,
} from "@/lib/feedback-survey-types";

interface DraftQuestion extends FeedbackQuestion {
  _dirty?: boolean;
  _new?: boolean;
}

const QUESTION_TYPES: QuestionType[] = ["likert5", "singleselect", "multiselect", "nps10", "open", "consent_optional"];

export default function SurveyEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const surveyId = params?.id;

  const [role, setRole] = useState<string | null>(null);
  const [survey, setSurvey] = useState<FeedbackSurvey | null>(null);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Approval / status-change form (medical advisor)
  const [approvalNote, setApprovalNote] = useState("");

  const isAdmin = role === "admin";
  const isMedicalAdvisor = role === "medical_advisor";
  // Both admin and medical advisor can edit content directly while a
  // survey is in draft or pending_approval. Approval / submit / archive
  // transitions stay role-gated below so the second-pair-of-eyes gate
  // is preserved.
  const canEditStructure = (isAdmin || isMedicalAdvisor) && (survey?.status === "draft" || survey?.status === "pending_approval");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!surveyId) return;
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
        setQuestions(((qRows || []) as FeedbackQuestion[]).map((q) => ({ ...q })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [surveyId]);

  const updateSurveyField = (patch: Partial<FeedbackSurvey>) => {
    if (!survey) return;
    setSurvey({ ...survey, ...patch });
  };

  const updateQuestion = (idx: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, _dirty: true };
      return next;
    });
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((q, i) => ({ ...q, order_index: i + 1, _dirty: true }));
    });
  };

  const addQuestion = () => {
    if (!survey) return;
    const blank: DraftQuestion = {
      id: `new-${Date.now()}`,
      survey_id: survey.id,
      order_index: questions.length + 1,
      question_type: "likert5",
      label_is: "",
      label_en: null,
      helper_is: null,
      helper_en: null,
      options_jsonb: defaultOptionsFor("likert5"),
      required: true,
      allow_skip: false,
      skip_label_is: "Á ekki við",
      skip_label_en: "Not applicable",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _new: true,
      _dirty: true,
    };
    setQuestions((prev) => [...prev, blank]);
  };

  const removeQuestion = (idx: number) => {
    if (!confirm("Remove this question? Already-collected responses to it remain in the database for historical surveys.")) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_index: i + 1, _dirty: true })));
  };

  const saveAll = async () => {
    if (!survey) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${survey.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          survey: {
            title_is: survey.title_is,
            title_en: survey.title_en,
            intro_is: survey.intro_is,
            intro_en: survey.intro_en,
            outro_is: survey.outro_is,
            outro_en: survey.outro_en,
            estimated_minutes: survey.estimated_minutes,
          },
          questions: questions.map((q) => ({
            id: q._new ? null : q.id,
            order_index: q.order_index,
            question_type: q.question_type,
            label_is: q.label_is,
            label_en: q.label_en,
            helper_is: q.helper_is,
            helper_en: q.helper_en,
            options_jsonb: q.options_jsonb,
            required: q.required,
            allow_skip: q.allow_skip,
            skip_label_is: q.skip_label_is,
            skip_label_en: q.skip_label_en,
          })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Save failed");
      setMsg({ type: "ok", text: "Saved." });
      // Refresh local state from server response.
      router.refresh();
      if (j.questions) {
        setQuestions((j.questions as FeedbackQuestion[]).map((q) => ({ ...q })));
      }
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const cloneSurvey = async () => {
    if (!survey) return;
    if (!confirm(`Clone ${survey.key} v${survey.version} into a new draft? You'll edit the new copy without affecting the current ${survey.status} version.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${survey.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Clone failed");
      router.push(`/admin/surveys/${j.new_id}`);
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
      setBusy(false);
    }
  };

  const transitionStatus = async (
    action: "submit_for_approval" | "approve" | "request_changes" | "archive" | "reset_to_draft",
  ) => {
    if (!survey) return;
    if (action === "request_changes" && !approvalNote.trim()) {
      setMsg({ type: "err", text: "Add a note describing the requested changes." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch(`/api/admin/surveys/${survey.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, note: approvalNote }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Status change failed");
      setSurvey(j.survey as FeedbackSurvey);
      setApprovalNote("");
      setMsg({ type: "ok", text: `Status updated to ${j.survey.status}.` });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="px-8 pt-6 text-sm text-gray-400">Loading…</div>;
  if (!survey) return <div className="px-8 pt-6 text-sm text-red-700">Survey not found.</div>;

  return (
    <div className="px-8 pt-6 pb-12 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/surveys" className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">
            ← Back to all surveys
          </Link>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <h1 className="text-2xl font-bold text-[#1F2937]">{survey.title_is || "(No title)"}</h1>
            <span className="text-xs font-mono text-gray-400">{survey.key} v{survey.version}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE_CLASS[survey.status]}`}>
              {STATUS_LABEL[survey.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Survey-level fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Title &amp; intro</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldText
            label="Titill (íslenska)"
            value={survey.title_is}
            disabled={!canEditStructure}
            onChange={(v) => updateSurveyField({ title_is: v })}
          />
          <FieldText
            label="Title (English, optional)"
            value={survey.title_en || ""}
            disabled={!canEditStructure}
            onChange={(v) => updateSurveyField({ title_en: v || null })}
          />
        </div>
        <FieldTextarea
          label="Inngangur (íslenska)"
          value={survey.intro_is || ""}
          rows={6}
          disabled={!canEditStructure}
          onChange={(v) => updateSurveyField({ intro_is: v || null })}
        />
        <FieldTextarea
          label="Lokaorð (íslenska)"
          value={survey.outro_is || ""}
          rows={3}
          disabled={!canEditStructure}
          onChange={(v) => updateSurveyField({ outro_is: v || null })}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldNumber
            label="Áætlaður tími (mínútur)"
            value={survey.estimated_minutes}
            disabled={!canEditStructure}
            onChange={(v) => updateSurveyField({ estimated_minutes: v })}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="bg-white rounded-xl border border-gray-200">
        <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Questions ({questions.length})
          </h2>
          {canEditStructure && (
            <button
              type="button"
              onClick={addQuestion}
              className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              + Add question
            </button>
          )}
        </header>
        <div className="divide-y divide-gray-100">
          {questions.map((q, idx) => (
            <QuestionEditor
              key={q.id}
              question={q}
              idx={idx}
              total={questions.length}
              canEdit={canEditStructure}
              onChange={(patch) => updateQuestion(idx, patch)}
              onMove={(dir) => moveQuestion(idx, dir)}
              onRemove={() => removeQuestion(idx)}
            />
          ))}
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Action bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Workflow</h2>
        {isAdmin && survey.status === "draft" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={saveAll}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#10B981] rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => transitionStatus("submit_for_approval")}
              className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              Submit for medical-advisor approval
            </button>
          </div>
        )}
        {isAdmin && survey.status === "pending_approval" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={saveAll}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#10B981] rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => transitionStatus("reset_to_draft")}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Move back to draft
            </button>
          </div>
        )}
        {isAdmin && survey.status === "approved" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-emerald-700">Approved — locked. To revise, clone into a new draft (the next version) and edit there.</p>
            <button
              type="button"
              disabled={busy}
              onClick={cloneSurvey}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Clone &amp; edit (new draft)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => transitionStatus("archive")}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Archive
            </button>
          </div>
        )}
        {isAdmin && survey.status === "archived" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-gray-500">Archived. Clone if you want to start a fresh draft from this baseline.</p>
            <button
              type="button"
              disabled={busy}
              onClick={cloneSurvey}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Clone &amp; edit (new draft)
            </button>
          </div>
        )}

        {isMedicalAdvisor && survey.status === "draft" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              You can edit content directly. Save as you go; admin still owns the &quot;Submit for approval&quot; transition.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={saveAll}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#10B981] rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
        {isMedicalAdvisor && survey.status === "pending_approval" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              You can edit the questions directly while reviewing — saves take effect immediately. When you&apos;re ready, approve below (or request changes if you&apos;d rather hand back to admin).
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={saveAll}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#10B981] rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <textarea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder="Note (optional for approve, required for request changes)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => transitionStatus("approve")}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                Approve &amp; publish
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => transitionStatus("request_changes")}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                Request changes
              </button>
            </div>
          </div>
        )}
        {isMedicalAdvisor && survey.status === "approved" && (
          <p className="text-xs text-gray-500">Approved by you on {survey.approved_at ? new Date(survey.approved_at).toLocaleDateString("en-GB") : "—"}.</p>
        )}
        {survey.approval_note && (
          <p className="text-xs text-gray-500 italic">Last note: {survey.approval_note}</p>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Field primitives + question editor

function FieldText({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
      />
    </label>
  );
}

function FieldTextarea({ label, value, onChange, rows = 4, disabled }: { label: string; value: string; onChange: (v: string) => void; rows?: number; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y disabled:bg-gray-50 disabled:text-gray-500"
      />
    </label>
  );
}

function FieldNumber({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <input
        type="number"
        value={value}
        min={1}
        max={60}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
      />
    </label>
  );
}

function defaultOptionsFor(type: QuestionType): QuestionOption[] | null {
  switch (type) {
    case "likert5":
      return [
        { value: "5", label_is: "Mjög gott" },
        { value: "4", label_is: "Gott" },
        { value: "3", label_is: "Í lagi" },
        { value: "2", label_is: "Slakt" },
        { value: "1", label_is: "Mjög slakt" },
      ];
    case "singleselect":
    case "multiselect":
      return [
        { value: "option1", label_is: "Valkostur 1" },
        { value: "option2", label_is: "Valkostur 2" },
      ];
    default:
      return null;
  }
}

function QuestionEditor({
  question, idx, total, canEdit, onChange, onMove, onRemove,
}: {
  question: DraftQuestion;
  idx: number;
  total: number;
  canEdit: boolean;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const options = useMemo(() => question.options_jsonb || [], [question.options_jsonb]);
  const supportsOptions = question.question_type === "likert5" || question.question_type === "singleselect" || question.question_type === "multiselect";
  const supportsSkip = question.question_type === "likert5" || question.question_type === "singleselect";

  const updateOption = (optIdx: number, patch: Partial<QuestionOption>) => {
    const next = [...options];
    next[optIdx] = { ...next[optIdx], ...patch };
    onChange({ options_jsonb: next });
  };

  const addOption = () => {
    const next = [...options, { value: `opt${options.length + 1}`, label_is: "" }];
    onChange({ options_jsonb: next });
  };

  const removeOption = (optIdx: number) => {
    onChange({ options_jsonb: options.filter((_, i) => i !== optIdx) });
  };

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="text-xs font-mono text-gray-400 w-6 pt-2">#{idx + 1}</div>
        <div className="flex-1 space-y-3">
          <FieldText
            label="Question (íslenska)"
            value={question.label_is}
            disabled={!canEdit}
            onChange={(v) => onChange({ label_is: v })}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Type</span>
              <select
                value={question.question_type}
                disabled={!canEdit}
                onChange={(e) => {
                  const t = e.target.value as QuestionType;
                  onChange({ question_type: t, options_jsonb: defaultOptionsFor(t) });
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <FieldText
              label="Helper text (optional)"
              value={question.helper_is || ""}
              disabled={!canEdit}
              onChange={(v) => onChange({ helper_is: v || null })}
            />
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={question.required}
                disabled={!canEdit}
                onChange={(e) => onChange({ required: e.target.checked })}
              />
              Required
            </label>
            {supportsSkip && (
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={question.allow_skip}
                  disabled={!canEdit}
                  onChange={(e) => onChange({ allow_skip: e.target.checked })}
                />
                Show &quot;Á ekki við&quot; option
              </label>
            )}
          </div>

          {supportsOptions && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Options</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="text-xs text-emerald-700 hover:text-emerald-800"
                  >
                    + Add option
                  </button>
                )}
              </div>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.value}
                    onChange={(e) => updateOption(i, { value: e.target.value })}
                    disabled={!canEdit}
                    className="w-24 px-2 py-1 border border-gray-200 rounded text-xs font-mono text-gray-900"
                    placeholder="value"
                  />
                  <input
                    type="text"
                    value={opt.label_is}
                    onChange={(e) => updateOption(i, { label_is: e.target.value })}
                    disabled={!canEdit}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs text-gray-900"
                    placeholder="Label (íslenska)"
                  />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={idx === 0}
              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={idx === total - 1}
              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-red-500 hover:text-red-700"
              title="Remove question"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
