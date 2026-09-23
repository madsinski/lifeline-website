"use client";

// "Fletta upp" — the nurse's reference book, one keystroke away (Ctrl/⌘+K).
//
// Type a topic ("vöðvamassi", "koffín") or a topic and a value ("insúlín 18")
// and the answer comes back with the band that value falls into. The whole
// corpus is fetched once and searched in the browser, so it answers while the
// nurse is still typing — mid-consultation, that matters more than freshness.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  CATEGORY_IS, TONE_CLASS, TONE_IS, bandForValue, bandRangeText, bandsFor, parseValue, searchKnowledge,
  type KnowledgeEntry,
} from "@/lib/hc/knowledge";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type Sex = "m" | "f" | null;

export default function KnowledgeSearch({ api, open, onClose, initialQuery = "" }: {
  api: Api; open: boolean; onClose: () => void;
  /** Prefill, e.g. "Insúlín 18" when opened from a recorded value. */
  initialQuery?: string;
}) {
  const [entries, setEntries] = useState<KnowledgeEntry[] | null>(null);
  const [q, setQ] = useState(initialQuery);
  const [sex, setSex] = useState<Sex>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || entries) return;
    let live = true;
    api("/api/vinnustod/knowledge")
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((j) => { if (live) setEntries(j.entries ?? []); })
      .catch(() => { if (live) setEntries([]); });
    return () => { live = false; };
  }, [open, entries, api]);

  // Opening with a prefill replaces whatever was typed last time.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { setQ(initialQuery); setPicked(null); }, 0);
    return () => clearTimeout(t);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [open, onClose]);

  const value = useMemo(() => parseValue(q), [q]);
  const results = useMemo(() => (entries ? searchKnowledge(entries, q) : []), [entries, q]);
  const current = picked ? results.find((e) => e.slug === picked) ?? entries?.find((e) => e.slug === picked) ?? null : results[0] ?? null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Fletta upp" onClick={onClose}>
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[86vh] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 p-3 sm:p-4">
          <Search className="ml-1 h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef} value={q}
            onChange={(e) => { setQ(e.target.value); setPicked(null); }}
            placeholder="Leita — t.d. „insúlín 18“, „vöðvamassi“, „koffín“"
            aria-label="Leita í uppflettiriti"
            className="min-w-0 flex-1 border-0 py-2 text-base outline-none placeholder:text-slate-400"
          />
          <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="Kyn fyrir viðmið">
            {([["", "Bæði"], ["m", "Karl"], ["f", "Kona"]] as const).map(([k, l]) => (
              <button key={l} type="button" aria-pressed={sex === (k || null)} onClick={() => setSex((k || null) as Sex)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold ${sex === (k || null) ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Loka" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[240px_1fr]">
          <ul className="max-h-48 overflow-y-auto border-b border-slate-100 sm:max-h-none sm:border-b-0 sm:border-r">
            {entries === null && <li className="p-4 text-sm text-slate-500">Hleð…</li>}
            {entries !== null && results.length === 0 && <li className="p-4 text-sm text-slate-500">Ekkert fannst.</li>}
            {results.slice(0, 40).map((e) => (
              <li key={e.slug}>
                <button type="button" onClick={() => setPicked(e.slug)}
                  className={`w-full px-4 py-2.5 text-left hover:bg-slate-50 ${current?.slug === e.slug ? "bg-emerald-50" : ""}`}>
                  <span className="block text-sm font-semibold text-slate-900">{e.title}</span>
                  <span className="block text-xs text-slate-500">{CATEGORY_IS[e.category]}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
            {current ? <Entry e={current} value={value} sex={sex} /> : (
              <div className="text-sm text-slate-500">
                <p className="font-semibold text-slate-700">Uppflettirit Lifeline</p>
                <p className="mt-1">Sláðu inn heiti á mælingu, gildi eða efni — t.d. „hba1c“, „insúlín 18“, „svefnlengd“ eða „tilvísun“.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Entry({ e, value, sex }: { e: KnowledgeEntry; value: number | null; sex: Sex }) {
  const bothSexes = !sex && e.bands.some((b) => b.sex);
  const hit = value != null ? bandForValue(e, value, sex) : null;
  const bands = bandsFor(e, sex);
  return (
    <article className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{CATEGORY_IS[e.category]}</p>
        <h2 className="text-xl font-bold text-slate-900">{e.title}{e.unit ? <span className="ml-2 text-sm font-medium text-slate-400">{e.unit}</span> : null}</h2>
        <p className="mt-1 text-slate-700">{e.summary}</p>
      </header>

      {value != null && bands.length > 0 && (bothSexes ? (
        // Kynjaskipt viðmið og ekkert kyn valið: svaraðu fyrir bæði.
        <div className="grid gap-2 sm:grid-cols-2">
          {([["m", "Karlar"], ["f", "Konur"]] as const).map(([k, label]) => {
            const b = bandForValue(e, value, k);
            return (
              <div key={k} className={`rounded-2xl px-4 py-3 ring-1 ${b ? TONE_CLASS[b.tone] : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
                <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
                <p className="text-sm font-semibold">
                  {value.toString().replace(".", ",")}{e.unit ? ` ${e.unit}` : ""} → {b ? `${b.label.replace(/\s*\((karlar|konur)\)$/i, "")} (${TONE_IS[b.tone]})` : "utan bila"}
                </p>
                {b?.note && <p className="mt-0.5 text-sm">{b.note}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`rounded-2xl px-4 py-3 ring-1 ${hit ? TONE_CLASS[hit.tone] : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
          <p className="text-sm font-semibold">
            {value.toString().replace(".", ",")}{e.unit ? ` ${e.unit}` : ""} → {hit ? `${hit.label} (${TONE_IS[hit.tone]})` : "utan skilgreindra bila"}
          </p>
          {hit?.note && <p className="mt-0.5 text-sm">{hit.note}</p>}
        </div>
      ))}

      {bands.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {bands.map((b, i) => (
              <tr key={i} className={`border-t border-slate-100 ${hit === b ? "font-semibold" : ""}`}>
                <td className="py-1.5 pr-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${b.tone === "good" ? "bg-emerald-500" : b.tone === "watch" ? "bg-amber-400" : b.tone === "high" ? "bg-red-500" : "bg-blue-400"}`} aria-hidden />
                  <span className="ml-2 text-slate-800">{b.label}</span>
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-700">{bandRangeText(b, e.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {e.body_md && (
        <div className="space-y-2 text-sm leading-relaxed text-slate-700">
          {e.body_md.split("\n\n").map((para, i) => (
            <p key={i} className="whitespace-pre-line">{renderBold(para)}</p>
          ))}
        </div>
      )}

      {e.sources.length > 0 && (
        <footer className="border-t border-slate-100 pt-3 text-xs text-slate-400">
          Heimildir: {e.sources.join(" · ")}
        </footer>
      )}
    </article>
  );
}

/** Minimal **bold** support — the entries are short and written by us. */
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>);
}

/** Ctrl/⌘+K anywhere in the workstation. */
export function useKnowledgeHotkey(onOpen: () => void) {
  const handler = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpen(); }
  }, [onOpen]);
  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
