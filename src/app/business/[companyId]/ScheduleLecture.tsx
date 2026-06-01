"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  companyId: string;
  onClose: () => void;
  onCreated: () => void;
}

// Propose a 30-minute introduction lecture (on-site or video). Lifeline staff
// approve the time in the admin Approvals module before it's confirmed.
export default function ScheduleLecture({ companyId, onClose, onCreated }: Props) {
  const [lectureDate, setLectureDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [mode, setMode] = useState<"onsite" | "video">("onsite");
  const [location, setLocation] = useState("");
  const [roomNotes, setRoomNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Minimum = 2 weeks out, matching the measurement-day lead time.
  const minDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  const endTime = (() => {
    const [h, m] = startTime.split(":").map(Number);
    const total = Math.min(h * 60 + m + 30, 23 * 60 + 59);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  })();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!lectureDate || !startTime) { setError("Please fill in the date and start time."); return; }
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/business/intro-lectures", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        company_id: companyId,
        lecture_date: lectureDate,
        start_time: startTime,
        mode,
        location,
        room_notes: roomNotes,
      }),
    });
    const j = await res.json();
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
          <h2 className="text-xl font-semibold">Schedule the introduction lecture</h2>
          <p className="text-sm text-gray-600 mt-1">
            A 30-minute kick-off lecture for your team — on-site or by video.
            Tip: you can hold it the same day as the measurement day — e.g. the lecture at 09:00 and
            measurements from 10:00. Lifeline reviews and approves the time.
          </p>
        </div>

        <form onSubmit={save} className="p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Date</span>
            <input
              type="date"
              value={lectureDate}
              min={minDate}
              onChange={(e) => setLectureDate(e.target.value)}
              required
              className="input mt-1"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Start</span>
              <input type="time" value={startTime} step={300} onChange={(e) => setStartTime(e.target.value)} required className="input mt-1" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">End</span>
              <input type="time" value={endTime} readOnly disabled className="input mt-1 bg-gray-50 text-gray-500" />
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
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border ${mode === m ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"}`}
                >
                  {m === "onsite" ? "On-site" : "Video / phone"}
                </button>
              ))}
            </div>
          </div>

          {mode === "onsite" && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Office address</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Hafnarstræti 5, Reykjavík"
                  className="input mt-1"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Room details</span>
                <textarea
                  value={roomNotes}
                  onChange={(e) => setRoomNotes(e.target.value)}
                  rows={2}
                  placeholder="Meeting room, floor, door code…"
                  className="input mt-1"
                />
              </label>
            </>
          )}

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Request lecture"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
