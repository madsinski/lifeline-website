"use client";

// One modal for the account pages, and the confirm/alert dialogs built on
// it. Four hand-rolled overlays and sixteen native confirm()/alert() calls
// (which cannot be styled, translated by the browser, or read well on a
// phone) are replaced by these.
//
// useDialog() works anywhere: inside <DialogProvider> it shows the styled
// dialog; outside one (BillingPanel on the business pages, for instance) it
// falls back to the native prompt so nothing silently stops asking.

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button, type ButtonVariant } from "./Button";

/** Open modals, innermost last: only the top one answers Escape and Tab
 *  (a confirm can open over a picker). */
const stack: symbol[] = [];

export function Modal({ title, description, onClose, children, footer, size = "md", closeLabel = "Loka", dismissable = true }: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeLabel?: string;
  /** false while something is saving: Escape and the backdrop do nothing. */
  dismissable?: boolean;
}) {
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const dismissRef = useRef(dismissable);
  useEffect(() => { closeRef.current = onClose; dismissRef.current = dismissable; });

  useEffect(() => {
    const me = Symbol("modal");
    stack.push(me);
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus what asks for it, otherwise the panel itself — not the first
    // input, which on a phone would throw the keyboard up over the choices.
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]");
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === "Escape" && dismissRef.current) { e.stopPropagation(); closeRef.current(); }
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(me), 1);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, []);

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-hc-ink/45 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && dismissable) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} tabIndex={-1}
        className={`flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-t-hc-hero bg-hc-surface shadow-hc-overlay outline-none sm:rounded-hc-hero`}>
        <div className="flex items-start gap-3 border-b border-hc-hairline px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold text-hc-ink">{title}</h2>
            {description && <div id={descId} className="mt-1 text-sm leading-relaxed text-hc-ink-2">{description}</div>}
          </div>
          {dismissable && (
            <button type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel}
              className="-mr-1 shrink-0 rounded-md p-1.5 text-hc-ink-3 hover:bg-hc-sunken-2 hover:text-hc-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        {children !== undefined && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hc-hairline bg-hc-sunken px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

export function ConfirmDialog({ title, body, confirmLabel = "Staðfesta", cancelLabel = "Hætta við", tone = "default", onResult, alertOnly = false }: ConfirmOptions & {
  onResult: (ok: boolean) => void;
  alertOnly?: boolean;
}) {
  const variant: ButtonVariant = tone === "danger" ? "danger" : "primary";
  return (
    <Modal size="sm" title={title} onClose={() => onResult(false)} closeLabel={cancelLabel}
      footer={<>
        {/* Focus starts on the safe choice when the action is destructive. */}
        {!alertOnly && <Button variant="secondary" data-autofocus={tone === "danger" ? true : undefined} onClick={() => onResult(false)}>{cancelLabel}</Button>}
        <Button variant={variant} data-autofocus={tone === "danger" && !alertOnly ? undefined : true} onClick={() => onResult(true)}>{alertOnly ? (confirmLabel === "Staðfesta" ? "Í lagi" : confirmLabel) : confirmLabel}</Button>
      </>}>
      {body ? <div className="text-sm leading-relaxed text-hc-ink-2">{body}</div> : undefined}
    </Modal>
  );
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  alert: (o: Omit<ConfirmOptions, "cancelLabel">) => Promise<void>;
}

const plain = (o: { title: string; body?: ReactNode }) => [o.title, typeof o.body === "string" ? o.body : ""].filter(Boolean).join("\n\n");

const DialogContext = createContext<DialogApi>({
  confirm: async (o) => (typeof window !== "undefined" ? window.confirm(plain(o)) : false),
  alert: async (o) => { if (typeof window !== "undefined") window.alert(plain(o)); },
});

export function useDialog(): DialogApi {
  return useContext(DialogContext);
}

type Pending = (ConfirmOptions & { alertOnly: boolean; resolve: (ok: boolean) => void }) | null;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, alertOnly: false, resolve })), []);
  const alert = useCallback((o: Omit<ConfirmOptions, "cancelLabel">) => new Promise<void>((resolve) => setPending({ ...o, alertOnly: true, resolve: () => resolve() })), []);
  const api = useMemo<DialogApi>(() => ({ confirm, alert }), [confirm, alert]);
  return (
    <DialogContext.Provider value={api}>
      {children}
      {pending && (
        <ConfirmDialog {...pending} onResult={(ok) => { pending.resolve(ok); setPending(null); }} />
      )}
    </DialogContext.Provider>
  );
}
