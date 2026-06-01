"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

// On-site measurement scheduling.
//
// Two modes:
//   • create — propose one OR several measurement days in a single
//     session (the nurse may need to come back for a large roster).
//     Each day has its own date + time window + lunch break.
//   • edit   — change the date / time / break of one already-proposed
//     day. Only available while it's still "requested" (the dashboard
//     hides the edit control once Lifeline approves it, because
//     employees start booking 5-minute slots from that point).

const SLOT_MIN = 5; // minutes per slot
const PER_SLOT = 2; // people measured per slot
// A typical full day (09:00–16:00 minus a lunch break) used only to
// suggest how many days a roster needs.
const TYPICAL_DAY_CAPACITY = 144; // 6h × 12 slots/h × 2 people

export interface EditableEvent {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  room_notes: string | null;
  break_start: string | null;
  break_end: string | null;
}

interface Props {
  companyId: string;
  /** Roster size, used to guide how many days to schedule. */
  employeeCount?: number;
  /** When set, the modal edits this one day instead of creating new ones. */
  editEvent?: EditableEvent | null;
  onClose: () => void;
  onCreated: () => void;
}

interface DayRow {
  key: number;
  date: string;
  start: string;
  end: string;
  lunch: boolean;
  breakStart: string;
  breakEnd: string;
}

let dayKeySeq = 1;
const newDay = (seed?: Partial<DayRow>): DayRow => ({
  key: dayKeySeq++,
  date: "",
  start: "09:00",
  end: "16:00",
  lunch: true,
  breakStart: "12:00",
  breakEnd: "13:00",
  ...seed,
});

// Bookable capacity of one day = slots (window minus break) × people/slot.
function dayCapacity(d: DayRow): number {
  if (!d.start || !d.end || d.start >= d.end) return 0;
  const mins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let usable = mins(d.end) - mins(d.start);
  if (d.lunch && d.breakStart && d.breakEnd && d.breakStart < d.breakEnd) {
    // Overlap of [breakStart,breakEnd) with [start,end)
    const ov = Math.max(0, Math.min(mins(d.end), mins(d.breakEnd)) - Math.max(mins(d.start), mins(d.breakStart)));
    usable -= ov;
  }
  if (usable <= 0) return 0;
  return Math.floor(usable / SLOT_MIN) * PER_SLOT;
}

