"use client";

// One toast for the participant app.
//
// Saves in the app used to fail silently: a set that did not store, a meal
// that did not log, a reorder that snapped back without a word. The toast is
// where every one of those failures now says so, and where a destructive tap
// offers its undo.
//
// It sits above the JourneyNav (--hc-dock-offset, which is 0 above sm where
// the nav is not docked) and above the on-screen keyboard when one is up —
// iOS does not resize the viewport for the keyboard, so `bottom` alone would
// put the toast behind it.
//
// Without a provider show() is a no-op that logs, so a component can call it
// from a page that has not mounted ToastProvider yet without crashing.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "@/lib/hc/use-keyboard";

export type ToastTone = "ok" | "bad";

export interface ToastOptions {
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  /** How long it stays up. Defaults to 4s, 7s when there is an action to reach. */
  ms?: number;
}

export interface ToastApi {
  show: (msg: string, opts?: ToastOptions) => void;
}

interface ToastItem extends ToastOptions {
  id: number;
  msg: string;
}

const ToastContext = createContext<ToastApi | null>(null);

const FALLBACK: ToastApi = {
  show: (msg) => {
    console.warn("[toast] no ToastProvider mounted:", msg);
  },
};

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? FALLBACK;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const keyboard = useKeyboard();

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setItem(null);
  }, []);

  const show = useCallback((msg: string, opts?: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    seq.current += 1;
    const next: ToastItem = { id: seq.current, msg, ...opts };
    setItem(next);
    const ms = opts?.ms ?? (opts?.action ? 7000 : 4000);
    timer.current = setTimeout(() => setItem((cur) => (cur?.id === next.id ? null : cur)), ms);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region is always mounted so screen readers announce the
          first toast too; only its content changes. */}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
        style={{
          bottom: keyboard.open
            ? `calc(${keyboard.inset}px + 12px)`
            : "calc(var(--hc-dock-offset) + 12px)",
        }}>
        {item && (
          <div
            key={item.id}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-hc-element px-4 py-2 text-sm font-medium text-white shadow-hc-raised ${
              item.tone === "bad" ? "bg-hc-bad-ink" : "bg-hc-ink"
            }`}>
            <p className="min-w-0 flex-1 py-1.5">{item.msg}</p>
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  const a = item.action;
                  dismiss();
                  a?.onClick();
                }}
                className="min-h-11 shrink-0 rounded-hc-element px-3 font-semibold text-white underline underline-offset-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                {item.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const SAVE_FAILED = "Vistaðist ekki – reyndu aftur";

/**
 * Run a save and say so when it fails.
 *
 * `run` returns the function's result, or undefined when it threw or came
 * back as a non-ok Response. Callers that need to know whether to close a
 * sheet can check for undefined (or the Response's ok).
 */
export function useSaveStatus() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, msgs?: { ok?: string; fail?: string }): Promise<T | undefined> => {
      setSaving(true);
      try {
        const out = await fn();
        if (typeof Response !== "undefined" && out instanceof Response && !out.ok) {
          toast.show(msgs?.fail ?? SAVE_FAILED, { tone: "bad" });
          return undefined;
        }
        if (msgs?.ok) toast.show(msgs.ok, { tone: "ok" });
        return out;
      } catch (err) {
        console.error("[save]", err);
        toast.show(msgs?.fail ?? SAVE_FAILED, { tone: "bad" });
        return undefined;
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  return { saving, run };
}
