"use client";

// Four-digit keypad. Works with touch and keyboard. Ported from the
// Fjarlækningar HSU PinPad.

import { useEffect, useRef } from "react";
import { Delete } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function PinPad({ value, onChange, onComplete, disabled, error, accent, label }: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  error?: boolean;
  /** A colour for the filled dots; defaults to the hc brand-dark token. */
  accent?: string;
  /** What the dots stand for, read by screen readers. */
  label?: string;
}) {
  const { t } = useI18n();
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
      <div className="flex justify-center gap-4" role="status" aria-label={`${label ? `${label}: ` : ""}${value.length} af 4 tölustöfum`}>
        {[0, 1, 2, 3].map((i) => {
          const filled = i < value.length;
          const tone = !filled ? "border-hc-border" : error ? "border-hc-bad-ink bg-hc-bad-ink" : accent ? "" : "border-hc-brand-dark bg-hc-brand-dark";
          return (
            <span
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition ${tone}`}
              style={filled && !error && accent ? { borderColor: accent, background: accent } : undefined}
            />
          );
        })}
      </div>
      <div className="mx-auto mt-6 grid max-w-[260px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((k, i) =>
          k === "" ? <span key={i} /> : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              disabled={disabled}
              aria-label={k === "back" ? t("comp.pin.delete", "Eyða") : k}
              className="flex h-16 items-center justify-center rounded-2xl bg-hc-surface text-2xl font-semibold text-hc-ink-2 shadow-sm ring-1 ring-hc-border transition hover:bg-hc-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand-dark active:scale-95 active:bg-hc-sunken-2 disabled:opacity-50"
            >
              {k === "back" ? <Delete className="h-6 w-6" aria-hidden /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
