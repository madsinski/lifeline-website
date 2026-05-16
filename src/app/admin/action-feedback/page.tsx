"use client";

// Admin inbox for the in-app "Not for me" action — every time a user
// permanently dismisses a library action from their plan we get a row
// here with the reason category + optional free-text. The whole point
// is to surface the WHY behind churn at the action level: which actions
// are dragging programs down, what the dominant rejection reason is,
// and which specific users to follow up with.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Mirror of DISMISS_REASONS in the RN app (NotForMeSheet.tsx). Order
// here drives chip rendering. If you add a category, add it in both
// places — the app writes, this page reads.
const REASON_LABELS: Record<string, string> = {
  physical_discomfort:  "Hurts / uncomfortable",
  dietary_restriction:  "Doesn't fit my diet",
  tried_didnt_work:     "Tried it, didn't work",
  doesnt_fit_lifestyle: "Doesn't fit my life",
  medical_reason:       "Medical reason",
  not_interested:       "Just not for me",
  other:                "Other",
};
const REASON_KEYS = Object.keys(REASON_LABELS);

// Reason → tailwind chip styling. Kept close to the labels so a future
// category needs one new color entry, not a switch lookup.
const REASON_CHIP: Record<string, string> = {
  physical_discomfort:  "bg-red-50 text-red-700 ring-red-200",
  dietary_restriction:  "bg-amber-50 text-amber-800 ring-amber-200",
  tried_didnt_work:     "bg-orange-50 text-orange-700 ring-orange-200",
  doesnt_fit_lifestyle: "bg-blue-50 text-blue-700 ring-blue-200",
  medical_reason:       "bg-rose-50 text-rose-700 ring-rose-200",
  not_interested:       "bg-gray-100 text-gray-600 ring-gray-200",
  other:                "bg-slate-100 text-slate-600 ring-slate-200",
};

interface DismissalRow {
  client_id: string;
  lib_key: string;
  reason_category: string;
  reason_text: string | null;
  dismissed_at: string;
}

interface LibraryAction { lib_key: string; label: string | null; pillar?: string | null; }
interface ClientLite     { id: string; full_name: string | null; email: string | null; }

interface AggregatedRow {
  lib_key: string;
  label: string;
  pillar: string | null;
  count: number;
  byReason: Record<string, number>;
  rows: DismissalRow[];
}

type ViewMode = "by_action" | "recent";