export default function ScheduleBodyComp({ companyId, employeeCount = 0, editEvent = null, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const isEdit = !!editEvent;

  const [days, setDays] = useState<DayRow[]>(() => {
    if (editEvent) {
      return [newDay({
        date: editEvent.event_date,
        start: editEvent.start_time.slice(0, 5),
        end: editEvent.end_time.slice(0, 5),
        lunch: !!(editEvent.break_start && editEvent.break_end),
        breakStart: editEvent.break_start?.slice(0, 5) || "12:00",
        breakEnd: editEvent.break_end?.slice(0, 5) || "13:00",
      })];
    }
    return [newDay()];
  });
  const [location, setLocation] = useState(editEvent?.location || "");
  const [roomNotes, setRoomNotes] = useState(editEvent?.room_notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Minimum = 2 weeks from today (lead time for Lifeline staff logistics).
  // Lazy state initializer so the impure Date.now() call runs once, not
  // on every render (satisfies react-hooks/purity).
  const [minDate] = useState(() => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));

  const patchDay = (key: number, patch: Partial<DayRow>) =>
    setDays((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const addDay = () => setDays((ds) => [...ds, newDay()]);
  const removeDay = (key: number) => setDays((ds) => (ds.length > 1 ? ds.filter((d) => d.key !== key) : ds));

  const totalCapacity = days.reduce((s, d) => s + dayCapacity(d), 0);
  const recommendedDays = Math.max(1, Math.ceil((employeeCount || 0) / TYPICAL_DAY_CAPACITY));
  const covered = employeeCount === 0 || totalCapacity >= employeeCount;

  const validate = (): string | null => {
    for (const d of days) {
      if (!d.date || !d.start || !d.end) return t("b2b.sched_bc.fill_all", "Please fill in date, start and end for every day.");
      if (d.start >= d.end) return t("b2b.sched_bc.bad_window", "End time must be after the start time.");
      if (d.lunch) {
        if (d.breakStart >= d.breakEnd) return t("b2b.sched_bc.bad_break", "Lunch break end must be after its start.");
        if (d.breakStart < d.start || d.breakEnd > d.end) return t("b2b.sched_bc.break_outside", "The lunch break must fall inside the day's time window.");
      }
    }
    return null;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) { setError(v); return; }

    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

    if (isEdit && editEvent) {
      const d = days[0];
      const res = await fetch(`/api/business/events/${editEvent.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          event_date: d.date,
          start_time: d.start,
          end_time: d.end,
          break_start: d.lunch ? d.breakStart : null,
          break_end: d.lunch ? d.breakEnd : null,
          location,
          room_notes: roomNotes,
        }),
      });
      const j = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) { setError(j.error || "Failed"); return; }
      onCreated();
      return;
    }

    const res = await fetch("/api/business/events", {
      method: "POST",
      headers,
      body: JSON.stringify({
        company_id: companyId,
        location,
        room_notes: roomNotes,
        days: days.map((d) => ({
          event_date: d.date,
          start_time: d.start,
          end_time: d.end,
          break_start: d.lunch ? d.breakStart : null,
          break_end: d.lunch ? d.breakEnd : null,
        })),
      }),
    });
    const j = await res.json().catch(() => ({}));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">
            {isEdit
              ? t("b2b.sched_bc.title_edit", "Edit measurement day")
              : t("b2b.sched_bc.title", "Schedule measurement day")}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {t("b2b.sched_bc.subtitle",
              "Blood pressure and body composition measurements on-site. Our nurse comes to your office — book at least 2 weeks ahead.")}
          </p>
        </div>

        <form onSubmit={save} className="p-6 space-y-4">
          {/* Roster-driven guidance (create mode only) */}
          {!isEdit && employeeCount > 0 && (
            <div className="text-xs text-gray-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
              {t("b2b.sched_bc.guide",
                "You have {{n}} employees on the roster. Plan for about {{d}} measurement day(s) — a typical 09:00–16:00 day (with a lunch break) covers ~{{cap}} people.")
                .replace("{{n}}", String(employeeCount))
                .replace("{{d}}", String(recommendedDays))
                .replace("{{cap}}", String(TYPICAL_DAY_CAPACITY))}
            </div>
          )}

          {/* Day rows */}
          <div className="space-y-4">
            {days.map((d, i) => (
              <div key={d.key} className="rounded-xl border border-gray-200 p-4 space-y-3">
                {!isEdit && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">
                      {t("b2b.sched_bc.day_n", "Day {{n}}").replace("{{n}}", String(i + 1))}
                    </span>
                    {days.length > 1 && (
                      <button type="button" onClick={() => removeDay(d.key)}
                        className="text-xs text-red-600 hover:underline">
                        {t("b2b.sched_bc.remove_day", "Remove")}
                      </button>
                    )}
                  </div>
                )}

                <label className="block">
                  <span className="text-sm font-medium text-gray-700">{t("b2b.sched_bc.date", "Date")}</span>
                  <input
                    type="date"
                    value={d.date}
                    min={minDate}
                    onChange={(e) => patchDay(d.key, { date: e.target.value })}
                    required
                    className="input mt-1"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">{t("b2b.sched_bc.start", "Start")}</span>
                    <input type="time" value={d.start} step={SLOT_MIN * 60}
                      onChange={(e) => patchDay(d.key, { start: e.target.value })} required className="input mt-1" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">{t("b2b.sched_bc.end", "End")}</span>
                    <input type="time" value={d.end} step={SLOT_MIN * 60}
                      onChange={(e) => patchDay(d.key, { end: e.target.value })} required className="input mt-1" />
                  </label>
                </div>

                {/* Lunch break */}
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={d.lunch}
                      onChange={(e) => patchDay(d.key, { lunch: e.target.checked })} className="rounded" />
                    {t("b2b.sched_bc.lunch", "Lunch break (no measurements)")}
                  </label>
                  {d.lunch && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <label className="block">
                        <span className="text-xs text-gray-600">{t("b2b.sched_bc.break_start", "Break start")}</span>
                        <input type="time" value={d.breakStart} step={SLOT_MIN * 60}
                          onChange={(e) => patchDay(d.key, { breakStart: e.target.value })} className="input mt-1" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-gray-600">{t("b2b.sched_bc.break_end", "Break end")}</span>
                        <input type="time" value={d.breakEnd} step={SLOT_MIN * 60}
                          onChange={(e) => patchDay(d.key, { breakEnd: e.target.value })} className="input mt-1" />
                      </label>
                    </div>
                  )}
                </div>

                {dayCapacity(d) > 0 && (
                  <div className="text-xs text-gray-500">
                    {t("b2b.sched_bc.day_cap", "Covers up to {{cap}} employees.")
                      .replace("{{cap}}", String(dayCapacity(d)))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!isEdit && (
            <button type="button" onClick={addDay}
              className="text-sm text-blue-600 hover:underline">
              + {t("b2b.sched_bc.add_day", "Add another day")}
            </button>
          )}

          {/* Capacity tracker */}
          {!isEdit && totalCapacity > 0 && (
            <div className={`text-xs rounded-lg p-3 border ${covered
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-amber-50 border-amber-100 text-amber-900"}`}>
              {employeeCount > 0
                ? covered
                  ? t("b2b.sched_bc.cap_ok", "These {{m}} day(s) cover up to {{cap}} employees — enough for your roster of {{n}}.")
                      .replace("{{m}}", String(days.length)).replace("{{cap}}", String(totalCapacity)).replace("{{n}}", String(employeeCount))
                  : t("b2b.sched_bc.cap_short", "These {{m}} day(s) cover up to {{cap}}, but you have {{n}} employees. Add another day or widen a window.")
                      .replace("{{m}}", String(days.length)).replace("{{cap}}", String(totalCapacity)).replace("{{n}}", String(employeeCount))
                : t("b2b.sched_bc.cap_total", "These {{m}} day(s) cover up to {{cap}} employees.")
                    .replace("{{m}}", String(days.length)).replace("{{cap}}", String(totalCapacity))}
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
              <li>{t("b2b.sched_bc.req2", "One computer screen")}</li>
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
              {saving
                ? t("b2b.saving", "Saving…")
                : isEdit
                  ? t("b2b.sched_bc.save_edit", "Save changes")
                  : t("b2b.sched_bc.save", "Schedule")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
