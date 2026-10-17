"use client";

// The address, postcode first.
//
// A typed town is how "Vestmannaeyjar", "Vestmannaeyjum", "Vm" and "Eyjar"
// all end up in the same column, and coaching eligibility is decided from
// it. So the town is not typed at all: the postcode is, and the town is
// Pósturinn's own name for it (src/lib/is-postcodes.ts), shown as soon as
// three digits match. Somebody who does not know their postcode types the
// town in the finder underneath and picks from the codes that match.
//
// Two exports:
//   AddressFields  the controlled fields, for a form that saves them itself
//                  (ProfileForm, which posts them with the name and phone)
//   AddressForm    fields + their own save (PATCH /api/hc/profile), for any
//                  screen that wants to ask for the address inline — the
//                  guided setup, and whoever links to
//                  /app/uppsetning?skref=heimilisfang
//
// The server checks the postcode again and stores the official town, so
// this is help, not the guard.

import { useEffect, useId, useState } from "react";
import { Check, FileHeart, Loader2, MapPin } from "lucide-react";
import { placeForPostcode, postcodesForPlace } from "@/lib/is-postcodes";
import { splitAddress } from "@/lib/hc/address";
import { hcBtn, hcInput } from "./ui";
import { SAVE_FAILED, useToast } from "./Toast";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface AddressValue { street: string; postcode: string }

/**
 * Postcodes for a typed place. Pósturinn names many places in the dative
 * („Vestmannaeyjum“, „Selfossi“), so a nominative that does not match in
 * full is shortened a letter at a time until it does.
 */
function findPlace(q: string) {
  let t = q.trim();
  if (t.length < 2) return [];
  let found = postcodesForPlace(t, 8);
  while (!found.length && t.length > 4) {
    t = t.slice(0, -1);
    found = postcodesForPlace(t, 8);
  }
  return found;
}

const inputCls =(bad?: boolean) => `${bad ? hcInput.replace("border-hc-control", "border-hc-bad-ink") : hcInput} mt-1 min-h-11`;

