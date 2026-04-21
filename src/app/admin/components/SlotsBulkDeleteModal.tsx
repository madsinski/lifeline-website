"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// Bulk-delete modal shared between admin/doctor-slots and
// admin/station-slots. Filters by date range, weekday, optional
// time range, booking status, and (for doctor slots) reserved
// company. Previews the count before deleting.

type CompanyOption = { id: string; name: string };

interface PreviewRow {
  id: string;
  slot_at: string;
  client_id: string | null;
  company_id: string | null;
  day: string;
  time: string;
}

interface Props {
  tableName: "doctor_slots" | "station_slots";
  displayName: string;            // "doctor consultation slot" / "measurement slot"
  companies?: CompanyOption[];    // required if showCompanyFilter
  showCompanyFilter?: boolean;    // doctor_slots has company_id; station_slots doesn't
  onClose: () => void;
  onDone: (deletedCount: number) => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SlotsBulkDeleteModal({
  tableName, displayName, companies = [], showCompanyFilter = false, onClose, onDone,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [onlyUnbooked, setOnlyUnbooked] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>("any"); // "any" | "none" | <id>
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const loadPreview = useCallback(async () => {
    if (!startDate || !endDate) { setRows([]); return; }
    setLoadingPreview(true);
    setErr("");
    const startIso = new Date(`${startDate}T00:00:00`).toISOString();
    const endIso = new Date(`${endDate}T23:59:59`).toISOString();
    const cols = showCompanyFilter
      ? "id, slot_at, client_id, company_id"
      : "id, slot_at, client_id";
    let q = supabase
      .from(tableName)
      .select(cols)
      .gte("slot_at", startIso)
      .lte("slot_at", endIso)
      .order("slot_at");
    if (onlyUnbooked) q = q.is("client_id", null);
    if (showCompanyFilter) {
      if (companyFilter === "none") q = q.is("company_id", null);
      else if (companyFilter !== "any") q = q.eq("company_id", companyFilter);
    }
    const { data, error } = await q;
    setLoadingPreview(false);
    if (error) { setErr(error.message); setRows([]); return; }
    const list: PreviewRow[] = ((data as unknown as Record<string, unknown>[]) || []).map((r) => {
      const at = new Date(r.slot_at as string);
      return {
        id: r.id as string,
        slot_at: r.slot_at as string,
        client_id: (r.client_id as string | null) ?? null,
        company_id: (r.company_id as string | null) ?? null,
        day: at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
        time: at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
      };
    })
      // Client-side filters for weekday + time range
      .filter((r) => {
        const at = new Date(r.slot_at);
        if (!weekdays.has(at.getDay())) return false;
        if (startTime) {
          const [sh, sm] = startTime.split(":").map(Number);
          const afterStart = at.getHours() > sh || (at.getHours() === sh && at.getMinutes() >= sm);
          if (!afterStart) return false;
        }
        if (endTime) {
          const [eh, em] = endTime.split(":").map(Number);
          const beforeEnd = at.getHours() < eh || (at.getHours() === eh && at.getMinutes() < em);
          if (!beforeEnd) return false;
        }
        return true;
      });
    setRows(list);
  }, [tableName, startDate, endDate, startTime, endTime, weekdays, onlyUnbooked, companyFilter, showCompanyFilter]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const bookedCount = useMemo(() => rows.filter((r) => r.client_id).length, [rows]);

  async function confirmDelete() {
    if (rows.length === 0) return;
    const warn = bookedCount > 0
      ? `This will delete ${rows.length} slots — ${bookedCount} of them are already BOOKED by clients. Delete anyway?`
      : `Delete ${rows.length} ${displayName}${rows.length === 1 ? "" : "s"}? This cannot be undone.`;
    if (!confirm(warn)) return;
    setDeleting(true);
    setErr("");
    const ids = rows.map((r) => r.id);
    // Delete in chunks to keep URLs under the query-string limit
    const CHUNK = 100;
    let total = 0;
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { error } = await supabase.from(tableName).delete().in("id", chunk);
        if (error) throw error;
        total += chunk.length;
      }
      onDone(total);
    } catch (e) {
      setErr(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !deleting && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk delete</h2>
            <p className="text-xs text-gray-500">Select a range — only matching {displayName}s will be removed.</p>
          </div>
          <button onClick={onClose} disabled={deleting} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label>
              <span className="text-xs font-medium text-gray-600">From</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </label>
            <label>
              <span className="text-xs font-medium text-gray-600">To</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </label>
            <label>
              <span className="text-xs font-medium text-gray-600">Earliest time (optional)</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </label>
            <label>
              <span className="text-xs font-medium text-gray-600">Latest time (optional)</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </label>
          </div>

          <div>
            <span className="text-xs font-medium text-gray-600">Weekdays</span>
            <div className="mt-1 flex gap-1.5 flex-wrap">
              {DAY_NAMES.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleWeekday(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    weekdays.has(i)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {showCompanyFilter && (
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Company reservation</span>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="any">Any (open or reserved)</option>
                <option value="none">Open to anyone</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>Reserved for {c.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={onlyUnbooked} onChange={(e) => setOnlyUnbooked(e.target.checked)} />
            Only delete unbooked slots
          </label>

          {/* Preview */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            {loadingPreview ? (
              <p className="text-sm text-gray-500">Loading preview…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-gray-500">No slots match these filters.</p>
            ) : (
              <div>
                <p className="text-sm text-gray-800">
                  Will delete <strong>{rows.length}</strong> {displayName}{rows.length === 1 ? "" : "s"}
                  {bookedCount > 0 && <> — <strong className="text-red-600">{bookedCount} already booked</strong></>}.
                </p>
                <div className="mt-2 max-h-32 overflow-y-auto text-[11px] text-gray-500 font-mono">
                  {rows.slice(0, 15).map((r) => (
                    <div key={r.id}>{r.day} · {r.time}{r.client_id ? " · booked" : ""}</div>
                  ))}
                  {rows.length > 15 && <div>… and {rows.length - 15} more</div>}
                </div>
              </div>
            )}
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-white sticky bottom-0">
          <button onClick={onClose} disabled={deleting} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleting || rows.length === 0}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40"
          >
            {deleting ? "Deleting…" : `Delete ${rows.length} slot${rows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
