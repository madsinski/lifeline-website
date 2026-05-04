"use client";

// Review panel rendered under each legal document on /admin/legal/drafts.
// - Everyone sees the latest signoff status badge.
// - Lawyers (role='lawyer') also see the review form: comment, approve,
//   request changes, reject.
// - Comment-only history is collapsible.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "pending" | "under_review" | "approved" | "changes_requested" | "rejected";
type Action = "comment" | "approve" | "request_changes" | "reject";

interface Signoff {
  id: string;
  document_key: string;
  document_version: string;
  document_title: string;
  text_hash: string;
  status: Status;
  comments: string | null;
  reviewer_id: string;
  reviewer_name: string;
  signed_at: string | null;
  pdf_storage_path: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<Status, string> = {
  pending: "bg-gray-100 text-gray-700",
  under_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  changes_requested: "bg-orange-100 text-orange-800",
  rejected: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending review",
  under_review: "Under review",
  approved: "Approved by counsel",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};

const ACTION_LABELS: Record<Action, string> = {
  comment: "Add comment",
  approve: "Approve & sign",
  request_changes: "Request changes",
  reject: "Reject",
};

const ACTION_STYLES: Record<Action, string> = {
  comment: "bg-gray-700 text-white hover:bg-gray-800",
  approve: "bg-emerald-600 text-white hover:bg-emerald-700",
  request_changes: "bg-orange-500 text-white hover:bg-orange-600",
  reject: "bg-red-600 text-white hover:bg-red-700",
};

interface Props {
  documentKey: string;
  documentVersion: string;
  documentTitle: string;
  documentText: string;
}

export default function DocReviewPanel({ documentKey, documentVersion, documentTitle, documentText }: Props) {
  const [role, setRole] = useState<string | null>(null);
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: staffRow } = await supabase
          .from("staff")
          .select("role")
          .eq("email", user.email)
          .maybeSingle();
        setRole((staffRow?.role as string) || null);
      }
      const { data: signoffRows } = await supabase
        .from("legal_review_signoffs")
        .select("*")
        .eq("document_key", documentKey)
        .eq("document_version", documentVersion)
        .order("created_at", { ascending: false });
      setSignoffs((signoffRows || []) as Signoff[]);
    } finally {
      setLoading(false);
    }
  }, [documentKey, documentVersion]);

  useEffect(() => { load(); }, [load]);

  const isLawyer = role === "lawyer";
  const latest = signoffs[0] || null;
  const latestStatus: Status = (latest?.status as Status) || "pending";

  const submit = async (action: Action) => {
    if (action === "comment" && !comments.trim()) {
      setMsg({ type: "err", text: "Add a comment before submitting." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/admin/legal/signoff", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action,
          document_key: documentKey,
          document_version: documentVersion,
          document_title: documentTitle,
          document_text: documentText,
          comments,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Submission failed");
      setComments("");
      setMsg({ type: "ok", text: action === "approve" ? "Signed off — PDF certificate saved." : "Saved." });
      await load();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const commentHistory = useMemo(() => signoffs.slice(0, 20), [signoffs]);

  if (loading) {
    return <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">Loading review status…</div>;
  }

  return (
    <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/40">
      {/* Status badge always visible */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[latestStatus]}`}>
            {STATUS_LABELS[latestStatus]}
          </span>
          {latest && (
            <span className="text-xs text-gray-400">
              by {latest.reviewer_name} · {new Date(latest.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        {commentHistory.length > 0 && (
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            {historyOpen ? "Hide" : `History (${commentHistory.length})`}
          </button>
        )}
      </div>

      {/* History */}
      {historyOpen && commentHistory.length > 0 && (
        <div className="space-y-2 border border-gray-200 rounded-lg bg-white p-3">
          {commentHistory.map((s) => (
            <div key={s.id} className="text-xs border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[s.status]}`}>
                  {STATUS_LABELS[s.status]}
                </span>
                <span className="text-gray-500">{s.reviewer_name}</span>
                <span className="text-gray-400">{new Date(s.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {s.comments && (
                <div className="text-gray-700 whitespace-pre-wrap">{s.comments}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lawyer-only actions */}
      {isLawyer && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Comments for this document (optional unless you're commenting only)"
            rows={3}
            maxLength={8000}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y bg-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(["comment", "approve", "request_changes", "reject"] as Action[]).map((a) => (
              <button
                key={a}
                onClick={() => submit(a)}
                disabled={busy}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${ACTION_STYLES[a]}`}
              >
                {ACTION_LABELS[a]}
              </button>
            ))}
            {msg && (
              <span className={`text-xs ${msg.type === "ok" ? "text-emerald-700" : "text-red-700"}`}>
                {msg.text}
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            Approving generates a signed PDF certificate (sha256 of the document text + IP + timestamp) — non-repudiation evidence.
          </p>
        </div>
      )}
    </div>
  );
}
