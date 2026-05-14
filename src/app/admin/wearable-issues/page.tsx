"use client";

// Admin triage for wearable-setup troubleshooting reports submitted by
// users from the in-app wizard. Rows are ordered open-first by
// recency. Staff can mark resolved / dismissed inline, or use the
// template gallery + AI suggestion to compose a reply and email it.

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  WEARABLE_ISSUE_TEMPLATES,
  relevantTemplates,
  findTemplate,
  renderTemplate,
  type WearableIssueTemplate,
} from "@/lib/wearable-issue-templates";

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
  staff_reply: string | null;
  ai_suggested_template_id: string | null;
  ai_suggested_reply: string | null;
  ai_suggestion_confidence: number | null;
  ai_suggested_at: string | null;
  auto_replied: boolean;
  replied_at: string | null;
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
  const [filter, setFilter] = useState<"open" | "all" | "auto">("open");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyFloor, setAutoReplyFloor] = useState(0.85);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("wearable_setup_issues")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter === "open") {
      q = q.in("status", ["open", "in_progress"]);
    } else if (filter === "auto") {
      q = q.eq("auto_replied", true);
    }
    const { data } = await q;
    setRows((data ?? []) as IssueRow[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Load org-wide settings (auto-reply toggle + confidence floor).
  useEffect(() => {
    (async () => {
      setSettingsLoading(true);
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["wearable_auto_reply_enabled", "wearable_auto_reply_min_confidence"]);
      const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      setAutoReplyEnabled(map.wearable_auto_reply_enabled === true);
      const floorRaw = map.wearable_auto_reply_min_confidence;
      setAutoReplyFloor(typeof floorRaw === "number" ? floorRaw : 0.85);
      setSettingsLoading(false);
    })();
  }, []);

  const toggleAutoReply = async () => {
    const next = !autoReplyEnabled;
    setAutoReplyEnabled(next); // optimistic
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "wearable_auto_reply_enabled", value: next, updated_at: new Date().toISOString() });
    if (error) {
      setAutoReplyEnabled(!next); // revert on failure
      alert("Couldn't save setting: " + error.message);
    }
  };

  const setFloor = async (v: number) => {
    setAutoReplyFloor(v);
    await supabase
      .from("system_settings")
      .upsert({ key: "wearable_auto_reply_min_confidence", value: v, updated_at: new Date().toISOString() });
  };

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
      <div className="flex items-start justify-between mb-6 gap-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Wearable troubleshooting</h1>
          <p className="text-sm text-gray-500">
            Reports submitted from the in-app &ldquo;Connect your wearable&rdquo; wizard.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {(["open", "all", "auto"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full font-medium capitalize ${
                filter === k ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {k === "auto" ? "Auto-replied" : k}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-reply control panel */}
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Automatic AI reply</h2>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  autoReplyEnabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {autoReplyEnabled ? "On" : "Off"}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              When on, new tickets are routed to GPT-5.4 which picks a template from the gallery and emails the
              user the template body — without staff review. Only triggers when the model picks a template (never
              a custom reply) and its self-rated confidence is at or above the floor below.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-gray-600">Confidence floor:</label>
              <input
                type="range"
                min="0.5"
                max="0.99"
                step="0.01"
                value={autoReplyFloor}
                disabled={settingsLoading}
                onChange={(e) => setAutoReplyFloor(parseFloat(e.target.value))}
                onMouseUp={(e) => setFloor(parseFloat((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => setFloor(parseFloat((e.target as HTMLInputElement).value))}
                className="w-48 accent-emerald-600"
              />
              <span className="text-xs font-mono text-gray-700">{autoReplyFloor.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={toggleAutoReply}
            disabled={settingsLoading}
            className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors ${
              autoReplyEnabled ? "bg-emerald-600" : "bg-gray-300"
            }`}
            aria-label="Toggle auto-reply"
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                autoReplyEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}
      {!loading && rows.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 text-sm">
          {filter === "open"
            ? "No open issues — clean inbox."
            : filter === "auto"
            ? "No auto-replied tickets yet."
            : "Nothing recorded yet."}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <IssueCard key={row.id} row={row} onStatus={updateStatus} onReload={load} />
        ))}
      </div>
    </div>
  );
}

function IssueCard({
  row,
  onStatus,
  onReload,
}: {
  row: IssueRow;
  onStatus: (id: string, status: IssueRow["status"], note?: string) => Promise<void>;
  onReload: () => void;
}) {
  const [note, setNote] = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [draftSubject, setDraftSubject] = useState<string>("");
  const [composer, setComposer] = useState<"closed" | "open">("closed");
  const [pickedTemplateId, setPickedTemplateId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "suggesting" | "sending">(null);

  const statusBg: Record<IssueRow["status"], string> = {
    open: "bg-orange-100 text-orange-700",
    in_progress: "bg-blue-100 text-blue-700",
    resolved: "bg-emerald-100 text-emerald-700",
    dismissed: "bg-gray-100 text-gray-600",
  };

  const galleryForRow = useMemo(
    () => relevantTemplates(row.brand, row.step),
    [row.brand, row.step]
  );

  const useTemplate = (t: WearableIssueTemplate) => {
    const rendered = renderTemplate(t, { name: null }); // first-name interpolation happens server-side
    setPickedTemplateId(t.id);
    setDraft(rendered.body_md);
    setDraftSubject(rendered.subject);
    setComposer("open");
  };

  const requestSuggestion = async () => {
    setBusy("suggesting");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/wearable-issues/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ issue_id: row.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert("AI suggest failed: " + (json.error || res.statusText));
      } else {
        const s = json.suggestion as {
          template_id: string | null;
          reply_md: string;
          confidence: number;
          reasoning: string;
        };
        setPickedTemplateId(s.template_id);
        setDraft(s.reply_md);
        if (s.template_id) {
          const t = findTemplate(s.template_id);
          if (t) setDraftSubject(t.subject);
        } else {
          setDraftSubject("Following up on your wearable-setup question");
        }
        setComposer("open");
        onReload(); // refresh persisted suggestion fields
      }
    } finally {
      setBusy(null);
    }
  };

  const sendReply = async () => {
    if (!draft.trim()) { alert("Reply body is empty."); return; }
    setBusy("sending");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/wearable-issues/${row.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          reply_md: draft,
          subject: draftSubject || undefined,
          resolution_note: pickedTemplateId ? `Sent template "${pickedTemplateId}"` : "Custom reply",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert("Send failed: " + (json.error || res.statusText));
      } else {
        setComposer("closed");
        setDraft("");
        setPickedTemplateId(null);
        onReload();
      }
    } finally {
      setBusy(null);
    }
  };

  const hasSuggestion = row.ai_suggested_at && row.ai_suggested_reply;
  const aiAlreadyPicked = row.ai_suggested_template_id
    ? findTemplate(row.ai_suggested_template_id)
    : null;

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
            {row.auto_replied && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                auto-replied
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{row.message}</p>
          <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
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
            {row.replied_at && (
              <>
                <span>·</span>
                <span className="text-emerald-700">replied {new Date(row.replied_at).toLocaleString()}</span>
              </>
            )}
          </div>

          {/* Persisted AI suggestion summary */}
          {hasSuggestion && (
            <div className="mt-3 rounded-lg bg-indigo-50/60 border border-indigo-100 p-3">
              <div className="flex items-center gap-2 mb-1 text-[11px] font-semibold text-indigo-900 uppercase tracking-wide">
                <span>AI suggestion</span>
                <span className="font-mono text-indigo-700 normal-case tracking-normal">
                  {Math.round((row.ai_suggestion_confidence ?? 0) * 100)}% conf
                </span>
                {aiAlreadyPicked ? (
                  <span className="font-medium normal-case tracking-normal text-indigo-700">
                    · template <span className="font-mono">{aiAlreadyPicked.id}</span>
                  </span>
                ) : (
                  <span className="font-medium normal-case tracking-normal text-indigo-700">· custom reply</span>
                )}
              </div>
              <p className="text-xs text-indigo-900/80 whitespace-pre-wrap line-clamp-3">{row.ai_suggested_reply}</p>
            </div>
          )}

          {/* Reply that actually got sent */}
          {row.staff_reply && (
            <div className="mt-3 rounded-lg bg-emerald-50/70 border border-emerald-100 p-3">
              <div className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wide mb-1">
                Reply sent
              </div>
              <p className="text-xs text-emerald-900/80 whitespace-pre-wrap">{row.staff_reply}</p>
            </div>
          )}

          {row.resolution_note && !row.staff_reply && (
            <div className="mt-3 text-xs italic text-gray-500 border-l-2 border-emerald-300 pl-3">
              Resolution: {row.resolution_note}
            </div>
          )}
        </div>
      </div>

      {(row.status === "open" || row.status === "in_progress") && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {composer === "closed" && !showResolve && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {row.status === "open" && (
                <button
                  onClick={() => onStatus(row.id, "in_progress")}
                  className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium hover:bg-blue-100"
                >
                  Take it
                </button>
              )}
              <button
                onClick={requestSuggestion}
                disabled={busy === "suggesting"}
                className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 disabled:opacity-50"
              >
                {busy === "suggesting" ? "Thinking…" : hasSuggestion ? "Re-run AI" : "Get AI suggestion"}
              </button>
              <TemplatePicker
                gallery={galleryForRow}
                onPick={useTemplate}
              />
              <button
                onClick={() => setComposer("open")}
                className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100"
              >
                Write custom reply
              </button>
              <button
                onClick={() => setShowResolve(true)}
                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
              >
                Resolve without reply
              </button>
              <button
                onClick={() => onStatus(row.id, "dismissed")}
                className="px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 font-medium hover:bg-gray-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {composer === "open" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs font-medium text-gray-600 w-16">Subject</label>
                <input
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  placeholder="Email subject"
                />
              </div>
              {pickedTemplateId && (
                <div className="text-[11px] text-gray-500 mb-1">
                  Using template <span className="font-mono">{pickedTemplateId}</span> — edit freely before sending.
                </div>
              )}
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={10}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm font-mono"
                placeholder="Reply (markdown)…"
              />
              <div className="mt-2 flex items-center gap-2 text-xs">
                <button
                  onClick={sendReply}
                  disabled={busy === "sending"}
                  className="px-3 py-1.5 rounded-full bg-emerald-600 text-white font-medium disabled:opacity-50"
                >
                  {busy === "sending" ? "Sending…" : "Send reply + resolve"}
                </button>
                <button
                  onClick={() => { setComposer("closed"); setDraft(""); setPickedTemplateId(null); }}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showResolve && (
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
      )}
    </div>
  );
}

function TemplatePicker({
  gallery,
  onPick,
}: {
  gallery: WearableIssueTemplate[];
  onPick: (t: WearableIssueTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const all = gallery.length > 0 ? gallery : WEARABLE_ISSUE_TEMPLATES;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 font-medium hover:bg-amber-100"
      >
        Pick template ({all.length})
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-80 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {all.map((t) => (
              <button
                key={t.id}
                onClick={() => { onPick(t); setOpen(false); }}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-amber-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-800">{t.title}</div>
                <div className="text-[10px] text-gray-400 font-mono">{t.id}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
