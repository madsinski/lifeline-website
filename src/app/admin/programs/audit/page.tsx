"use client";

// Action library audit — tag every program_action with intensity,
// recovery floor, equipment needs, and (optional) explicit mode
// allow-list so the modes engine can make smart per-item decisions
// instead of blanket "drop all exercise on Sick" rules.
//
// Lives at /admin/programs/audit (sibling of the existing programs
// management page so the catalog work stays grouped).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useStaffGuard } from "@/lib/useStaffGuard";

type Intensity = "gentle" | "moderate" | "vigorous";
type RecoveryFloor = "any" | "not_sick" | "not_tired" | "not_vacation";
type Mode = "vacation" | "normal" | "beast" | "sick" | "tired";

interface ActionRow {
  id: string;
  program_id: string | null;
  action_key: string;
  label: string;
  category: "exercise" | "nutrition" | "sleep" | "mental" | "general";
  details: string[];
  intensity: Intensity | null;
  min_recovery_state: RecoveryFloor | null;
  equipment_needed: string[] | null;
  appropriate_modes: Mode[] | null;
  audited_at: string | null;
  audited_by_name: string | null;
}

const INTENSITIES: Intensity[] = ["gentle", "moderate", "vigorous"];
const RECOVERY: RecoveryFloor[] = ["any", "not_sick", "not_tired", "not_vacation"];
const MODES: Mode[] = ["vacation", "normal", "beast", "sick", "tired"];
const CATEGORIES = ["exercise", "nutrition", "sleep", "mental", "general"] as const;

const CAT_STYLE: Record<ActionRow["category"], string> = {
  exercise: "bg-orange-100 text-orange-700",
  nutrition: "bg-lime-100 text-lime-700",
  sleep: "bg-indigo-100 text-indigo-700",
  mental: "bg-sky-100 text-sky-700",
  general: "bg-gray-100 text-gray-700",
};

