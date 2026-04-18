"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

interface ExistingDay { id: string; day: string; notes: string | null }

interface Props {
  companyId: string;
  existing: ExistingDay[];
  onClose: () => void;
  onCreated: () => void;
}

export default function ScheduleBloodTests({ companyId, existing, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Show 12 upcoming weekdays (skip weekends), starting 7 days out
  const today = new Date();
  const candidates: string[] = [];
  let d = new Date(today.getTime() + 7 * 86_400_000);
  while (candidates.length < 20) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) candidates.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86_400_000);
  }

  const existingDays = new Set(existing.map((e) => e.day));

  const toggle = (day: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected.size) { setError(t("b2b.sched_bt.need_one", "Pick at least one day.")); return; }
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/business/blood-test-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        company_id: companyId,
        days: Array.from(selected),
        notes: notes.trim() || null,
      }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) { setError(j.error || "Failed"); return; }
    if (j.recipients > 0) {
      alert(t("b2b.sched_bt.emailed",
        "Days saved. Notification sent to {{sent}}/{{total}} employees.")
        .replace("{{sent}}", String(j.sent))
        .replace("{{total}}", String(j.recipients)));
    }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold">{t("b2b.sched_bt.title", "Pick blood-test days")}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t("b2b.sched_bt.subtitle",
              "Select the weekdays you'll let your employees visit a Sameind station for their blood test. Each station has its own opening hours — they are shown in the employee's account.")}
          </p>
        </div>

        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {candidates.map((day) => {
              const isExisting = existingDays.has(day);
              const isSelected = selected.has(day);
              const d = new Date(day + "T00:00:00");
              const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isExisting}
                  onClick={() => toggle(day)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    isExisting
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                      : isSelected
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  {isExisting && <div className="text-xs mt-0.5">{t("b2b.sched_bt.already", "already added")}</div>}
                </button>
              );
            })}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t("b2b.sched_bt.notes", "Notes for employees (optional)")}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Closest station: Ármúli, Reykjavík."
              className="input mt-1"
            />
          </label>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900">
            {t("b2b.sched_bt.info",
              "Your employees will receive the booking link from our patient-portal partner Medalia and can pick a time window between 08:00 and 12:00 on the days you allow.")}
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
              {t("b2b.cancel", "Cancel")}
            </button>
            <button type="submit" disabled={saving || !selected.size} className="btn-primary">
              {saving
                ? t("b2b.saving", "Saving…")
                : t("b2b.sched_bt.save_n", "Save {{n}} day(s)").replace("{{n}}", String(selected.size))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
