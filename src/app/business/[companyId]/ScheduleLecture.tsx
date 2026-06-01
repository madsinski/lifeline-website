"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const LECTURE_MIN = 30;

// "HH:MM" + minutes → "HH:MM" (clamped to 23:59).
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export interface EditableLecture {
  id: string;
  lecture_date: string;
  start_time: string;
  mode: "onsite" | "video";
  location: string | null;
  room_notes: string | null;
}

interface Props {
  companyId: string;
  /** When set, the modal edits this one lecture instead of creating new ones. */
  editLecture?: EditableLecture | null;
  onClose: () => void;
  onCreated: () => void;
}

interface SessionRow {
  key: number;
  date: string;
  start: string;
  mode: "onsite" | "video";
  location: string;
  roomNotes: string;
}

let sessionKeySeq = 1;
const newSession = (seed?: Partial<SessionRow>): SessionRow => ({
  key: sessionKeySeq++,
  date: "",
  start: "09:00",
  mode: "onsite",
  location: "",
  roomNotes: "",
  ...seed,
});

// Propose 30-minute introduction lecture(s) (on-site or video). A company can
// suggest several sittings/times in one go — useful for shift teams or large
// groups. Lifeline staff approve each time in the admin Approvals module.
export default function ScheduleLecture({ companyId, editLecture = null, onClose, onCreated }: Props) {
  const isEdit = !!editLecture;

  const [sessions, setSessions] = useState<SessionRow[]>(() => {
    if (editLecture) {
      return [newSession({
        date: editLecture.lecture_date,
        start: editLecture.start_time.slice(0, 5),
        mode: editLecture.mode,
        location: editLecture.location || "",
        roomNotes: editLecture.room_notes || "",
      })];
    }
    return [newSession()];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Minimum = 2 weeks out, matching the measurement-day lead time.
  const [minDate] = useState(() => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));

  const patch = (key: number, p: Partial<SessionRow>) =>
    setSessions((ss) => ss.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const addSession = () => setSessions((ss) => [...ss, newSession()]);
  const removeSession = (key: number) =>
    setSessions((ss) => (ss.length > 1 ? ss.filter((s) => s.key !== key) : ss));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    for (const s of sessions) {
      if (!s.date || !s.start) { setError("Please fill in the date and start time for every session."); return; }
    }
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

    if (isEdit && editLecture) {
      const s = sessions[0];
      const res = await fetch(`/api/business/intro-lectures/${editLecture.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          lecture_date: s.date,
          start_time: s.start,
          mode: s.mode,
          location: s.location,
          room_notes: s.roomNotes,
        }),
      });
      const j = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) { setError(j.error || "Failed"); return; }
      onCreated();
      return;
    }

    const res = await fetch("/api/business/intro-lectures", {
      method: "POST",
      headers,
      body: JSON.stringify({
        company_id: companyId,
        sessions: sessions.map((s) => ({
          lecture_date: s.date,
          start_time: s.start,
          mode: s.mode,
          location: s.location,
          room_notes: s.roomNotes,
        })),
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(j.error || "Failed"); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">
            {isEdit ? "Edit the introduction lecture" : "Schedule the introduction lecture"}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            A 30-minute kick-off lecture for your team — on-site or by video.
            Tip: you can hold it the same day as the measurement day — e.g. the lecture at 09:00 and
            measurements from 10:00. Lifeline reviews and approves the time.
          </p>
        </div>

        <form onSubmit={save} className="p-6 space-y-4">
          <div className="space-y-4">
            {sessions.map((s, i) => (
              <div key={s.key} className="rounded-xl border border-gray-200 p-4 space-y-3">
                {!isEdit && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">Session {i + 1}</span>
                    {sessions.length > 1 && (
                      <button type="button" onClick={() => removeSession(s.key)}
                        className="text-xs text-red-600 hover:underline">Remove</button>
                    )}
                  </div>
                )}

                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Date</span>
                  <input
                    type="date"
                    value={s.date}
                    min={minDate}
                    onChange={(e) => patch(s.key, { date: e.target.value })}
                    required
                    className="input mt-1"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Start</span>
                    <input type="time" value={s.start} step={300}
                      onChange={(e) => patch(s.key, { start: e.target.value })} required className="input mt-1" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">End</span>
                    <input type="time" value={addMinutes(s.start, LECTURE_MIN)} readOnly disabled
                      className="input mt-1 bg-gray-50 text-gray-500" />
                    <span className="text-[10px] text-gray-400">30 minutes</span>
                  </label>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">How</span>
                  <div className="mt-1 flex gap-2">
                    {(["onsite", "video"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => patch(s.key, { mode: m })}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border ${s.mode === m ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"}`}
                      >
                        {m === "onsite" ? "On-site" : "Video / phone"}
                      </button>
                    ))}
                  </div>
                </div>

                {s.mode === "onsite" && (
                  <>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Office address</span>
                      <input
                        type="text"
                        value={s.location}
                        onChange={(e) => patch(s.key, { location: e.target.value })}
                        placeholder="Hafnarstræti 5, Reykjavík"
                        className="input mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Room details</span>
                      <textarea
                        value={s.roomNotes}
                        onChange={(e) => patch(s.key, { roomNotes: e.target.value })}
                        rows={2}
                        placeholder="Meeting room, floor, door code…"
                        className="input mt-1"
                      />
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>

          {!isEdit && (
            <button type="button" onClick={addSession} className="text-sm text-blue-600 hover:underline">
              + Add another session
            </button>
          )}

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : isEdit ? "Save changes" : "Request lecture"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
