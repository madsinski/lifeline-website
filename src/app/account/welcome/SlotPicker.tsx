"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

interface Slot {
  slot_at: string;
  booked_count: number;
  is_mine: boolean;
}

interface Event {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  room_notes: string | null;
  slot_minutes: number;
  slot_capacity: number;
}

interface Props {
  event: Event;
  onClose: () => void;
  onBooked: () => void;
}

export default function SlotPicker({ event, onClose, onBooked }: Props) {
  const { t } = useI18n();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc("list_event_slots", { p_event_id: event.id });
    if (err) setError(err.message);
    else setSlots((data || []) as Slot[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const book = async (slotAt: string) => {
    setSaving(slotAt);
    setError("");
    const { error: err } = await supabase.rpc("book_body_comp_slot", {
      p_event_id: event.id,
      p_slot_at: slotAt,
    });
    setSaving(null);
    if (err) {
      setError(
        err.message.includes("slot_full")
          ? t("b2b.welcome.slot.full", "That slot just filled up. Pick another.")
          : err.message.includes("forbidden")
            ? t("b2b.welcome.slot.forbidden", "You can only book slots at your own company's event.")
            : err.message,
      );
      load();
      return;
    }
    onBooked();
    load();
  };

  const cancel = async () => {
    setSaving("cancel");
    setError("");
    await supabase.rpc("cancel_body_comp_slot", { p_event_id: event.id });
    setSaving(null);
    onBooked();
    load();
  };

  const dateLabel = new Date(event.event_date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">{t("b2b.welcome.slot.title", "Pick your 5-minute slot")}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {dateLabel} · {event.start_time.slice(0, 5)}–{event.end_time.slice(0, 5)}
          </p>
          {event.location && <p className="text-xs text-gray-500 mt-0.5">{event.location}</p>}
          {event.room_notes && <p className="text-xs text-gray-500">{event.room_notes}</p>}
        </div>

        <div className="p-4">
          {loading && <div className="text-gray-500 text-sm p-4">{t("b2b.welcome.slot.loading", "Loading slots…")}</div>}
          {error && <div className="text-red-600 text-sm p-4">{error}</div>}
          {!loading && slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((s) => {
                const full = s.booked_count >= event.slot_capacity && !s.is_mine;
                const mine = s.is_mine;
                const time = new Date(s.slot_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
                return (
                  <button
                    key={s.slot_at}
                    onClick={() => book(s.slot_at)}
                    disabled={full || saving !== null}
                    className={`p-2 rounded-lg border text-center text-sm transition-colors ${
                      mine
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
                        : full
                          ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                          : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    <div className="font-mono">{time}</div>
                    <div className="text-[10px] mt-0.5">
                      {mine ? t("b2b.welcome.slot.mine", "Your slot ✓")
                        : full ? t("b2b.welcome.slot.full_short", "Full")
                        : t("b2b.welcome.slot.available", "{{n}}/{{cap}} booked").replace("{{n}}", String(s.booked_count)).replace("{{cap}}", String(event.slot_capacity))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {!loading && slots.length === 0 && !error && (
            <div className="text-gray-500 text-sm p-4">{t("b2b.welcome.slot.none", "No slots yet.")}</div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-2 sticky bottom-0 bg-white">
          {slots.some((s) => s.is_mine) ? (
            <button onClick={cancel} disabled={saving !== null} className="text-sm text-red-600 hover:underline disabled:opacity-50">
              {t("b2b.welcome.slot.cancel", "Cancel my booking")}
            </button>
          ) : <span />}
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
            {t("b2b.welcome.slot.close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