export default function ActionFeedbackPage() {
  const [dismissals, setDismissals] = useState<DismissalRow[]>([]);
  const [labels, setLabels] = useState<Record<string, LibraryAction>>({});
  const [clients, setClients] = useState<Record<string, ClientLite>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("by_action");
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: ds } = await supabase
        .from("client_action_dismissals")
        .select("*")
        .order("dismissed_at", { ascending: false })
        .limit(2000);
      const rows = (ds ?? []) as DismissalRow[];
      setDismissals(rows);

      // Resolve lib_key → label/pillar in one batch. Missing rows just
      // fall back to the key in the UI, so a stale dismissal pointing at
      // a deleted library entry still renders.
      const libKeys = Array.from(new Set(rows.map((r) => r.lib_key)));
      const clientIds = Array.from(new Set(rows.map((r) => r.client_id)));

      const [libRes, clientRes] = await Promise.all([
        libKeys.length === 0
          ? Promise.resolve({ data: [] })
          : supabase.from("action_library").select("lib_key, label, pillar").in("lib_key", libKeys),
        clientIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase.from("clients_decrypted").select("id, full_name, email").in("id", clientIds),
      ]);

      const labelMap: Record<string, LibraryAction> = {};
      for (const r of (libRes.data ?? []) as LibraryAction[]) labelMap[r.lib_key] = r;
      setLabels(labelMap);

      const clientMap: Record<string, ClientLite> = {};
      for (const c of (clientRes.data ?? []) as ClientLite[]) clientMap[c.id] = c;
      setClients(clientMap);

      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!reasonFilter) return dismissals;
    return dismissals.filter((d) => d.reason_category === reasonFilter);
  }, [dismissals, reasonFilter]);

  const aggregated: AggregatedRow[] = useMemo(() => {
    const map = new Map<string, AggregatedRow>();
    for (const d of filtered) {
      const lib = labels[d.lib_key];
      const existing = map.get(d.lib_key);
      if (existing) {
        existing.count += 1;
        existing.byReason[d.reason_category] = (existing.byReason[d.reason_category] ?? 0) + 1;
        existing.rows.push(d);
      } else {
        map.set(d.lib_key, {
          lib_key: d.lib_key,
          label: lib?.label || d.lib_key,
          pillar: lib?.pillar ?? null,
          count: 1,
          byReason: { [d.reason_category]: 1 },
          rows: [d],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filtered, labels]);

  // Reason counts ignore the active reason filter so chips always show
  // total volume — otherwise selecting a chip would hide the others'
  // existence and confuse the staff member about what's possible.
  const reasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of dismissals) counts[d.reason_category] = (counts[d.reason_category] ?? 0) + 1;
    return counts;
  }, [dismissals]);

  return (
    <div className="px-8 py-6">
      <div className="flex items-start justify-between mb-6 gap-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Action feedback</h1>
          <p className="text-sm text-gray-500">
            Items users have permanently removed from their plan via the &ldquo;Not for me&rdquo; button,
            with the reason category and optional free-text they gave us.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {(["by_action", "recent"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`px-3 py-1.5 rounded-full font-medium ${
                view === k ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {k === "by_action" ? "By action" : "Recent"}
            </button>
          ))}
        </div>
      </div>

      {/* Reason filter chips — always show every category so even
          zero-count reasons surface as an empty option. */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setReasonFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium ring-1 ${
            !reasonFilter
              ? "bg-emerald-600 text-white ring-emerald-600"
              : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
          }`}
        >
          All ({dismissals.length})
        </button>
        {REASON_KEYS.map((k) => {
          const active = reasonFilter === k;
          return (
            <button
              key={k}
              onClick={() => setReasonFilter(active ? null : k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ring-1 ${
                active
                  ? "bg-emerald-600 text-white ring-emerald-600"
                  : `${REASON_CHIP[k]} hover:opacity-90`
              }`}
            >
              {REASON_LABELS[k]} ({reasonCounts[k] ?? 0})
            </button>
          );
        })}
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}
      {!loading && dismissals.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 text-sm">
          No dismissals yet. When users hit &ldquo;Not for me&rdquo; on an action card, it lands here.
        </div>
      )}

      {!loading && view === "by_action" && aggregated.length > 0 && (
        <div className="space-y-3">
          {aggregated.map((row) => (
            <AggregatedCard
              key={row.lib_key}
              row={row}
              clients={clients}
              expanded={expandedKey === row.lib_key}
              onToggle={() => setExpandedKey(expandedKey === row.lib_key ? null : row.lib_key)}
            />
          ))}
        </div>
      )}

      {!loading && view === "recent" && filtered.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-4 py-2 font-medium">Action</th>
                <th className="text-left px-4 py-2 font-medium">Reason</th>
                <th className="text-left px-4 py-2 font-medium">Client</th>
                <th className="text-left px-4 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const lib = labels[d.lib_key];
                const c = clients[d.client_id];
                return (
                  <tr key={d.client_id + d.lib_key} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(d.dismissed_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">{lib?.label || d.lib_key}</div>
                      <div className="text-[10px] font-mono text-gray-400">{d.lib_key}</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${REASON_CHIP[d.reason_category] ?? REASON_CHIP.other}`}>
                        {REASON_LABELS[d.reason_category] ?? d.reason_category}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {c ? (
                        <Link href={`/admin/clients/${d.client_id}`} className="text-emerald-700 hover:underline">
                          {c.full_name || c.email || d.client_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-gray-400 font-mono text-xs">{d.client_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 italic max-w-md">
                      {d.reason_text || <span className="text-gray-300 not-italic">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AggregatedCard({
  row, clients, expanded, onToggle,
}: {
  row: AggregatedRow;
  clients: Record<string, ClientLite>;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button onClick={onToggle} className="w-full text-left p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900">{row.label}</span>
              {row.pillar && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {row.pillar}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-gray-400 mb-2">{row.lib_key}</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(row.byReason)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => (
                  <span
                    key={k}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${REASON_CHIP[k] ?? REASON_CHIP.other}`}
                  >
                    {REASON_LABELS[k] ?? k} · {n}
                  </span>
                ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 leading-none">{row.count}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">dismissals</div>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-4 py-2 font-medium">Reason</th>
                <th className="text-left px-4 py-2 font-medium">Client</th>
                <th className="text-left px-4 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {row.rows.map((d) => {
                const c = clients[d.client_id];
                return (
                  <tr key={d.client_id + d.lib_key} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(d.dismissed_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${REASON_CHIP[d.reason_category] ?? REASON_CHIP.other}`}>
                        {REASON_LABELS[d.reason_category] ?? d.reason_category}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {c ? (
                        <Link href={`/admin/clients/${d.client_id}`} className="text-emerald-700 hover:underline">
                          {c.full_name || c.email || d.client_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-gray-400 font-mono">{d.client_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600 italic max-w-md">
                      {d.reason_text || <span className="text-gray-300 not-italic">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
