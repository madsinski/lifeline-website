"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface RecentErrorSig {
  id?: string;
  fingerprint?: string | null;
  message?: string;
  occurred_at?: string;
  runtime?: string | null;
  level?: string | null;
}

interface FeedbackRow {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  page_url: string;
  feedback_type: "bug" | "feature" | "general";
  message: string;
  user_agent: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  viewed_by_user_at: string | null;
  // MDR linkage to errors
  linked_error_ids: string[] | null;
  app_version: string | null;
  recent_error_signatures: RecentErrorSig[] | null;
  screenshot_storage_path: string | null;
}

const TYPE_PILL: Record<FeedbackRow["feedback_type"], { label: string; cls: string }> = {
  bug: { label: "Bug", cls: "bg-red-100 text-red-700" },
  feature: { label: "Feature", cls: "bg-blue-100 text-blue-700" },
  general: { label: "General", cls: "bg-gray-100 text-gray-600" },
};

type Filter = "unresolved" | "all" | "bug" | "feature" | "general";

export default function FeedbackTab() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("unresolved");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyNote, setReplyNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Map of feedback id → signed URL for its screenshot. Lazy-loaded
  // when a row is expanded; URLs expire after 5 min and re-fetch is
  // automatic on the next expand.
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({});

  const loadScreenshot = useCallback(async (item: FeedbackRow) => {
    if (!item.screenshot_storage_path) return;
    if (screenshotUrls[item.id]) return;
    try {
      const { data } = await supabase.storage
        .from("beta-feedback-screenshots")
        .createSignedUrl(item.screenshot_storage_path, 300);
      if (data?.signedUrl) setScreenshotUrls((m) => ({ ...m, [item.id]: data.signedUrl }));
    } catch {}
  }, [screenshotUrls]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("beta_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as FeedbackRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const expand = (id: string, current: FeedbackRow) => {
    if (expandedId === id) {
      setExpandedId(null);
      setReplyNote("");
      return;
    }
    setExpandedId(id);
    setReplyNote(current.resolution_note ?? "");
    // Lazy-fetch the signed URL for the screenshot (if any) so the
    // <img> renders without an extra round-trip on click.
    loadScreenshot(current);
  };

  const resolveWithNote = async (id: string) => {
    if (!replyNote.trim()) {
      alert("Add a short reply note so the tester sees what was done.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("beta_feedback")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
          resolution_note: replyNote.trim(),
          viewed_by_user_at: null, // re-trigger unread badge on new resolve
        })
        .eq("id", id);
      if (error) {
        alert(`Resolve failed: ${error.message}`);
        return;
      }
      await load();
      setExpandedId(null);
      setReplyNote("");
    } finally {
      setSubmitting(false);
    }
  };

  const reopen = async (id: string) => {
    if (!confirm("Reopen this feedback item? The tester's banner will disappear.")) return;
    const { error } = await supabase
      .from("beta_feedback")
      .update({
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
        viewed_by_user_at: null,
      })
      .eq("id", id);
    if (error) {
      alert(`Reopen failed: ${error.message}`);
      return;
    }
    load();
  };

  const filtered = items.filter((i) => {
    if (filter === "all") return true;
    if (filter === "unresolved") return !i.resolved_at;
    return i.feedback_type === filter;
  });

  const counts = {
    unresolved: items.filter((i) => !i.resolved_at).length,
    all: items.length,
    bug: items.filter((i) => i.feedback_type === "bug").length,
    feature: items.filter((i) => i.feedback_type === "feature").length,
    general: items.filter((i) => i.feedback_type === "general").length,
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="inline-flex bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          {(["unresolved", "all", "bug", "feature", "general"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
          {loading ? "Loading…" : "No feedback yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const tc = TYPE_PILL[item.feedback_type];
            const isExpanded = expandedId === item.id;
            const isResolved = !!item.resolved_at;
            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-colors ${
                  isResolved ? "border-gray-100" : "border-gray-200"
                }`}
              >
                <button
                  onClick={() => expand(item.id, item)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tc.cls}`}>
                    {tc.label}
                  </span>
                  <p className={`flex-1 text-sm text-gray-900 truncate min-w-0 ${isResolved ? "opacity-60" : ""}`}>
                    {item.message}
                  </p>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] text-gray-400 hidden sm:block">
                      {item.user_email ?? "(no email)"}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                    {isResolved && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          item.viewed_by_user_at
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                        title={
                          item.viewed_by_user_at
                            ? `Tester saw the reply on ${new Date(item.viewed_by_user_at).toLocaleString()}`
                            : "Tester hasn't opened the feedback bubble since you resolved this"
                        }
                      >
                        {item.viewed_by_user_at ? "Seen" : "Unseen"}
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/40">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                      <div>
                        <h4 className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">From tester</h4>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.message}</p>
                      </div>
                      {item.screenshot_storage_path && (
                        <div className="md:w-40">
                          <h4 className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Screenshot</h4>
                          {screenshotUrls[item.id] ? (
                            <a
                              href={screenshotUrls[item.id]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block border border-gray-200 rounded overflow-hidden hover:border-gray-400 transition-colors"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={screenshotUrls[item.id]}
                                alt="Tester screenshot"
                                className="w-full h-auto bg-black"
                                style={{ maxHeight: 220, objectFit: "contain" }}
                              />
                            </a>
                          ) : (
                            <div className="w-full h-32 border border-gray-200 rounded flex items-center justify-center text-xs text-gray-400">
                              Loading…
                            </div>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">Click for full size · signed URL expires in 5 min</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-500">
                      {item.user_email && <span>Email: {item.user_email}</span>}
                      <span>Screen: {item.page_url}</span>
                      <span>Submitted: {new Date(item.created_at).toLocaleString("en-GB")}</span>
                      {item.app_version && <span>App: <span className="font-mono">v{item.app_version}</span></span>}
                      {item.user_agent && <span>UA: {item.user_agent}</span>}
                    </div>

                    {/* Auto-attached recent errors. The RN BetaFeedback
                        component snapshots up to 5 of the user's most
                        recent app_errors at submit time and embeds them
                        here so the admin sees the bug + the technical
                        context without an extra DB hop. */}
                    {item.recent_error_signatures && item.recent_error_signatures.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="text-[11px] uppercase font-semibold text-red-700 tracking-wide mb-2">
                          {item.recent_error_signatures.length} recent error{item.recent_error_signatures.length === 1 ? "" : "s"} from this user
                        </div>
                        <ul className="space-y-2">
                          {item.recent_error_signatures.map((sig, idx) => (
                            <li key={sig.id ?? `${idx}-${sig.message}`} className="text-[11px] text-red-900">
                              <div className="font-mono break-all">{sig.message}</div>
                              <div className="text-red-700 text-[10px] mt-0.5">
                                {sig.runtime && <>{sig.runtime} · </>}
                                {sig.level && <>{sig.level} · </>}
                                {sig.occurred_at && new Date(sig.occurred_at).toLocaleString("en-GB")}
                                {sig.id && (
                                  <> · <a
                                    href={`/admin/errors?focus=${sig.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-red-900"
                                  >Open in error log →</a></>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                        <div className="text-[10px] text-red-600 mt-2 italic">
                          Captured at submit time. Use this to triage whether the user's complaint matches a known error pattern.
                        </div>
                      </div>
                    )}

                    {isResolved && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                        <div className="text-[11px] uppercase font-semibold text-emerald-700 tracking-wide mb-1">
                          Resolved {new Date(item.resolved_at!).toLocaleString("en-GB")}
                        </div>
                        <p className="text-sm text-emerald-900 whitespace-pre-wrap">{item.resolution_note}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">
                        {isResolved ? "Edit reply" : "Reply + resolve"}
                      </h4>
                      <textarea
                        value={replyNote}
                        onChange={(e) => setReplyNote(e.target.value)}
                        placeholder="What was done, what's the workaround, when will it ship — the tester sees this verbatim in the app."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => resolveWithNote(item.id)}
                        disabled={submitting || !replyNote.trim()}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting
                          ? "Saving…"
                          : isResolved ? "Update reply" : "Resolve + notify"}
                      </button>
                      {isResolved && (
                        <button
                          onClick={() => reopen(item.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
