"use client";

// Admin triage for wearable-setup troubleshooting reports submitted by
// users from the in-app wizard. Rows are ordered open-first by
// recency. Staff can mark resolved / dismissed inline.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface IssueRow {
  id: string;
  client_id: string | null;
  brand: string;
  step: number;
  message: string;
  device_platform: string | null;
  device_version: string | null;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

const BRAND_LABELS: Record<string, string> = {
  garmin: "Garmin",
  samsung: "Samsung",
  pixel: "Pixel Watch",
  fitbit: "Fitbit",
  withings: "Withings",
  whoop: "WHOOP",
  oura: "Oura",
  ultrahuman: "Ultrahuman",
  polar: "Polar",
  suunto: "Suunto",
  apple_watch: "Apple Watch",
  other: "Other",
  none: "None",
};

const STEP_LABELS: Record<number, string> = {
  0: "Brand picker",
  1: "Install apps",
  2: "Permissions",
  3: "Verify data",
  4: "Success",
};

export default function WearableIssuesPage() {
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("wearable_setup_issues")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter === "open") {
      q = q.in("status", ["open", "in_progress"]);
    }
    const { data } = await q;
    setRows((data ?? []) as IssueRow[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: IssueRow["status"], note?: string) => {
    const patch: Partial<IssueRow> = { status };
    if (status === "resolved" || status === "dismissed") {
      patch.resolved_at = new Date().toISOString();
      if (note) patch.resolution_note = note;
    }
    await supabase.from("wearable_setup_issues").update(patch).eq("id", id);
    load();
  };

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Wearable troubleshooting</h1>
          <p className="text-sm text-gray-500">
            Reports submitted from the in-app "Connect your wearable" wizard.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setFilter("open")}
            className={`px-3 py-1.5 rounded-full font-medium ${
              filter === "open" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-full font-medium ${
              filter === "all" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}
      {!loading && rows.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 text-sm">
          {filter === "open"
            ? "No open issues — clean inbox."
            : "Nothing recorded yet."}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <IssueCard key={row.id} row={row} onStatus={updateStatus} />
        ))}
      </div>
    </div>
  );
}

function IssueCard({
  row,
  onStatus,
}: {
  row: IssueRow;
  onStatus: (id: string, status: IssueRow["status"], note?: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [showResolve, setShowResolve] = useState(false);

  const statusBg: Record<IssueRow["status"], string> = {
    open: "bg-orange-100 text-orange-700",
    in_progress: "bg-blue-100 text-blue-700",
    resolved: "bg-emerald-100 text-emerald-700",
    dismissed: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900 text-sm">
              {BRAND_LABELS[row.brand] ?? row.brand}
            </span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-500">
              stuck at {STEP_LABELS[row.step] ?? `step ${row.step}`}
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBg[row.status]}`}>
              {row.status}
            </span>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{row.message}</p>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span>{new Date(row.created_at).toLocaleString()}</span>
            {row.device_platform && (
              <>
                <span>·</span>
                <span className="font-mono">
                  {row.device_platform}
                  {row.device_version ? ` ${row.device_version}` : ""}
                </span>
              </>
            )}
            {row.client_id && (
              <>
                <span>·</span>
                <Link
                  href={`/admin/clients/${row.client_id}`}
                  className="text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  view client →
                </Link>
              </>
            )}
          </div>
          {row.resolution_note && (
            <div className="mt-3 text-xs italic text-gray-500 border-l-2 border-emerald-300 pl-3">
              Resolution: {row.resolution_note}
            </div>
          )}
        </div>
      </div>

      {row.status === "open" || row.status === "in_progress" ? (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {!showResolve ? (
            <div className="flex items-center gap-2 text-xs">
              {row.status === "open" && (
                <button
                  onClick={() => onStatus(row.id, "in_progress")}
                  className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium hover:bg-blue-100"
                >
                  Take it
                </button>
              )}
              <button
                onClick={() => setShowResolve(true)}
                className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100"
              >
                Resolve
              </button>
              <button
                onClick={() => onStatus(row.id, "dismissed")}
                className="px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 font-medium hover:bg-gray-100"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Brief resolution note (visible to staff only)…"
                rows={2}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm"
              />
              <div className="mt-2 flex items-center gap-2 text-xs">
                <button
                  onClick={async () => { await onStatus(row.id, "resolved", note); setShowResolve(false); setNote(""); }}
                  className="px-3 py-1.5 rounded-full bg-emerald-600 text-white font-medium"
                >
                  Save resolution
                </button>
                <button
                  onClick={() => { setShowResolve(false); setNote(""); }}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
