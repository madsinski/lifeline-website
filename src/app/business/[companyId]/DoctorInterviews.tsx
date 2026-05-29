"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Proposal {
  id: string;
  proposed_date: string;
  start_time: string;
  end_time: string;
  mode: "onsite" | "video";
  approval_status: "requested" | "approved" | "rejected";
}

export default function DoctorInterviews({ companyId }: { companyId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [mode, setMode] = useState<"onsite" | "video">("video");
  const [roomNotes, setRoomNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("doctor_interview_proposals")
      .select("id, proposed_date, start_time, end_time, mode, approval_status")
      .eq("company_id", companyId)
      .order("proposed_date", { ascending: true });
    setProposals((data as Proposal[]) || []);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setError("");
    if (!date) { setError("Pick a date."); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/business/doctor-interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        company_id: companyId,
        proposed_date: date,
        start_time: startTime,
        end_time: endTime,
        mode,
        room_notes: mode === "onsite" ? roomNotes : null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || "Failed"); return; }
    setAdding(false);
    setDate("");
    load();
  };

  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Doctor interviews</h2>
      <p className="text-sm text-gray-600 mt-1">
        Propose the day(s) for the final doctor interviews and choose how they run. Each interview is
        a 30-minute slot, one employee per slot — employees book their own time in the patient portal
        once Lifeline approves the day.
      </p>

      {proposals.length > 0 && (
        <div className="mt-4 space-y-2">
          {proposals.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">
              <div>
                <div className="font-semibold">{fmt(p.proposed_date)}</div>
                <div className="text-xs text-gray-600">
                  {p.start_time.slice(0,5)}–{p.end_time.slice(0,5)} · {p.mode === "onsite" ? "On-site" : "Video / phone"}
                </div>
              </div>
              {p.approval_status === "approved" ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Approved — employees can book</span>
              ) : p.approval_status === "rejected" ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Rejected — propose another day</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Awaiting Lifeline approval</span>
              )}
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500">Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
            </label>
            <label className="text-xs text-gray-500">From
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
            </label>
            <label className="text-xs text-gray-500">To
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
            </label>
          </div>
          <div className="flex gap-2">
            {(["video", "onsite"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border ${mode === m ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600"}`}>
                {m === "video" ? "Video / phone" : "On-site"}
              </button>
            ))}
          </div>
          {mode === "onsite" && (
            <div className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg p-3">
              <div className="font-semibold mb-1">On-site interviews need:</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>A private room at your office</li>
                <li>One computer screen</li>
              </ul>
              <input value={roomNotes} onChange={(e) => setRoomNotes(e.target.value)} placeholder="Room / floor notes (optional)"
                className="mt-2 w-full px-3 py-2 border border-amber-200 rounded-lg text-sm text-gray-900 bg-white" />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Sending…" : "Propose this day"}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-4 px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100">
          + Propose a doctor-interview day
        </button>
      )}
    </section>
  );
}