export function AddressFields({ value, onChange, errors = {}, fromReport = false, disabled = false }: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  errors?: Partial<Record<"address" | "postcode", string>>;
  /** Prefilled from an uploaded report: says so, so it can be checked. */
  fromReport?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [finder, setFinder] = useState("");
  const [finderOpen, setFinderOpen] = useState(false);
  const code = value.postcode.trim();
  const place = /^\d{3}$/.test(code) ? placeForPostcode(code) : null;
  const unknown = /^\d{3}$/.test(code) && !place;
  const matches = findPlace(finder);

  return (
    <div className="space-y-3">
      {fromReport && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-hc-brand-surface px-3 py-1 text-xs font-semibold text-hc-brand-text">
          <FileHeart className="h-3.5 w-3.5" aria-hidden /> Úr skýrslunni þinni · athugaðu að það sé rétt
        </p>
      )}
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <label className="block text-sm" htmlFor={`${id}-pc`}>
          <span className="font-medium text-hc-ink-2">Póstnúmer</span>
          <input id={`${id}-pc`} value={value.postcode} disabled={disabled}
            onChange={(e) => onChange({ ...value, postcode: e.target.value.replace(/\D/g, "").slice(0, 3) })}
            inputMode="numeric" autoComplete="postal-code" maxLength={3} placeholder="000"
            aria-invalid={!!errors.postcode || unknown} aria-describedby={`${id}-place`}
            className={`${inputCls(!!errors.postcode || unknown)} tabular-nums`} />
        </label>
        <div className="text-sm">
          <span className="font-medium text-hc-ink-2">Staður</span>
          {/* Not an input: the place follows from the postcode and cannot be mistyped. */}
          <p id={`${id}-place`} aria-live="polite"
            className={`mt-1 flex min-h-11 items-center gap-1.5 rounded-hc-element px-3 ${
              place ? "bg-hc-brand-surface font-semibold text-hc-ink" : "bg-hc-sunken text-hc-ink-3"}`}>
            {place ? <><Check className="h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />{place}</>
              : unknown ? "Póstnúmerið er ekki til"
              : "Kemur af póstnúmerinu"}
          </p>
        </div>
      </div>
      {(errors.postcode || unknown) && (
        <p className="text-xs text-hc-bad-ink">{errors.postcode ?? "Athugaðu póstnúmerið, eða finndu það eftir staðnum hér fyrir neðan."}</p>
      )}

      {!finderOpen ? (
        <button type="button" onClick={() => setFinderOpen(true)} disabled={disabled}
          className="min-h-11 text-sm font-semibold text-hc-brand-text underline">
          Veistu ekki póstnúmerið? Finndu það eftir stað
        </button>
      ) : (
        <div className="rounded-hc-element bg-hc-sunken p-3">
          <label className="block text-sm" htmlFor={`${id}-find`}>
            <span className="font-medium text-hc-ink-2">Skrifaðu staðinn</span>
            <input id={`${id}-find`} value={finder} onChange={(e) => setFinder(e.target.value)}
              placeholder="t.d. Akureyri" autoComplete="off" className={inputCls()} />
          </label>
          {matches.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Póstnúmer sem passa">
              {matches.map((m) => (
                <li key={m.code}>
                  <button type="button"
                    onClick={() => { onChange({ ...value, postcode: m.code }); setFinderOpen(false); setFinder(""); }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hc-control bg-hc-surface px-3 text-sm text-hc-ink hover:bg-hc-brand-surface">
                    <span className="font-semibold tabular-nums">{m.code}</span> {m.place}
                    {m.kind === "box" && <span className="text-xs text-hc-ink-3">(pósthólf)</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {finder.trim().length >= 2 && matches.length === 0 && (
            <p className="mt-2 text-xs text-hc-ink-3">Enginn staður fannst. Prófaðu fyrstu stafina.</p>
          )}
        </div>
      )}

      <label className="block text-sm" htmlFor={`${id}-st`}>
        <span className="font-medium text-hc-ink-2">Gata og húsnúmer</span>
        <input id={`${id}-st`} value={value.street} disabled={disabled}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          autoComplete="street-address" placeholder="t.d. Heiðarvegur 5"
          aria-invalid={!!errors.address} className={inputCls(!!errors.address)} />
        {errors.address && <span className="mt-1 block text-xs text-hc-bad-ink">{errors.address}</span>}
      </label>
    </div>
  );
}

/**
 * The address with its own save, for any screen that asks for it inline.
 *
 * Loads what is on file (GET /api/hc/profile); `prefill` is used only when
 * nothing is, e.g. an address read from the person's uploaded report.
 */
export function AddressForm({ api, onSaved, prefill, submitLabel = "Vista heimilisfang" }: {
  api: Api;
  onSaved?: (a: { address: string; postcode: string; town: string | null }) => void;
  prefill?: string | null;
  submitLabel?: string;
}) {
  const [value, setValue] = useState<AddressValue | null>(null);
  const [fromReport, setFromReport] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"address" | "postcode", string>>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await api("/api/hc/profile").catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      const onFile: string | null = j?.profile?.address ?? null;
      const src = onFile || prefill || "";
      const parts = splitAddress(src);
      if (!alive) return;
      setFromReport(!onFile && !!prefill);
      setValue({ street: parts.street, postcode: parts.postcode });
      setSaved(!!onFile && !!parts.postcode);
    })();
    return () => { alive = false; };
  }, [api, prefill]);

  if (!value) return <div className="h-40 rounded-hc-element hc-shimmer" aria-busy="true" aria-label="Hleð" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErrors({});
    const r = await api("/api/hc/profile", {
      method: "PATCH", body: JSON.stringify({ address: value.street, postcode: value.postcode }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) {
      if (j.errors) setErrors(j.errors);
      toast.show(j.errors ? "Lagaðu það sem er merkt og vistaðu aftur" : SAVE_FAILED, { tone: "bad" });
      return;
    }
    setSaved(true);
    setFromReport(false);
    toast.show("Heimilisfangið er vistað", { tone: "ok" });
    onSaved?.({ address: j.address, postcode: j.postcode, town: j.town ?? null });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <AddressFields value={value} onChange={(v) => { setValue(v); setSaved(false); }} errors={errors} fromReport={fromReport} disabled={busy} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={hcBtn.cta}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MapPin className="h-4 w-4" aria-hidden />}
          {submitLabel}
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-hc-ok-ink"><Check className="h-4 w-4" aria-hidden /> Vistað</span>}
      </div>
    </form>
  );
}

export default AddressFields;
