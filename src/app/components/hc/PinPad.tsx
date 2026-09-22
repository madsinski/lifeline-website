"use client";

// Four-digit keypad. Works with touch and keyboard. Ported from the
// Fjarlækningar HSU PinPad.

import { useEffect, useRef } from "react";

export default function PinPad({ value, onChange, onComplete, disabled, error, accent = "#10B981" }: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  error?: boolean;
  accent?: string;
}) {
  // Latest values in a ref: the key listener is registered once and must not
  // call a stale onComplete.
  const latest = useRef({ value, onChange, onComplete, disabled });
  useEffect(() => { latest.current = { value, onChange, onComplete, disabled }; });

  const press = (d: string) => {
    const { value: cur, onChange: change, onComplete: complete, disabled: off } = latest.current;
    if (off) return;
    if (d === "back") { change(cur.slice(0, -1)); return; }
    if (cur.length >= 4) return;
    const next = cur + d;
    latest.current.value = next;
    change(next);
    if (next.length === 4) complete?.(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="select-none">
      <div className="flex justify-center gap-4" role="status" aria-label={`${value.length} af 4 tölustöfum`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-4 w-4 rounded-full border-2 transition"
            style={
              i < value.length
                ? { borderColor: error ? "#EF4444" : accent, background: error ? "#EF4444" : accent }
                : { borderColor: "#CBD5E1" }
            }
          />
        ))}
      </div>
      <div className="mx-auto mt-6 grid max-w-[260px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((k, i) =>
          k === "" ? <span key={i} /> : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              disabled={disabled}
              aria-label={k === "back" ? "Eyða" : k}
              className="flex h-16 items-center justify-center rounded-2xl bg-white text-2xl font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition active:scale-95 active:bg-slate-100 disabled:opacity-50"
            >
              {k === "back" ? "⌫" : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
