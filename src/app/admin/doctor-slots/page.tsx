"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DoctorSlot = {
  id: string;
  slot_at: string;
  duration_minutes: number;
  mode: "video" | "phone" | "in_person";
  location: string | null;
  meeting_link: string | null;
  doctor_name: string | null;
  notes: string | null;
  client_id: string | null;
  company_id: string | null;
  booking_note: string | null;
  booked_at: string | null;
  completed_at: string | null;
  client?: { email?: string | null; full_name?: string | null } | null;
  company?: { name?: string | null } | null;
};

type Filter = "upcoming" | "available" | "booked" | "past" | "all";

export default function DoctorSlotsAdminPage() {
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("doctor_slots")
      .select(`
        id, slot_at, duration_minutes, mode, location, meeting_link, doctor_name, notes,
        client_id, company_id, booking_note, booked_at, completed_at,
        client:clients(email, full_name),
        company:companies(name)
      `)
      .order("slot_at", { ascending: true });
    setLoading(false);
    if (error) {
      setMsg(`Load failed: ${error.message}`);
      return;
    }
    setSlots((data as unknown as DoctorSlot[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return slots.filter((s) => {
      const t = new Date(s.slot_at).getTime();
      const isPast = t < now;
      const isBooked = !!s.client_id;
      switch (filter) {
        case "available": return !isPast && !isBooked;
        case "booked": return !isPast && isBooked;
        case "past": return isPast;
        case "upcoming": return !isPast;
        case "all": return true;
      }
    });
  }, [slots, filter, now]);

  async function deleteSlot(id: string) {
    if (!confirm("Delete this slot?")) return;
    const { error } = await supabase.from("doctor_slots").delete().eq("id", id);
    if (error) { setMsg(`Delete failed: ${error.message}`); return; }
    setMsg("Deleted.");
    load();
  }

  async function markCompleted(id: string) {
    const { error } = await supabase.from("doctor_slots").update({ completed_at: new Date().toISOString() }).eq("id", id);
    if (error) { setMsg(`Update failed: ${error.message}`); return; }
    setMsg("Marked completed.");
    load();
  }

  async function markUncompleted(id: string) {
    const { error } = await supabase.from("doctor_slots").update({ completed_at: null }).eq("id", id);
    if (error) { setMsg(`Update failed: ${error.message}`); return; }
    setMsg("Marked active.");
    load();
  }

  const counts = useMemo(() => {
    let avail = 0, booked = 0, past = 0;
    for (const s of slots) {
      const t = new Date(s.slot_at).getTime();
      if (t < now) past++;
      else if (s.client_id) booked++;
      else avail++;
    }
    return { avail, booked, past, all: slots.length };
  }, [slots, now]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1F2937]">Doctor consultation slots</h1>
          <p className="text-sm text-[#6B7280]">Create and manage the available 1:1 consultation slots for employees.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowAdd(true); setShowBulk(false); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 hover:opacity-90">
            + Add slot
          </button>
          <button onClick={() => { setShowBulk(true); setShowAdd(false); }} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50">
            Bulk add
          </button>
        </div>
      </header>

      {msg && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          {msg}
          <button onClick={() => setMsg("")} className="ml-2 text-xs underline">dismiss</button>
        </div>
      )}

      {showAdd && <AddSlotForm onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {showBulk && <BulkAddForm onClose={() => setShowBulk(false)} onSaved={() => { setShowBulk(false); load(); }} />}

      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
        {([
          ["upcoming", `Upcoming (${counts.avail + counts.booked})`],
          ["available", `Available (${counts.avail})`],
          ["booked", `Booked (${counts.booked})`],
          ["past", `Past (${counts.past})`],
          ["all", `All (${counts.all})`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === key ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-sm text-gray-600">
          No slots in this view. Use <span className="font-semibold">+ Add slot</span> or <span className="font-semibold">Bulk add</span> above.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">When</th>
                <th className="px-4 py-3 text-left font-medium">Mode</th>
                <th className="px-4 py-3 text-left font-medium">Doctor</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Booked by</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const d = new Date(s.slot_at);
                const isPast = d.getTime() < now;
                const isBooked = !!s.client_id;
                const name = s.client?.full_name || "";
                return (
                  <tr key={s.id} className="border-t border-gray-100 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
                      <div className="text-xs text-gray-600">{d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })} · {s.duration_minutes} min</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="capitalize">{s.mode.replace("_", " ")}</span>
                      {s.location && <div className="text-xs text-gray-500">{s.location}</div>}
                      {s.meeting_link && <div className="text-xs text-gray-500 truncate max-w-[180px]">{s.meeting_link}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.doctor_name || "—"}</td>
                    <td className="px-4 py-3">
                      {s.completed_at ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">Completed</span>
                      ) : isPast ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Past</span>
                      ) : isBooked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Booked</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Available</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {isBooked ? (
                        <>
                          <div className="font-medium">{name || s.client?.email || "—"}</div>
                          {s.company?.name && <div className="text-xs text-gray-500">{s.company.name}</div>}
                          {s.booking_note && <div className="text-xs text-gray-500 italic mt-0.5">“{s.booking_note}”</div>}
                        </>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {isBooked && !s.completed_at && (
                        <button onClick={() => markCompleted(s.id)} className="text-xs font-medium text-emerald-700 hover:underline">Mark done</button>
                      )}
                      {s.completed_at && (
                        <button onClick={() => markUncompleted(s.id)} className="text-xs font-medium text-gray-600 hover:underline">Unmark</button>
                      )}
                      <button onClick={() => deleteSlot(s.id)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
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

function AddSlotForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<"video" | "phone" | "in_person">("video");
  const [doctorName, setDoctorName] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!date || !time) { setErr("Pick a date and time."); return; }
    setSaving(true);
    setErr("");
    const slotAt = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await supabase.from("doctor_slots").insert({
      slot_at: slotAt,
      duration_minutes: duration,
      mode,
      doctor_name: doctorName.trim() || null,
      location: location.trim() || null,
      meeting_link: meetingLink.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-blue-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Add a doctor slot</h2>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Duration (minutes)</span>
          <input type="number" min={5} max={240} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 30)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as "video" | "phone" | "in_person")} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="video">Video</option>
            <option value="phone">Phone</option>
            <option value="in_person">In person</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Doctor name</span>
          <input type="text" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. Jón Jónsson" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Location (in-person)</span>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lifeline HQ, Reykjavík" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Meeting link (video/phone)</span>
          <input type="text" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://zoom.us/j/…" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Notes (shown to employee)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
      </div>
      {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50">
          {saving ? "Saving…" : "Add slot"}
        </button>
      </div>
    </div>
  );
}

function BulkAddForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<"video" | "phone" | "in_person">("video");
  const [doctorName, setDoctorName] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const preview = useMemo(() => {
    if (!date || !startTime || !endTime || duration <= 0) return [];
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    const out: string[] = [];
    for (let t = start.getTime(); t + duration * 60_000 <= end.getTime(); t += duration * 60_000) {
      out.push(new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }));
    }
    return out;
  }, [date, startTime, endTime, duration]);

  async function save() {
    if (!date || !startTime || !endTime) { setErr("Pick a date, start and end time."); return; }
    if (preview.length === 0) { setErr("No slots in this window."); return; }
    setSaving(true);
    setErr("");
    const start = new Date(`${date}T${startTime}:00`);
    const rows = [] as Array<Record<string, unknown>>;
    for (let i = 0; i < preview.length; i++) {
      const t = new Date(start.getTime() + i * duration * 60_000);
      rows.push({
        slot_at: t.toISOString(),
        duration_minutes: duration,
        mode,
        doctor_name: doctorName.trim() || null,
        location: location.trim() || null,
        meeting_link: meetingLink.trim() || null,
      });
    }
    const { error } = await supabase.from("doctor_slots").insert(rows);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-blue-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Bulk add — a block of slots</h2>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Start</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">End</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Slot length (minutes)</span>
          <input type="number" min={5} max={240} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 30)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as "video" | "phone" | "in_person")} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="video">Video</option>
            <option value="phone">Phone</option>
            <option value="in_person">In person</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Doctor name</span>
          <input type="text" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Location (in-person)</span>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Meeting link (video/phone)</span>
          <input type="text" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
      </div>
      <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900">
        Will create <strong>{preview.length}</strong> slot{preview.length === 1 ? "" : "s"}:{" "}
        {preview.slice(0, 10).join(", ")}{preview.length > 10 ? "…" : ""}
      </div>
      {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
        <button onClick={save} disabled={saving || preview.length === 0} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50">
          {saving ? "Saving…" : `Create ${preview.length} slots`}
        </button>
      </div>
    </div>
  );
}
