"use client";

// Niðurstöður — the values from the blood panel and the measurement station,
// recorded in the workstation so the nurse can see them while working.
//
// Each marker is a row in the reference book (hc_knowledge), so a typed value
// is flagged against Lifeline's own bands for that client's sex right away,
// and "Fletta upp" opens the entry behind it. The formal record stays in
// Medalia — this is the working copy, and the doctor confirms the report.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, FileUp, Loader2 } from "lucide-react";
import {
  CATEGORY_IS, TONE_IS, bandForValue, bandRangeText, bandsFor,
  type KnowledgeEntry,
} from "@/lib/hc/knowledge";
import KnowledgeSearch from "./KnowledgeSearch";
import { sexOf } from "@/lib/hc/sex";

export { sexOf };

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/** One value the AI read out of an uploaded report. */
export interface ImportedValue {
  slug: string | null;
  code: string;
  label: string;
  value: number;
  unit: string;
  confidence: "high" | "medium" | "low";
  converted_from?: string;
}

export interface HcResult {
  marker: string;
  value: number;
  unit: string | null;
  measured_at: string | null;
  source: string;
  note: string | null;
  entered_by: string | null;
  updated_at: string;
}

const TONE_PILL: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  watch: "bg-amber-50 text-amber-800 ring-amber-200",
  high: "bg-red-50 text-red-700 ring-red-200",
  low: "bg-blue-50 text-blue-700 ring-blue-200",
};

const today = () => new Date().toISOString().slice(0, 10);

/** Sex-specific bands with no sex on file: we must not pick one and pretend. */
const sexUnknown = (e: KnowledgeEntry, sex: "m" | "f" | null) => !sex && e.bands.some((b) => b.sex);

