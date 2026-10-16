"use client";

// A small form in a modal, in place of window.prompt().
//
// prompt() could not validate, could not show a busy state, and the money
// handlers behind it stripped every non-digit ("12,5" → 125). usePromptForm
// asks for one or more values, parses numbers the Icelandic way
// (parseIsNumber: "12.500", "12,5"), keeps the modal open while onSubmit
// runs, and shows the server's error inside the modal instead of closing
// over it.
//
//   const [promptNode, ask] = usePromptForm();
//   await ask({ title: "Upphæð", fields: [{ name: "amount", label: "Upphæð (kr.)", kind: "amount", initial: 12500 }],
//     onSubmit: async ({ amount }) => { const r = await save(amount); return r.ok ? undefined : r.error; } });
//   return <>{promptNode}…</>;

import { useCallback, useId, useState, type ReactNode } from "react";
import { Modal, Button, accountInput, accountLabel } from "@/app/components/account/ui";
import { parseIsNumber, formatIsNumber } from "@/lib/is-number";

export type PromptFieldKind = "amount" | "number" | "integer" | "text";

export interface PromptField {
  name: string;
  label: string;
  kind?: PromptFieldKind;
  initial?: string | number | null;
  hint?: ReactNode;
  /** Empty is allowed and comes through as null. Default false. */
  optional?: boolean;
  allowNegative?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
}

export type PromptValues = Record<string, string | number | null>;

export interface PromptOptions {
  title: string;
  description?: ReactNode;
  fields: PromptField[];
  submitLabel?: string;
  /** Runs with the modal still open and busy. Return an error message to
   *  keep it open and show the message; return nothing to close. */
  onSubmit?: (values: PromptValues) => Promise<string | void | undefined> | string | void | undefined;
}

type Pending = PromptOptions & { resolve: (v: PromptValues | null) => void };

function initialText(f: PromptField): string {
  if (f.initial == null) return "";
  if (typeof f.initial === "number") return f.kind === "text" ? String(f.initial) : formatIsNumber(f.initial);
  return f.initial;
}

function PromptModal({ p, onDone }: { p: Pending; onDone: (v: PromptValues | null) => void }) {
  const baseId = useId();
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(p.fields.map((f) => [f.name, initialText(f)])));
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const values: PromptValues = {};
    const errs: Record<string, string> = {};
    for (const f of p.fields) {
      const raw = (text[f.name] ?? "").trim();
      const kind = f.kind ?? "text";
      if (!raw) {
        if (f.optional) { values[f.name] = null; continue; }
        errs[f.name] = "Þarf að fylla út.";
        continue;
      }
      if (kind === "text") { values[f.name] = raw; continue; }
      const n = parseIsNumber(raw, { allowNegative: f.allowNegative, integer: kind === "integer" });
      if (n == null) {
        errs[f.name] = kind === "integer" ? "Sláðu inn heila tölu." : "Sláðu inn tölu, t.d. 12.500 eða 12,5.";
        continue;
      }
      if (f.min != null && n < f.min) { errs[f.name] = `Lægst ${formatIsNumber(f.min)}.`; continue; }
      if (f.max != null && n > f.max) { errs[f.name] = `Hæst ${formatIsNumber(f.max)}.`; continue; }
      values[f.name] = kind === "amount" ? Math.round(n) : n;
    }
    setFieldErr(errs);
    if (Object.keys(errs).length) return;
    setErr(null);
    if (p.onSubmit) {
      setBusy(true);
      try {
        const e = await p.onSubmit(values);
        if (e) { setErr(e); return; }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Tókst ekki að vista. Reyndu aftur.");
        return;
      } finally {
        setBusy(false);
      }
    }
    onDone(values);
  };

  return (
    <Modal size="sm" title={p.title} description={p.description} dismissable={!busy} onClose={() => onDone(null)}
      footer={<>
        <Button variant="secondary" disabled={busy} onClick={() => onDone(null)}>Hætta við</Button>
        <Button busy={busy} disabled={busy} onClick={() => void submit()}>{p.submitLabel ?? "Vista"}</Button>
      </>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }}>
        {p.fields.map((f, i) => {
          const id = `${baseId}-${f.name}`;
          const kind = f.kind ?? "text";
          return (
            <div key={f.name}>
              <label htmlFor={id} className={accountLabel}>{f.label}</label>
              <input id={id} data-autofocus={i === 0 ? true : undefined}
                inputMode={kind === "text" ? undefined : kind === "integer" ? "numeric" : "decimal"}
                autoComplete="off" disabled={busy} placeholder={f.placeholder}
                value={text[f.name] ?? ""} onChange={(e) => setText((t) => ({ ...t, [f.name]: e.target.value }))}
                aria-invalid={fieldErr[f.name] ? true : undefined}
                aria-describedby={fieldErr[f.name] || f.hint ? `${id}-d` : undefined}
                className={`${accountInput} mt-1`} />
              {(fieldErr[f.name] || f.hint) && (
                <p id={`${id}-d`} className={`mt-1 text-xs ${fieldErr[f.name] ? "text-red-700" : "text-hc-ink-3"}`}>{fieldErr[f.name] || f.hint}</p>
              )}
            </div>
          );
        })}
        {err && <p role="alert" className="rounded-hc-element bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{err}</p>}
        {/* Enter submits. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

/** Returns the modal node to render and ask(), which resolves with the
 *  parsed values, or null when cancelled. */
export function usePromptForm(): [ReactNode, (o: PromptOptions) => Promise<PromptValues | null>] {
  const [pending, setPending] = useState<Pending | null>(null);
  const ask = useCallback((o: PromptOptions) => new Promise<PromptValues | null>((resolve) => setPending({ ...o, resolve })), []);
  const node = pending ? (
    <PromptModal key={pending.title} p={pending} onDone={(v) => { pending.resolve(v); setPending(null); }} />
  ) : null;
  return [node, ask];
}
