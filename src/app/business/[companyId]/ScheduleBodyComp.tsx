"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

interface Props {
  companyId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function ScheduleBodyComp({ companyId, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("15:00");
  const [location, setLocation] = useState("");
  const [roomNotes, setRoomNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Minimum = 2 weeks from today (lead time for Lifeline staff logistics)
  const minDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!eventDate || !startTime || !endTime) {
      setError(t("b2b.sched_bc.fill_all", "Please fill in every field.")); return;
    }
    if (startTime >= endTime) {
      setError(t("b2b.sched_bc.bad_window", "End time must be after the start time.")); return;
    }
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/business/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        company_id: companyId,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        location,
        room_notes: roomNotes,
      }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) { setError(j.error || "Failed"); return; }
    if (j.recipients > 0) {
      alert(t("b2b.sched_bc.emailed",
        "Scheduled. Invite emails sent to {{sent}}/{{total}} employees.")
        .replace("{{sent}}", String(j.sent))
        .replace("{{total}}", String(j.recipients)));
    }
    onCreated();
  };

  // Compute slot count for preview
  const slotCount = (() => {
    if (!startTime || !endTime || startTime >= endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    return Math.floor(minutes / 5);
  })();
  const capacity = slotCount * 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">
            {t("b2b.sched_bc.title", "Schedule body-composition day")}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {t("b2b.sched_bc.subtitle",
              "Our Lifeline nurse will come to your office. Book at least 2 weeks ahead.")}
          </p>
        </div>

        <form onSubmit={save} className="p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t("b2b.sched_bc.date", "Date")}</span>
            <input
              type="date"
              value={eventDate}
              min={minDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
              className="input mt-1"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t("b2b.sched_bc.start", "Start")}</span>
              <input type="time" value={startTime} step={300} onChange={(e) => setStartTime(e.target.value)} required className="input mt-1" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t("b2b.sched_bc.end", "End")}</span>
              <input type="time" value={endTime} step={300} onChange={(e) => setEndTime(e.target.value)} required className="input mt-1" />
            </label>
          </div>

          {slotCount > 0 && (
            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
              {t("b2b.sched_bc.capacity",
                "This window creates {{slots}} 5-minute slots × 2 people/slot = up to {{capacity}} employees.")
                .replace("{{slots}}", String(slotCount))
                .replace("{{capacity}}", String(capacity))}
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t("b2b.sched_bc.location", "Office address")}</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Hafnarstræti 5, Reykjavík"
              className="input mt-1"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t("b2b.sched_bc.room", "Room details")}</span>
            <textarea
              value={roomNotes}
              onChange={(e) => setRoomNotes(e.target.value)}
              rows={2}
              placeholder="3rd floor, conference room 'Elding'. Code for door: 1234."
              className="input mt-1"
            />
          </label>

          <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-sm">
            <div className="font-semibold text-amber-900 mb-1">
              {t("b2b.sched_bc.req_title", "Before the day, please have ready:")}
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-900">
              <li>{t("b2b.sched_bc.req1", "A private room")}</li>
              <li>{t("b2b.sched_bc.req2", "A computer with two screens")}</li>
              <li>{t("b2b.sched_bc.req3", "An employee roster already added here")}</li>
              <li>{t("b2b.sched_bc.req4", "Quiet environment — each measurement is private")}</li>
            </ul>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
              {t("b2b.cancel", "Cancel")}
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t("b2b.saving", "Saving…") : t("b2b.sched_bc.save", "Schedule")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