export default function ResultsCard({ api, journeyId, sex, results, onSaved, reportShown }: {
  /** The full report is already rendered above, so listing every value here
   *  again just repeats it — a second "Niðurstöður" heading under the first. */
  reportShown?: boolean;
  api: Api;
  journeyId: string;
  sex: "m" | "f" | null;
  results: HcResult[];
  onSaved?: () => void;
}) {
  const [entries, setEntries] = useState<KnowledgeEntry[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [date, setDate] = useState<string>(results.find((r) => r.measured_at)?.measured_at ?? today());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [lookup, setLookup] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [found, setFound] = useState<ImportedValue[] | null>(null);
  const [foundDate, setFoundDate] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [take, setTake] = useState<Record<number, boolean>>({});
  // Held only so the nurse can agree to send a file we could not read here.
  const [pending, setPending] = useState<File[]>([]);
  const [needsConsent, setNeedsConsent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Read a Medalia PDF / lab printout / photos and show what was found. */
  const readReport = async (files: FileList | File[], allowAi = false) => {
    const list = Array.from(files).slice(0, 8);
    setReading(true); setMsg(""); setFound(null); setWarnings([]); setNeedsConsent(false);
    const fd = new FormData();
    for (const f of list) fd.append("files", f);
    if (allowAi) fd.append("allow_ai", "true");
    const r = await api(`/api/vinnustod/journeys/${journeyId}/import`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setReading(false);
    if (!r.ok) { setMsg(j.error || "Lesturinn mistókst."); return; }
    setPending(list);
    if (j.method === "needs-consent") { setWarnings(j.warnings ?? []); setNeedsConsent(true); return; }
    // A Lifeline report is stored whole on the server, so the surrounding
    // view has to reload to pick up the pillars and the lifestyle scores.
    if (j.method === "local") onSaved?.();
    const values: ImportedValue[] = j.values ?? [];
    setFound(values);
    setWarnings(j.warnings ?? []);
    setFoundDate(j.report?.date_iso ?? null);
    setTake(Object.fromEntries(values.map((v, i) => [i, v.confidence !== "low"])));
    if (j.report?.date_iso) setDate(j.report.date_iso);
    if (!values.length) setMsg("Engin gildi fundust í skránni.");
  };

  /** Write the ticked values onto the journey. */
  const saveImported = async () => {
    if (!found) return;
    setBusy(true); setMsg("");
    const values = found
      .filter((_, i) => take[i])
      .map((v) => ({ marker: v.slug ?? `x:${v.code}`, value: v.value, unit: v.unit, measured_at: foundDate ?? date, note: v.slug ? null : v.label }));
    const r = await api("/api/vinnustod/results", { method: "POST", body: JSON.stringify({ journey_id: journeyId, values }) });
    setBusy(false);
    if (!r.ok) { setMsg("Tókst ekki að vista."); return; }
    setFound(null); setMsg(`${values.length} gildi vistuð`);
    onSaved?.();
  };

  useEffect(() => {
    let live = true;
    api("/api/vinnustod/knowledge")
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((j) => { if (live) setEntries(j.entries ?? []); })
      .catch(() => { if (live) setEntries([]); });
    return () => { live = false; };
  }, [api]);

  // Markers a nurse can record: reference entries with numeric bands.
  const markers = useMemo(
    () => (entries ?? []).filter((e) => (e.category === "blood" || e.category === "body") && e.bands.length > 0),
    [entries],
  );
  const byMarker = useMemo(() => new Map(results.map((r) => [r.marker, r])), [results]);

  const valueOf = useCallback(
    (slug: string): number | null => {
      const raw = draft[slug];
      if (raw !== undefined) return raw.trim() === "" ? null : Number(raw.replace(",", "."));
      const r = byMarker.get(slug);
      return r ? Number(r.value) : null;
    },
    [draft, byMarker],
  );

  const flagged = useMemo(() => {
    let n = 0;
    for (const e of markers) {
      const v = valueOf(e.slug);
      if (v == null || !Number.isFinite(v) || sexUnknown(e, sex)) continue;
      const b = bandForValue(e, v, sex);
      if (b && b.tone !== "good") n++;
    }
    return n;
  }, [markers, valueOf, sex]);

  const recorded = markers.filter((e) => { const v = valueOf(e.slug); return v != null && Number.isFinite(v); });
  // Values read out of a report that our reference book does not cover.
  const extras = useMemo(
    () => results.filter((r) => !markers.some((m) => m.slug === r.marker)),
    [results, markers],
  );

  const save = async () => {
    setBusy(true); setMsg("");
    const values = Object.entries(draft).map(([marker, raw]) => ({
      marker,
      value: raw.trim() === "" ? null : Number(raw.replace(",", ".")),
      unit: markers.find((m) => m.slug === marker)?.unit || null,
      measured_at: date || null,
    }));
    const r = await api("/api/vinnustod/results", { method: "POST", body: JSON.stringify({ journey_id: journeyId, values }) });
    setBusy(false);
    if (!r.ok) { setMsg("Tókst ekki að vista."); return; }
    setDraft({});
    setMsg("Vistað");
    setEditing(false);
    onSaved?.();
  };

  if (entries === null) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-slate-900">{reportShown ? "Skrá eða lesa gildi" : "Niðurstöður"}</h3>
        {recorded.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{recorded.length} skráð</span>
        )}
        {flagged > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">{flagged} utan viðmiða</span>
        )}
        <span className="flex-1" />
        {!editing && (
          <>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) void readReport(e.target.files); e.target.value = ""; }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={reading}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {reading ? "Les skýrsluna…" : "Lesa úr skýrslu"}
            </button>
            <button type="button" onClick={() => setEditing(true)}
              className="inline-flex min-h-9 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {recorded.length ? "Breyta gildum" : "Skrá gildi"}
            </button>
          </>
        )}
        <span className="text-xs text-slate-500">{msg}</span>
      </div>

      {needsConsent && (
        <div className="mt-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="font-bold text-amber-900">Við gátum ekki lesið þetta skjal hér</p>
          {warnings.map((w, i) => <p key={i} className="mt-1 text-sm leading-relaxed text-amber-900">{w}</p>)}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={reading || !pending.length} onClick={() => void readReport(pending, true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50">
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Senda í AI-lestur
            </button>
            <button type="button" onClick={() => { setNeedsConsent(false); setWarnings([]); setPending([]); }}
              className="text-sm font-semibold text-amber-900 hover:underline">Nei, ég skrái gildin sjálf</button>
          </div>
        </div>
      )}

      {found && found.length > 0 && (
        <div className="mt-3 rounded-2xl border border-slate-900/10 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">Úr skýrslunni{foundDate ? ` · ${foundDate}` : ""}</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{found.length} gildi fundust</span>
            <span className="flex-1" />
            <button type="button" onClick={() => setFound(null)} className="text-sm font-semibold text-slate-500 hover:underline">Hætta við</button>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Farðu yfir gildin áður en þau eru vistuð. Skráin sjálf er hvergi geymd.</p>

          <ul className="mt-2 divide-y divide-slate-200 rounded-xl bg-white">
            {found.map((v, i) => {
              const entry = markers.find((m) => m.slug === v.slug);
              const b = entry && !sexUnknown(entry, sex) ? bandForValue(entry, v.value, sex) : null;
              return (
                <li key={`${v.code}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <input type="checkbox" checked={!!take[i]} onChange={(e) => setTake({ ...take, [i]: e.target.checked })}
                    aria-label={`Vista ${entry?.title ?? v.label}`} className="h-4 w-4 accent-emerald-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{entry?.title ?? v.label}</span>
                    <span className="block text-xs text-slate-500">
                      {[!entry ? "ekki í uppflettiriti" : null,
                        v.converted_from ? `umreiknað úr ${v.converted_from}` : null,
                        v.confidence !== "high" ? `öryggi: ${v.confidence === "medium" ? "miðlungs" : "lágt"}` : null,
                      ].filter(Boolean).join(" · ") || v.label}
                    </span>
                  </span>
                  <span className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ${b ? TONE_PILL[b.tone] : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
                    {String(v.value).replace(".", ",")}{v.unit ? ` ${v.unit}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>

          {warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}

          <button type="button" onClick={saveImported} disabled={busy || !Object.values(take).some(Boolean)}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-40">
            <Check className="h-4 w-4" /> Vista valin gildi
          </button>
        </div>
      )}

      {recorded.length === 0 && !editing && !found && (
        <p className="mt-2 text-sm text-slate-500">
          Engin gildi skráð. Skráðu lykilgildin úr blóðprufunni og mælingunni — þau eru þá við höndina í viðtalinu og merkt við viðmið Lifeline.
        </p>
      )}

      {!editing && !reportShown && recorded.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {recorded.map((e) => {
            const v = valueOf(e.slug)!;
            const unknown = sexUnknown(e, sex);
            const b = unknown ? null : bandForValue(e, v, sex);
            return (
              <li key={e.slug} className="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-slate-100">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{e.title}</span>
                  <span className="block text-xs text-slate-500">
                    {unknown
                      ? "Kynjaskipt viðmið — kyn vantar í skrá"
                      : b ? `${b.label.replace(/\s*\((karlar|konur)\)$/i, "")} · ${bandRangeText(b, e.unit)}` : "utan skilgreindra bila"}
                  </span>
                </span>
                <span className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ${b ? TONE_PILL[b.tone] : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
                  {String(v).replace(".", ",")}{e.unit ? ` ${e.unit}` : ""}
                </span>
                <button type="button" onClick={() => setLookup(`${e.title} ${v}`)} title={`Fletta upp ${e.title}`}
                  aria-label={`Fletta upp ${e.title}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <BookOpen className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!editing && !reportShown && extras.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Önnur gildi úr skýrslunni</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {extras.map((r) => (
              <li key={r.marker} className="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-slate-100">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{r.note || r.marker.replace(/^x:/, "")}</span>
                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-bold tabular-nums text-slate-700 ring-1 ring-slate-200">
                  {String(r.value).replace(".", ",")}{r.unit ? ` ${r.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-slate-400">Ekki í uppflettiritinu — engin viðmið reiknuð. Bættu við færslu í /admin/knowledge ef þetta á að flaggast.</p>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Mælt
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>

          {(["blood", "body"] as const).map((cat) => {
            const group = markers.filter((m) => m.category === cat);
            if (!group.length) return null;
            return (
              <div key={cat}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">{CATEGORY_IS[cat]}</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {group.map((e) => {
                    const raw = draft[e.slug] ?? (byMarker.get(e.slug) ? String(byMarker.get(e.slug)!.value) : "");
                    const v = raw.trim() === "" ? null : Number(raw.replace(",", "."));
                    const unknown = sexUnknown(e, sex);
                    const b = v != null && Number.isFinite(v) && !unknown ? bandForValue(e, v, sex) : null;
                    const ranges = bandsFor(e, sex).filter((x) => x.tone === "good").map((x) => bandRangeText(x, null)).join(" / ");
                    return (
                      <li key={e.slug} className="flex items-center gap-2">
                        <label className="min-w-0 flex-1 text-sm text-slate-700" htmlFor={`res-${e.slug}`}>
                          <span className="block truncate font-medium">{e.title}</span>
                          <span className="block text-[11px] text-slate-400">
                            {unknown ? "Kjörsvið er kynjaskipt" : `Kjörsvið ${ranges}${e.unit ? ` ${e.unit}` : ""}`}
                          </span>
                        </label>
                        <input
                          id={`res-${e.slug}`} inputMode="decimal" value={raw}
                          onChange={(ev) => setDraft({ ...draft, [e.slug]: ev.target.value })}
                          placeholder="—"
                          className={`w-24 rounded-lg border px-2 py-1.5 text-right text-sm tabular-nums ${b && b.tone !== "good" ? "border-amber-300 bg-amber-50" : "border-slate-300"}`}
                        />
                        <span className="w-20 shrink-0 text-[11px] text-slate-500">{b ? TONE_IS[b.tone] : unknown && v != null ? "kyn vantar" : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={save} disabled={busy}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-40">
              <Check className="h-4 w-4" /> {busy ? "Vista…" : "Vista gildi"}
            </button>
            <button type="button" onClick={() => { setDraft({}); setEditing(false); setMsg(""); }}
              className="min-h-10 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Hætta við</button>
            <span className="text-xs text-slate-500">Skráð gildi sjást aðeins í vinnustöðinni og stjórnborði — sjúkraskráin er í Medalia.</span>
          </div>
        </div>
      )}

      <KnowledgeSearch api={api} open={lookup !== null} initialQuery={lookup ?? ""} onClose={() => setLookup(null)} />
    </section>
  );
}
