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
import { badgeClass } from "./Badge";
import { hcBtn, hcCard, hcInput } from "./ui";
import { sexOf } from "@/lib/hc/sex";
import { SAVE_FAILED, useToast } from "./Toast";

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
  good: "bg-hc-ok-surface text-hc-ok-ink ring-hc-ok-ink/30",
  watch: "bg-hc-warn-surface text-hc-warn-ink ring-hc-warn-ink/30",
  high: "bg-hc-bad-surface text-hc-bad-ink ring-hc-bad-ink/30",
  low: "bg-hc-info-surface text-hc-info-ink ring-hc-info-ink/30",
};

const today = () => new Date().toISOString().slice(0, 10);

/** Sex-specific bands with no sex on file: we must not pick one and pretend. */
const sexUnknown = (e: KnowledgeEntry, sex: "m" | "f" | null) => !sex && e.bands.some((b) => b.sex);

type Category = "blood" | "body";
const ALL_CATEGORIES: Category[] = ["blood", "body"];

export default function ResultsCard({
  api, journeyId, sex, results, onSaved, reportShown, endpoint = "/api/vinnustod/results", audience = "staff",
  categories = ALL_CATEGORIES, title, allowImport = true, importOnBehalf = false, emptyText,
}: {
  /** The full report is already rendered above, so listing every value here
   *  again just repeats it — a second "Niðurstöður" heading under the first. */
  reportShown?: boolean;
  api: Api;
  journeyId: string;
  sex: "m" | "f" | null;
  results: HcResult[];
  onSaved?: () => void;
  /**
   * Where the values go. The workstation writes as the nurse; the participant
   * writes their own through /api/hc/results, which records source 'self' and
   * refuses to overwrite anything measured clinically.
   */
  endpoint?: string;
  /** Changes the wording, not the maths. */
  audience?: "staff" | "client";
  /**
   * Which markers can be entered and are listed. Since the Medalia split
   * the workstation passes ["body"]: the health check's blood and
   * measurement results are entered in Medalia, and what a coach records
   * here is a follow-up measurement. Values read out of a report are still
   * matched against every entry.
   */
  categories?: Category[];
  /** Heading, in place of the default. */
  title?: string;
  /** Staff only: show "Lesa inn skýrslu" (the report import). */
  allowImport?: boolean;
  /**
   * The client has allowed staff to fetch their copy, so the import is on
   * their behalf by definition — no "how did it get here?" question.
   */
  importOnBehalf?: boolean;
  /** What to say when nothing is recorded, in place of the default. */
  emptyText?: string;
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
  /** Asking how the report got here, before the file dialog opens. */
  const [asking, setAsking] = useState(false);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * How the report came to be here, which the actor states rather than the
   * code assuming.
   *
   * This used to be `useState(true)` with no control anywhere, so every
   * import wrote a timestamp asserting the participant had asked for it
   * whether they had or not. A default is not a record of anything.
   *
   * The lawful basis for reading the report is 9. gr. (2)(h) — care by a
   * health professional under professional secrecy — not consent, so this is
   * not a consent gate and it does not block the work. It is provenance:
   * 5. gr. (2) accountability, and what the participant sees in their own
   * account so they can say "that is not mine".
   */
  const [onBehalf, setOnBehalf] = useState<boolean | null>(null);

  /** Read a Medalia PDF / lab printout / photos and show what was found. */
  const readReport = async (files: FileList | File[], allowAi = false) => {
    const list = Array.from(files).slice(0, 8);
    setReading(true); setMsg(""); setFound(null); setWarnings([]); setNeedsConsent(false);
    const fd = new FormData();
    for (const f of list) fd.append("files", f);
    if (allowAi) fd.append("allow_ai", "true");
    if (onBehalf === true || importOnBehalf) fd.append("on_behalf", "true");
    const r = await api(`/api/vinnustod/journeys/${journeyId}/import`, { method: "POST", body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setReading(false);
    if (!r?.ok) { setMsg(j.error || "Lesturinn mistókst."); return; }
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
    const r = await api(endpoint, { method: "POST", body: JSON.stringify({ journey_id: journeyId, values }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setMsg("Tókst ekki að vista."); toast.show(SAVE_FAILED, { tone: "bad" }); return; }
    if (Array.isArray(j.refused) && j.refused.length) {
      // Said plainly rather than silently dropped: a value measured at the
      // station outranks one typed at home, and the person should know which.
      setMsg(`Vistað. ${j.refused.length} gildi stóðu óbreytt — þau voru mæld hjá okkur.`);
      setDraft({}); setEditing(false); onSaved?.();
      return;
    }
    setFound(null); setMsg(`${values.length} gildi vistuð`);
    toast.show(`${values.length} gildi vistuð`, { tone: "ok" });
    onSaved?.();
  };

  const client = audience === "client";
  useEffect(() => {
    let live = true;
    /* The workstation's reference book is staff-only; a participant gets
       the same entries from their own results route. Reading the staff one
       here left the participant's form with no markers in it at all. */
    api(client ? `${endpoint}?knowledge=1` : "/api/vinnustod/knowledge")
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((j) => { if (live) setEntries(j.entries ?? []); })
      .catch(() => { if (live) setEntries([]); });
    return () => { live = false; };
  }, [api, client, endpoint]);

  // Every marker with numeric bands: what a report's values are matched to.
  const known = useMemo(
    () => (entries ?? []).filter((e) => (e.category === "blood" || e.category === "body") && e.bands.length > 0),
    [entries],
  );
  // Markers a nurse can record here and that are listed: the categories asked for.
  const markers = useMemo(
    () => known.filter((e) => (categories as string[]).includes(e.category)),
    [known, categories],
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
    () => results.filter((r) => !known.some((m) => m.slug === r.marker)),
    [results, known],
  );

  const save = async () => {
    if (busy) return;
    setBusy(true); setMsg("");
    const values = Object.entries(draft).map(([marker, raw]) => ({
      marker,
      value: raw.trim() === "" ? null : Number(raw.replace(",", ".")),
      unit: markers.find((m) => m.slug === marker)?.unit || null,
      measured_at: date || null,
    }));
    /* `endpoint`, not a fixed path: this always wrote to the workstation's
       /api/vinnustod/results, so a participant's own values (endpoint
       /api/hc/results) were refused by a route they cannot use. */
    const r = await api(endpoint, { method: "POST", body: JSON.stringify({ journey_id: journeyId, values }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setMsg("Tókst ekki að vista."); toast.show(SAVE_FAILED, { tone: "bad" }); return; }
    setDraft({});
    const refused = Array.isArray(j.refused) ? j.refused.length : 0;
    const said = refused
      ? `Vistað. ${refused} gildi stóðu óbreytt — þau voru mæld hjá okkur.`
      : "Vistað";
    setMsg(said);
    toast.show(said, { tone: "ok" });
    setEditing(false);
    onSaved?.();
  };

  if (entries === null) return null;

  const pick = (v: boolean) => { setOnBehalf(v); setAsking(false); fileRef.current?.click(); };
  const startImport = () => (importOnBehalf ? fileRef.current?.click() : setAsking(true));

  return (
    <section className={`${hcCard.base} p-4 sm:p-5`}>
      {/* Stated, not assumed. Reading the report is lawful either way under
          9. gr. (2)(h) — this records which it was, so the participant can
          see it in their own account and say if it is wrong. */}
      {asking && (
        <div className="mb-3 rounded-hc-card bg-hc-sunken p-3 ring-1 ring-hc-border">
          <p className="text-sm font-semibold text-hc-ink">Hvernig kom skýrslan hingað?</p>
          <div className="mt-2 grid gap-2">
            <button type="button" onClick={() => pick(true)}
              className="min-h-11 rounded-hc-element border border-hc-control bg-hc-surface px-3 py-2 text-left text-sm hover:border-hc-brand-dark">
              <span className="block font-semibold text-hc-ink">Skjólstæðingurinn bað mig um að setja hana inn</span>
              <span className="block text-xs text-hc-ink-2">Skráð á þig og sýnt skjólstæðingnum í hans aðgangi.</span>
            </button>
            <button type="button" onClick={() => pick(false)}
              className="min-h-11 rounded-hc-element border border-hc-control bg-hc-surface px-3 py-2 text-left text-sm hover:border-hc-brand-dark">
              <span className="block font-semibold text-hc-ink">Ég les hana fyrir viðtalið</span>
              <span className="block text-xs text-hc-ink-2">Hluti af þjónustunni — engin beiðni skráð.</span>
            </button>
          </div>
          <button type="button" onClick={() => setAsking(false)} className={`${hcBtn.ghost} mt-2`}>Hætta við</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-hc-ink">
          {title ?? (audience === "client" ? "Mínar mælingar" : reportShown ? "Skrá eða lesa gildi" : "Niðurstöður")}
        </h3>
        {recorded.length > 0 && (
          <span className={badgeClass("neutral", "md")}>{recorded.length} skráð</span>
        )}
        {flagged > 0 && (
          <span className={badgeClass("warn", "md")}>{flagged} utan viðmiða</span>
        )}
        <span className="flex-1" />
        {!editing && (
          <>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) void readReport(e.target.files); e.target.value = ""; }} />
            {/* Staff only: it reads through the workstation's import route
                and asks a question a participant cannot answer. A
                participant's report goes in through ReportUpload. */}
            {!client && allowImport && <button type="button" onClick={startImport} disabled={reading}
              className={hcBtn.primary}>
              {reading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
              {reading ? "Les skýrsluna…" : importOnBehalf ? "Lesa inn skýrslu" : "Lesa úr skýrslu"}
            </button>}
            {/* Was a pre-ticked checkbox. A box that arrives already ticked
                records the default, not the person — so the question is asked
                when the file is chosen instead, and this only reports back
                what was answered. */}
            {onBehalf !== null && !importOnBehalf && (
              <span className="inline-flex items-center gap-1.5 text-xs text-hc-ink-2">
                {onBehalf ? "Skráð: að beiðni skjólstæðings" : "Skráð: lesið fyrir viðtalið"}
              </span>
            )}
            <button type="button" onClick={() => setEditing(true)}
              className={hcBtn.secondary}>
              {recorded.length ? "Breyta gildum" : "Skrá gildi"}
            </button>
          </>
        )}
        <span className="text-xs text-hc-ink-2">{msg}</span>
      </div>

      {needsConsent && (
        <div className="mt-3 rounded-hc-card bg-hc-warn-surface p-4 ring-1 ring-hc-warn-ink/30">
          <p className="font-bold text-hc-warn-ink">Við gátum ekki lesið þetta skjal hér</p>
          {warnings.map((w, i) => <p key={i} className="mt-1 text-sm leading-relaxed text-hc-warn-ink">{w}</p>)}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={reading || !pending.length} onClick={() => void readReport(pending, true)}
              className={`${hcBtn.base} bg-amber-900 text-white hover:bg-amber-800`}>
              {reading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Senda í AI-lestur
            </button>
            <button type="button" onClick={() => { setNeedsConsent(false); setWarnings([]); setPending([]); }}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-hc-warn-ink hover:underline">Nei, ég skrái gildin sjálf</button>
          </div>
        </div>
      )}

      {found && found.length > 0 && (
        <div className="mt-3 rounded-hc-card bg-hc-sunken p-3 ring-1 ring-hc-border">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-hc-ink">Úr skýrslunni{foundDate ? ` · ${foundDate}` : ""}</p>
            <span className={badgeClass("neutral", "md")}>{found.length} gildi fundust</span>
            <span className="flex-1" />
            <button type="button" onClick={() => setFound(null)} className={hcBtn.ghost}>Hætta við</button>
          </div>
          <p className="mt-0.5 text-xs text-hc-ink-2">Farðu yfir gildin áður en þau eru vistuð. Skráin sjálf er hvergi geymd.</p>

          <ul className="mt-2 divide-y divide-hc-hairline rounded-hc-element bg-hc-surface ring-1 ring-hc-hairline">
            {found.map((v, i) => {
              const entry = known.find((m) => m.slug === v.slug);
              const b = entry && !sexUnknown(entry, sex) ? bandForValue(entry, v.value, sex) : null;
              return (
                <li key={`${v.code}-${i}`}>
                  {/* The whole row toggles it, not only the 16px box. */}
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                  <input type="checkbox" checked={!!take[i]} onChange={(e) => setTake({ ...take, [i]: e.target.checked })}
                    aria-label={`Vista ${entry?.title ?? v.label}`} className="h-4 w-4 accent-hc-brand-dark" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-hc-ink">{entry?.title ?? v.label}</span>
                    <span className="block text-xs text-hc-ink-2">
                      {[!entry ? "ekki í uppflettiriti" : null,
                        v.converted_from ? `umreiknað úr ${v.converted_from}` : null,
                        v.confidence !== "high" ? `öryggi: ${v.confidence === "medium" ? "miðlungs" : "lágt"}` : null,
                      ].filter(Boolean).join(" · ") || v.label}
                    </span>
                  </span>
                  <span className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ${b ? TONE_PILL[b.tone] : "bg-hc-sunken text-hc-ink-2 ring-hc-hairline"}`}>
                    {String(v.value).replace(".", ",")}{v.unit ? ` ${v.unit}` : ""}
                  </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-hc-warn-ink">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}

          <button type="button" onClick={saveImported} disabled={busy || !Object.values(take).some(Boolean)}
            className={`${hcBtn.primary} mt-3`}>
            <Check className="h-4 w-4" aria-hidden /> Vista valin gildi
          </button>
        </div>
      )}

      {recorded.length === 0 && !editing && !found && (
        <p className="mt-2 text-sm text-hc-ink-2">
          {emptyText ?? "Engin gildi skráð. Skráðu lykilgildin úr blóðprufunni og mælingunni — þau eru þá við höndina í viðtalinu og merkt við viðmið Lifeline."}
        </p>
      )}

      {!editing && !reportShown && recorded.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {recorded.map((e) => {
            const v = valueOf(e.slug)!;
            const unknown = sexUnknown(e, sex);
            const b = unknown ? null : bandForValue(e, v, sex);
            return (
              <li key={e.slug} className="flex items-center gap-3 rounded-hc-element px-3 py-2 ring-1 ring-hc-hairline">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-hc-ink">{e.title}</span>
                  <span className="block text-xs text-hc-ink-2">
                    {unknown
                      ? "Kynjaskipt viðmið — kyn vantar í skrá"
                      : b ? `${b.label.replace(/\s*\((karlar|konur)\)$/i, "")} · ${bandRangeText(b, e.unit)}` : "utan skilgreindra bila"}
                  </span>
                </span>
                <span className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ${b ? TONE_PILL[b.tone] : "bg-hc-sunken text-hc-ink-2 ring-hc-hairline"}`}>
                  {String(v).replace(".", ",")}{e.unit ? ` ${e.unit}` : ""}
                </span>
                {!client && <button type="button" onClick={() => setLookup(`${e.title} ${v}`)} title={`Fletta upp ${e.title}`}
                  aria-label={`Fletta upp ${e.title}`} className="-my-1 grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-hc-ink-3 hover:bg-hc-sunken-2 hover:text-hc-ink-2">
                  <BookOpen className="h-4 w-4" aria-hidden />
                </button>}
              </li>
            );
          })}
        </ul>
      )}

      {!editing && !reportShown && extras.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-3">Önnur gildi úr skýrslunni</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {extras.map((r) => (
              <li key={r.marker} className="flex items-center gap-3 rounded-hc-element px-3 py-2 ring-1 ring-hc-hairline">
                <span className="min-w-0 flex-1 truncate text-sm text-hc-ink-2">{r.note || r.marker.replace(/^x:/, "")}</span>
                <span className="rounded-lg bg-hc-sunken px-2.5 py-1 text-sm font-bold tabular-nums text-hc-ink-2 ring-1 ring-hc-hairline">
                  {String(r.value).replace(".", ",")}{r.unit ? ` ${r.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-hc-ink-3">
            {client
              ? "Engin viðmið eru skráð fyrir þessi gildi."
              : "Ekki í uppflettiritinu — engin viðmið reiknuð. Bættu við færslu í /admin/knowledge ef þetta á að flaggast."}
          </p>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-4">
          <label className="flex items-center gap-2 text-sm text-hc-ink-2">
            Mælt
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={hcInput.replace("w-full", "w-auto")} />
          </label>

          {categories.map((cat) => {
            const group = markers.filter((m) => m.category === cat);
            if (!group.length) return null;
            return (
              <div key={cat}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-3">{CATEGORY_IS[cat]}</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {group.map((e) => {
                    const raw = draft[e.slug] ?? (byMarker.get(e.slug) ? String(byMarker.get(e.slug)!.value) : "");
                    const v = raw.trim() === "" ? null : Number(raw.replace(",", "."));
                    const unknown = sexUnknown(e, sex);
                    const b = v != null && Number.isFinite(v) && !unknown ? bandForValue(e, v, sex) : null;
                    const ranges = bandsFor(e, sex).filter((x) => x.tone === "good").map((x) => bandRangeText(x, null)).join(" / ");
                    return (
                      <li key={e.slug} className="flex items-center gap-2">
                        <label className="min-w-0 flex-1 text-sm text-hc-ink-2" htmlFor={`res-${e.slug}`}>
                          <span className="block truncate font-medium">{e.title}</span>
                          <span className="block text-[11px] text-hc-ink-3">
                            {unknown ? "Kjörsvið er kynjaskipt" : `Kjörsvið ${ranges}${e.unit ? ` ${e.unit}` : ""}`}
                          </span>
                        </label>
                        <input
                          id={`res-${e.slug}`} inputMode="decimal" value={raw}
                          onChange={(ev) => setDraft({ ...draft, [e.slug]: ev.target.value })}
                          placeholder="—"
                          className={`w-24 rounded-hc-element border px-2 py-1.5 text-right text-sm tabular-nums text-hc-ink placeholder:text-hc-ink-3 ${b && b.tone !== "good" ? "border-hc-warn-ink/60 bg-hc-warn-surface" : "border-hc-control bg-hc-surface"}`}
                        />
                        <span className="w-20 shrink-0 text-[11px] text-hc-ink-2">{b ? TONE_IS[b.tone] : unknown && v != null ? "kyn vantar" : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <div className="flex items-center gap-2 border-t border-hc-hairline pt-3">
            <button type="button" onClick={save} disabled={busy}
              className={hcBtn.primary}>
              <Check className="h-4 w-4" aria-hidden /> {busy ? "Vista…" : "Vista gildi"}
            </button>
            <button type="button" onClick={() => { setDraft({}); setEditing(false); setMsg(""); }}
              className={hcBtn.ghost}>Hætta við</button>
            <span className="text-xs text-hc-ink-2">
              {client
                ? "Gildin eru merkt sem þín eigin. Mælingar sem gerðar voru hjá okkur standa óbreyttar."
                : "Skráð gildi sjást aðeins í vinnustöðinni og stjórnborði — sjúkraskráin er í Medalia."}
            </span>
          </div>
        </div>
      )}

      {/* Reads the staff reference book, so not for a participant. */}
      {!client && <KnowledgeSearch api={api} open={lookup !== null} initialQuery={lookup ?? ""} onClose={() => setLookup(null)} />}
    </section>
  );
}