export default function ActionAuditPage() {
  const guard = useStaffGuard({ role: "admin" });
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | ActionRow["category"]>("all");
  const [statusFilter, setStatusFilter] = useState<"untagged" | "tagged" | "all">("untagged");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  // AI suggestion drafts — keyed by action id. When an entry exists,
  // the row's fields show the proposed values (with an "AI suggested"
  // pill) but nothing has been written to the DB yet. User edits in
  // place, then saves to commit.
  const [drafts, setDrafts] = useState<Record<string, {
    intensity: Intensity;
    min_recovery_state: RecoveryFloor;
    equipment_needed: string[];
    appropriate_modes: Mode[] | null;
    rationale: string;
  }>>({});
  const [suggesting, setSuggesting] = useState(false);
  const [suggestProgress, setSuggestProgress] = useState<{ done: number; total: number } | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("program_actions")
      .select("id, program_id, action_key, label, category, details, intensity, min_recovery_state, equipment_needed, appropriate_modes, audited_at, audited_by_name")
      .order("category", { ascending: true })
      .order("label", { ascending: true })
      .limit(2000);
    setRows(((data || []) as ActionRow[]).map((r) => ({
      ...r,
      details: Array.isArray(r.details) ? r.details : [],
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (guard.authorized) load();
  }, [guard.authorized]);

  const filtered = useMemo(() => {
    let r = rows;
    if (catFilter !== "all") r = r.filter((x) => x.category === catFilter);
    if (statusFilter === "tagged") r = r.filter((x) => x.audited_at);
    else if (statusFilter === "untagged") r = r.filter((x) => !x.audited_at);
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((x) =>
      x.label.toLowerCase().includes(q)
      || x.action_key.toLowerCase().includes(q)
      || x.details.join(" ").toLowerCase().includes(q),
    );
    return r;
  }, [rows, catFilter, statusFilter, search]);

  const counts = useMemo(() => ({
    all: rows.length,
    untagged: rows.filter((r) => !r.audited_at).length,
    tagged: rows.filter((r) => r.audited_at).length,
  }), [rows]);

  // Run AI tag suggestion against a set of action ids. Suggestions land
  // in the drafts map — they're visible immediately but require an
  // explicit save (per-row or "Save all suggested") to commit.
  const runSuggest = async (actionIds: string[]) => {
    if (actionIds.length === 0) return;
    setSuggesting(true);
    setSuggestError(null);
    setSuggestProgress({ done: 0, total: actionIds.length });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      // Process in chunks of 100 ids per HTTP call so a network blip
      // doesn't lose the whole job. Server further chunks for OpenAI.
      const HTTP_CHUNK = 100;
      const newDrafts: typeof drafts = {};
      for (let i = 0; i < actionIds.length; i += HTTP_CHUNK) {
        const slice = actionIds.slice(i, i + HTTP_CHUNK);
        const res = await fetch("/api/admin/program-actions/suggest-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action_ids: slice }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || "AI suggest failed");
        for (const s of (j.suggestions as Array<{
          id: string;
          intensity: Intensity;
          min_recovery_state: RecoveryFloor;
          equipment_needed: string[];
          appropriate_modes: Mode[] | null;
          rationale: string;
        }>)) {
          newDrafts[s.id] = {
            intensity: s.intensity,
            min_recovery_state: s.min_recovery_state,
            equipment_needed: s.equipment_needed,
            appropriate_modes: s.appropriate_modes,
            rationale: s.rationale,
          };
        }
        setSuggestProgress({ done: Math.min(i + HTTP_CHUNK, actionIds.length), total: actionIds.length });
      }
      setDrafts((prev) => ({ ...prev, ...newDrafts }));
    } catch (e) {
      setSuggestError((e as Error).message);
    } finally {
      setSuggesting(false);
      setSuggestProgress(null);
    }
  };

  const acceptDraft = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    await patchRow(id, {
      intensity: d.intensity,
      min_recovery_state: d.min_recovery_state,
      equipment_needed: d.equipment_needed.length > 0 ? d.equipment_needed : null,
      appropriate_modes: d.appropriate_modes,
    });
    setDrafts((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  };

  const acceptAllDrafts = async () => {
    const ids = Object.keys(drafts);
    if (ids.length === 0) return;
    if (!confirm(`Accept and save AI suggestions for ${ids.length} actions? You can still edit any after.`)) return;
    for (const id of ids) {
      await acceptDraft(id);
    }
  };

  const dismissDraft = (id: string) => {
    setDrafts((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  };

  // Optimistic-but-resilient: update the row locally, push to Supabase,
  // refresh from server on success so audited_at + audited_by_name come
  // back authoritative. On error revert to whatever the server has.
  const patchRow = async (id: string, patch: Partial<ActionRow>) => {
    setSavingIds((s) => new Set(s).add(id));
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      // Stamp audit metadata server-side. We don't trust the client
      // for this — pull the staff name from the session-linked staff
      // row inside an RPC eventually. For now, set it client-side
      // since this page is admin-only.
      const { data: { user } } = await supabase.auth.getUser();
      let audited_by_name: string | null = user?.email || null;
      if (user?.email) {
        const { data: staffRow } = await supabase.from("staff").select("name").eq("email", user.email).maybeSingle();
        if (staffRow?.name) audited_by_name = staffRow.name;
      }
      const { error } = await supabase
        .from("program_actions")
        .update({
          ...patch,
          audited_at: new Date().toISOString(),
          audited_by_name,
        })
        .eq("id", id);
      if (error) throw error;
      // Re-fetch this row authoritative
      const { data: fresh } = await supabase
        .from("program_actions")
        .select("id, program_id, action_key, label, category, details, intensity, min_recovery_state, equipment_needed, appropriate_modes, audited_at, audited_by_name")
        .eq("id", id)
        .maybeSingle();
      if (fresh) setRows((prev) => prev.map((r) => (r.id === id ? (fresh as ActionRow) : r)));
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
      await load();
    } finally {
      setSavingIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  if (guard.loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  if (!guard.authorized) return <div className="p-8 text-center text-red-600 text-sm">Admin access required.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Action library audit</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Tag each action with the metadata the modes engine needs:
            intensity (drives Sick / Tired filtering), recovery floor
            (hard never-show rules), equipment needs (Vacation auto-substitutes
            bodyweight), and an optional mode allow-list override.
            Untagged actions render to all modes today — nothing breaks
            until you decide otherwise.
          </p>
        </div>
        <Link
          href="/admin/programs"
          className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 mt-2"
        >
          ← Back to programs
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {([
            { k: "untagged", label: `Untagged (${counts.untagged})` },
            { k: "tagged", label: `Tagged (${counts.tagged})` },
            { k: "all", label: `All (${counts.all})` },
          ] as const).map((s) => (
            <button
              key={s.k}
              onClick={() => setStatusFilter(s.k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === s.k ? "bg-emerald-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setCatFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              catFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            All categories
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                catFilter === c ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search label / details / key…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-72"
        />
        <button
          onClick={() => runSuggest(filtered.filter((r) => !r.audited_at && !drafts[r.id]).map((r) => r.id))}
          disabled={suggesting || filtered.filter((r) => !r.audited_at && !drafts[r.id]).length === 0}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Use AI to propose tags for every untagged action in the current view. Suggestions are drafts you can edit and accept."
        >
          {suggesting && suggestProgress
            ? `Suggesting ${suggestProgress.done}/${suggestProgress.total}…`
            : `✨ AI suggest (${filtered.filter((r) => !r.audited_at && !drafts[r.id]).length})`}
        </button>
        {Object.keys(drafts).length > 0 && (
          <button
            onClick={acceptAllDrafts}
            disabled={suggesting}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
          >
            Accept all {Object.keys(drafts).length}
          </button>
        )}
      </div>

      {suggestError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {suggestError}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading actions…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-gray-500 text-sm bg-white rounded-xl border border-gray-100">
          No actions match the current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const saving = savingIds.has(row.id);
            const draft = drafts[row.id];
            // When a draft exists, the form fields show the proposed
            // values — but they're not yet persisted. The "Accept" /
            // "Dismiss" buttons commit or discard.
            const intensityVal = draft?.intensity ?? row.intensity ?? "";
            const recoveryVal = draft?.min_recovery_state ?? row.min_recovery_state ?? "";
            const equipmentVal = draft?.equipment_needed ?? row.equipment_needed ?? [];
            const modesVal = draft?.appropriate_modes ?? row.appropriate_modes ?? [];
            return (
              <article
                key={row.id}
                className={`bg-white rounded-xl border ${
                  draft ? "border-violet-300 bg-violet-50/30"
                  : row.audited_at ? "border-gray-100"
                  : "border-amber-200"
                } px-5 py-4 space-y-3 ${saving ? "opacity-70" : ""}`}
              >
                <header className="flex items-start gap-3 flex-wrap">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${CAT_STYLE[row.category]}`}>
                    {row.category}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-[#1F2937]">{row.label}</h3>
                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">{row.action_key}</p>
                  </div>
                  {draft && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-800">
                      ✨ AI suggested
                    </span>
                  )}
                  {!draft && row.audited_at && (
                    <span className="text-[11px] text-gray-400">
                      Tagged {new Date(row.audited_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {row.audited_by_name && ` · ${row.audited_by_name}`}
                    </span>
                  )}
                  {!draft && (
                    <button
                      onClick={() => runSuggest([row.id])}
                      disabled={suggesting || saving}
                      className="text-[11px] font-medium text-violet-700 hover:text-violet-800 disabled:opacity-50"
                      title="Ask AI to suggest tags for just this row"
                    >
                      ✨ AI suggest
                    </button>
                  )}
                </header>

                {row.details.length > 0 && (
                  <ul className="text-[12px] text-gray-600 list-disc list-inside space-y-0.5">
                    {row.details.slice(0, 5).map((d, i) => <li key={i}>{d}</li>)}
                    {row.details.length > 5 && <li className="text-gray-400">+ {row.details.length - 5} more</li>}
                  </ul>
                )}

                {draft && (
                  <p className="text-[11px] italic text-violet-800/80 bg-violet-100/40 px-3 py-1.5 rounded">
                    AI rationale: {draft.rationale}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <FieldSelect
                    label="Intensity"
                    value={intensityVal}
                    onChange={(v) =>
                      draft
                        ? setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, intensity: v as Intensity } }))
                        : patchRow(row.id, { intensity: (v || null) as Intensity | null })
                    }
                    options={[{ v: "", label: "— not tagged —" }, ...INTENSITIES.map((i) => ({ v: i, label: i }))]}
                  />
                  <FieldSelect
                    label="Recovery floor"
                    value={recoveryVal}
                    onChange={(v) =>
                      draft
                        ? setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, min_recovery_state: v as RecoveryFloor } }))
                        : patchRow(row.id, { min_recovery_state: (v || null) as RecoveryFloor | null })
                    }
                    options={[{ v: "", label: "— not tagged —" }, ...RECOVERY.map((r) => ({ v: r, label: r }))]}
                  />
                  <FieldEquipment
                    value={equipmentVal}
                    onChange={(eq) =>
                      draft
                        ? setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, equipment_needed: eq } }))
                        : patchRow(row.id, { equipment_needed: eq.length > 0 ? eq : null })
                    }
                  />
                  <FieldModes
                    value={modesVal}
                    onChange={(m) =>
                      draft
                        ? setDrafts((prev) => ({ ...prev, [row.id]: { ...draft, appropriate_modes: m.length > 0 ? m : null } }))
                        : patchRow(row.id, { appropriate_modes: m.length > 0 ? m : null })
                    }
                  />
                </div>

                {draft && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-violet-100">
                    <button
                      onClick={() => dismissDraft(row.id)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => acceptDraft(row.id)}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FieldSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <label className="block text-xs">
      <span className="block font-medium text-gray-600 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
      >
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </label>
  );
}

function FieldEquipment({
  value, onChange,
}: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => { setText(value.join(", ")); }, [value]);
  return (
    <label className="block text-xs">
      <span className="block font-medium text-gray-600 mb-1">
        Equipment <span className="text-gray-400 font-normal">(comma-separated)</span>
      </span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const arr = text.split(",").map((s) => s.trim()).filter(Boolean);
          if (JSON.stringify(arr) !== JSON.stringify(value)) onChange(arr);
        }}
        placeholder="e.g. dumbbells, bench"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
      />
    </label>
  );
}

function FieldModes({
  value, onChange,
}: { value: Mode[]; onChange: (v: Mode[]) => void }) {
  const toggle = (m: Mode) => {
    onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m]);
  };
  return (
    <div className="text-xs">
      <span className="block font-medium text-gray-600 mb-1">
        Mode override <span className="text-gray-400 font-normal">(empty = derived from intensity)</span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => {
          const active = value.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                active ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-gray-50 border-gray-200 text-gray-600"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
