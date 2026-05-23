"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Inline append-note widget. Drop into any admin row that has a free-
// form text column you want to grow over time (risk_register.notes,
// app_releases.release_addendum, beta_nda_acceptances.admin_notes,
// etc.).
//
// Behaviour:
//   - Renders the existing notes verbatim (newest entries first by
//     convention, since this widget prepends).
//   - "+ Add note" button reveals a textarea + Save / Cancel.
//   - Save prepends a new line with `YYYY-MM-DD · <name> — <text>`
//     then a blank line + the existing notes. Author name auto-
//     filled from the current user's staff.name.
//   - On Save, fires an UPDATE via supabase-js; calls onSaved() so
//     the parent can reload its rows.
//
// Why prepend, not overwrite: every existing entry stays visible so
// the audit trail isn't destroyed by edits. New entries land at the
// top so the reader sees the latest first.

interface Props {
  /** Table to update — e.g. "risk_register". */
  table: string;
  /** Row id of the record being annotated. */
  rowId: string;
  /** Name of the column holding the notes blob. */
  column: string;
  /** Current value of that column (null if never written). */
  currentValue: string | null;
  /** Optional label for the section header above the existing notes. */
  label?: string;
  /** Called after a successful save so the parent can reload. */
  onSaved?: () => void;
}

let _cachedDisplayName: string | null = null;

async function getDisplayName(): Promise<string> {
  if (_cachedDisplayName) return _cachedDisplayName;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return "Admin";
    const { data } = await supabase
      .from("staff")
      .select("name")
      .eq("email", user.email)
      .maybeSingle();
    _cachedDisplayName = data?.name || user.email;
    return _cachedDisplayName ?? "Admin";
  } catch {
    return "Admin";
  }
}

export default function AdminAppendNote({
  table, rowId, column, currentValue, label, onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState<string>("you");

  useEffect(() => {
    getDisplayName().then(setDisplayName);
  }, []);

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
      const newEntry = `${today} · ${displayName} — ${trimmed}`;
      const next = currentValue && currentValue.trim()
        ? `${newEntry}\n\n${currentValue.trim()}`
        : newEntry;
      const { error } = await supabase.from(table).update({ [column]: next }).eq("id", rowId);
      if (error) {
        alert(`Could not save note: ${error.message}`);
        return;
      }
      setText("");
      setOpen(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="text-xs">
      {label && (
        <h4 className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">
          {label}
        </h4>
      )}
      {currentValue && currentValue.trim() ? (
        <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans bg-white border border-gray-200 rounded p-3 max-h-72 overflow-y-auto">
          {currentValue}
        </pre>
      ) : (
        <div className="text-[11px] text-gray-400 italic">No notes yet.</div>
      )}

      {open ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder={`Add note as ${displayName}. Prepended with today's date; existing notes preserved below.`}
            className="w-full px-3 py-2 border border-gray-300 rounded text-xs"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || !text.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save note"}
            </button>
            <button
              onClick={() => { setOpen(false); setText(""); }}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-2 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
        >
          + Add note
        </button>
      )}
    </div>
  );
}
