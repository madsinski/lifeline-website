"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface FeedbackRow {
  id: string;
  created_at: string;
  user_email: string | null;
  page_url: string;
  feedback_type: "bug" | "feature" | "general";
  message: string;
  user_agent: string | null;
  resolved: boolean;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  bug: { label: "Bug", color: "bg-red-100 text-red-700" },
  feature: { label: "Feature", color: "bg-blue-100 text-blue-700" },
  general: { label: "General", color: "bg-gray-100 text-gray-600" },
};

const filters = ["all", "bug", "feature", "general"] as const;

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("beta_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as FeedbackRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleResolved = async (id: string, current: boolean) => {
    await supabase.from("beta_feedback").update({ resolved: !current }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, resolved: !current } : i)));
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.feedback_type === filter);
  const unresolvedCount = items.filter((i) => !i.resolved).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading feedback...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2937]">Beta Feedback</h2>
          <p className="text-xs text-gray-500">
            {items.length} total · {unresolvedCount} unresolved
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
        {filters.map((f) => {
          const count = f === "all" ? items.length : items.filter((i) => i.feedback_type === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? "bg-[#10B981] text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Feedback list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
          No feedback yet.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const tc = typeConfig[item.feedback_type];
            const isExpanded = expanded === item.id;
            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-colors ${
                  item.resolved ? "border-gray-100 opacity-60" : "border-gray-200"
                }`}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/50 transition-colors"
                >
                  {/* Type badge */}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tc.color}`}>
                    {tc.label}
                  </span>

                  {/* Message preview */}
                  <p className="flex-1 text-sm text-[#1F2937] truncate min-w-0">
                    {item.message}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] text-gray-400 hidden sm:block">
                      {item.page_url}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                    {item.resolved && (
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {/* Full message */}
                    <p className="text-sm text-[#374151] whitespace-pre-wrap">{item.message}</p>

                    {/* Details */}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-400">
                      {item.user_email && <span>Email: {item.user_email}</span>}
                      <span>Page: {item.page_url}</span>
                      <span>
                        {new Date(item.created_at).toLocaleString("en-GB", {
                          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => toggleResolved(item.id, item.resolved)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          item.resolved
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        {item.resolved ? "Mark Unresolved" : "Mark Resolved"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
