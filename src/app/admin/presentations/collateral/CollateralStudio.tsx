"use client";

// Shared collateral editor: a dynamic list of A4 documents (add / duplicate /
// delete / reorder), each edited in place with a scaled preview + print. Content
// in / save out are injected via props so this component is auth-agnostic (used
// by the admin studio and the token-gated external editor).

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { COLLATERAL_CSS } from "./collateral-css";
import { CollateralDoc, AFTER_ICON_KEYS } from "./docs";
import {
  defaultDoc,
  SERVICE_ICONS,
  type CollateralContent,
  type ArchivedDoc,
  type Doc,
  type DocType,
  type Step,
  type Service,
  type Safety,
  type AfterItem,
} from "./content";

const A4_W = 793.7;
const A4_H = 1122.5;

const PRINT_CSS = `
.llcol-print{position:fixed;left:-99999px;top:0;}
@media print{
  html,body{margin:0!important;padding:0!important;background:#fff!important;}
  body > *:not(.llcol-print){display:none!important;}
  .llcol-print{position:static!important;left:0!important;}
  .llcol-print .a4{transform:none!important;box-shadow:none!important;margin:0!important;
    break-after:page;page-break-after:always;}
  .llcol-print .a4:last-child{break-after:auto;page-break-after:auto;}
  .llcol-print .a4,.llcol-print .a4 *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  @page{size:A4;margin:0;}
}
`;

const NEW_TYPES: { type: DocType; label: string }[] = [
  { type: "poster", label: "Veggspjald" },
  { type: "referral", label: "Tilvísunarleiðbeiningar" },
  { type: "advert", label: "Blaðaauglýsing" },
];

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `doc-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }
}

// ── small form atoms ─────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400";

function Field({ label, value, onChange, area = false }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {area
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={inputCls} />
        : <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h3 className="mb-2.5 text-sm font-semibold text-gray-800">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function StepsEditor({ steps, onChange }: { steps: Step[]; onChange: (s: Step[]) => void }) {
  const set = (i: number, patch: Partial<Step>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-gray-200 p-2">
          <Field label={`Skref ${i + 1} — titill`} value={s.title} onChange={(v) => set(i, { title: v })} />
          <Field label="Texti" value={s.body} onChange={(v) => set(i, { body: v })} area />
          <button onClick={() => onChange(steps.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">Fjarlægja skref</button>
        </div>
      ))}
      <button onClick={() => onChange([...steps, { title: "", body: "" }])} className="text-xs font-medium text-emerald-600 hover:underline">+ Bæta við skrefi</button>
    </div>
  );
}

function StrListEditor({ items, onChange, addLabel }: { items: string[]; onChange: (v: string[]) => void; addLabel: string }) {
  return (
    <div className="space-y-1.5">
      {items.map((t, i) => (
        <div key={i} className="flex gap-1.5">
          <input value={t} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="shrink-0 rounded-md border border-gray-300 px-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Fjarlægja">✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ""])} className="text-xs font-medium text-emerald-600 hover:underline">+ {addLabel}</button>
    </div>
  );
}

function ServicesEditor({ services, onChange }: { services: Service[]; onChange: (v: Service[]) => void }) {
  const set = (i: number, patch: Partial<Service>) => onChange(services.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-1.5">
      {services.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select value={s.icon} onChange={(e) => set(i, { icon: e.target.value })} className="shrink-0 rounded-md border border-gray-300 px-1.5 py-1.5 text-xs text-gray-700">
            {SERVICE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
          </select>
          <input value={s.label} onChange={(e) => set(i, { label: e.target.value })} className={inputCls} />
          <button onClick={() => onChange(services.filter((_, j) => j !== i))} className="shrink-0 rounded-md border border-gray-300 px-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Fjarlægja">✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...services, { icon: SERVICE_ICONS[0], label: "" }])} className="text-xs font-medium text-emerald-600 hover:underline">+ Bæta við þjónustu</button>
    </div>
  );
}

function AfterEditor({ items, onChange }: { items: AfterItem[]; onChange: (v: AfterItem[]) => void }) {
  const set = (i: number, patch: Partial<AfterItem>) => onChange(items.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      {items.map((a, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-gray-200 p-2">
          <div className="flex gap-1.5">
            <label className="block w-28 shrink-0">
              <span className="mb-1 block text-xs font-medium text-gray-600">Tákn</span>
              <select value={a.icon ?? ""} onChange={(e) => set(i, { icon: e.target.value || undefined })} className="w-full rounded-md border border-gray-300 px-1.5 py-1.5 text-xs text-gray-700">
                <option value="">— texti —</option>
                {AFTER_ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <div className="flex-1"><Field label="Feitletrað" value={a.bold} onChange={(v) => set(i, { bold: v })} /></div>
          </div>
          {!a.icon && <Field label="Táknatexti (þegar ekkert tákn)" value={a.k} onChange={(v) => set(i, { k: v })} />}
          <Field label="Texti" value={a.text} onChange={(v) => set(i, { text: v })} area />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">Fjarlægja</button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { k: "•", bold: "", text: "" }])} className="text-xs font-medium text-emerald-600 hover:underline">+ Bæta við lið</button>
    </div>
  );
}

function SafetyEditor({ safety, onChange }: { safety: Safety; onChange: (v: Safety) => void }) {
  return (
    <div className="space-y-1.5">
      <Field label="Feitletrað" value={safety.bold} onChange={(v) => onChange({ ...safety, bold: v })} />
      <Field label="Texti" value={safety.text} onChange={(v) => onChange({ ...safety, text: v })} />
    </div>
  );
}

// ── studio ───────────────────────────────────────────────────────────────
export type SaveResult = { ok: boolean; error?: string };

export function CollateralStudio({
  initial,
  onSave,
  heading,
  subtitle,
  back,
  headerExtra,
  archiveHref,
}: {
  initial: CollateralContent;
  onSave: (content: CollateralContent) => Promise<SaveResult>;
  heading: string;
  subtitle: string;
  back?: { href: string; label: string };
  headerExtra?: React.ReactNode;
  archiveHref?: string;
}) {
  const [content, setContent] = useState<CollateralContent>(initial);
  const [saved, setSaved] = useState<CollateralContent>(initial);
  const [sel, setSel] = useState(0);
  const [fit, setFit] = useState(0.6);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dirty = JSON.stringify(content) !== JSON.stringify(saved);

  const docs = content.docs;
  const index = Math.min(sel, docs.length - 1);
  const active = docs[index];

  const measure = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    setFit(Math.min(1, Math.max(0.2, (el.clientWidth - 32) / A4_W)));
  }, []);
  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [measure]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await onSave(content);
      if (res.ok) { setSaved(content); setMsg("Vistað ✓"); }
      else setMsg(res.error === "mfa_required" ? "Þarft að staðfesta með auðkenningu (MFA) til að vista." : `Villa: ${res.error ?? "óþekkt"}`);
    } catch { setMsg("Netvilla — reyndu aftur."); }
    finally { setSaving(false); }
  }

  // Auto-save: persist ~1.2s after the last edit (no manual Save button).
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { save(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // ── doc-list operations ─────────────────────────────────────────────────
  const setDocs = (next: Doc[]) => setContent((c) => ({ ...c, docs: next }));
  const updateDoc = (i: number, fn: (d: Doc) => Doc) => setDocs(docs.map((d, j) => (j === i ? fn(d) : d)));

  const addDoc = (type: DocType) => {
    const d = defaultDoc(type, newId());
    setDocs([...docs, d]);
    setSel(docs.length);
  };
  const duplicateDoc = () => {
    const copy: Doc = { ...active, id: newId(), name: `${active.name} (afrit)` };
    const next = [...docs.slice(0, index + 1), copy, ...docs.slice(index + 1)];
    setDocs(next);
    setSel(index + 1);
  };
  const deleteDoc = () => {
    if (docs.length <= 1) return;
    let at: string | undefined;
    try { at = new Date().toISOString(); } catch { at = undefined; }
    const removed: ArchivedDoc = { ...active, archivedAt: at };
    setContent((c) => ({
      ...c,
      docs: c.docs.filter((_, j) => j !== index),
      archived: [removed, ...(c.archived ?? [])],
    }));
    setSel(Math.max(0, index - 1));
  };
  const move = (dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= docs.length) return;
    const next = [...docs];
    [next[index], next[j]] = [next[j], next[index]];
    setDocs(next);
    setSel(j);
  };

  // ── field setters for the active doc ────────────────────────────────────
  const patchMeta = (p: { name?: string; sub?: string }) => updateDoc(index, (d) => ({ ...d, ...p }));
  const patchPoster = (p: Partial<Extract<Doc, { type: "poster" }>["poster"]>) =>
    updateDoc(index, (d) => (d.type === "poster" ? { ...d, poster: { ...d.poster, ...p } } : d));
  const patchReferral = (p: Partial<Extract<Doc, { type: "referral" }>["referral"]>) =>
    updateDoc(index, (d) => (d.type === "referral" ? { ...d, referral: { ...d.referral, ...p } } : d));
  const patchAdvert = (p: Partial<Extract<Doc, { type: "advert" }>["advert"]>) =>
    updateDoc(index, (d) => (d.type === "advert" ? { ...d, advert: { ...d.advert, ...p } } : d));

  const btn = "rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30";

  return (
    <div className="llcol mx-auto max-w-7xl px-4 py-6">
      <style dangerouslySetInnerHTML={{ __html: COLLATERAL_CSS + PRINT_CSS }} />

      {/* header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          {back && <a href={back.href} className="text-sm text-gray-400 hover:text-emerald-700">{back.label}</a>}
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{heading}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {headerExtra}
          <span className="flex items-center gap-1.5 text-sm text-gray-500" title="Breytingar vistast sjálfkrafa">
            <span className={`inline-block h-2 w-2 rounded-full ${saving ? "bg-amber-400" : dirty ? "bg-gray-300" : "bg-emerald-500"}`} />
            {saving ? "Vistar…" : dirty ? "Óvistað" : (msg ?? "Vistað sjálfkrafa")}
          </span>
          <button onClick={() => window.print()} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Vista sem PDF
          </button>
        </div>
      </div>

      {/* document tabs */}
      <div className="mb-3 flex flex-wrap gap-2">
        {docs.map((d, i) => (
          <button key={d.id} onClick={() => setSel(i)}
            className={`rounded-lg border px-4 py-2 text-left transition ${i === index ? "border-emerald-500 bg-emerald-50/60" : "border-gray-200 bg-white hover:border-emerald-300"}`}>
            <div className="text-sm font-semibold text-gray-900">{d.name || "(nafnlaust)"}</div>
            <div className="text-xs text-gray-500">{d.sub}</div>
          </button>
        ))}
      </div>

      {/* doc-list toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={duplicateDoc} className={btn}>Afrita</button>
        <button onClick={deleteDoc} disabled={docs.length <= 1} className={btn}>Eyða</button>
        <button onClick={() => move(-1)} disabled={index === 0} className={btn}>← Færa</button>
        <button onClick={() => move(1)} disabled={index === docs.length - 1} className={btn}>Færa →</button>
        <span className="mx-1 text-gray-300">|</span>
        <span className="text-xs text-gray-400">Bæta við:</span>
        {NEW_TYPES.map((t) => (
          <button key={t.type} onClick={() => addDoc(t.type)} className="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">+ {t.label}</button>
        ))}
        {archiveHref && (
          <>
            <span className="mx-1 text-gray-300">|</span>
            <a href={archiveHref} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Geymsla ({content.archived?.length ?? 0})</a>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* editor */}
        <div className="space-y-3">
          <Section title="Nafn flipa">
            <Field label="Heiti skjals" value={active.name} onChange={(v) => patchMeta({ name: v })} />
            <Field label="Undirtexti" value={active.sub} onChange={(v) => patchMeta({ sub: v })} />
          </Section>

          {active.type === "poster" ? (
            <>
              <Section title="Haus">
                <Field label="Merki (efst til hægri)" value={active.poster.badge} onChange={(v) => patchPoster({ badge: v })} />
                <Field label="Yfirskrift" value={active.poster.eyebrow} onChange={(v) => patchPoster({ eyebrow: v })} />
                <Field label="Fyrirsögn" value={active.poster.heading} onChange={(v) => patchPoster({ heading: v })} area />
                <p className="text-[11px] text-gray-400">Ný lína = línuskil. Settu <b>==</b> utan um orð til að lita þau blá, t.d. <code>==þar sem þú ert.==</code></p>
                <Field label="Inngangur" value={active.poster.lead} onChange={(v) => patchPoster({ lead: v })} area />
              </Section>
              <Section title="Þjónustur">
                <Field label="Titill" value={active.poster.servicesTitle} onChange={(v) => patchPoster({ servicesTitle: v })} />
                <ServicesEditor services={active.poster.services} onChange={(services) => patchPoster({ services })} />
              </Section>
              <Section title="Svona virkar það">
                <Field label="Titill" value={active.poster.stepsTitle} onChange={(v) => patchPoster({ stepsTitle: v })} />
                <StepsEditor steps={active.poster.steps} onChange={(steps) => patchPoster({ steps })} />
              </Section>
              <Section title="Deiling og fótur">
                <Field label="Hvatning (label)" value={active.poster.ctaLabel} onChange={(v) => patchPoster({ ctaLabel: v })} />
                <Field label="Vefslóð (birt)" value={active.poster.url} onChange={(v) => patchPoster({ url: v })} />
                <Field label="Tengill fyrir QR-kóða" value={active.poster.portalUrl} onChange={(v) => patchPoster({ portalUrl: v })} />
                <Field label="Athugasemd" value={active.poster.footerNote} onChange={(v) => patchPoster({ footerNote: v })} area />
                <SafetyEditor safety={active.poster.safety} onChange={(safety) => patchPoster({ safety })} />
              </Section>
            </>
          ) : active.type === "referral" ? (
            <>
              <Section title="Haus">
                <Field label="Merki" value={active.referral.badge} onChange={(v) => patchReferral({ badge: v })} />
                <Field label="Yfirskrift" value={active.referral.eyebrow} onChange={(v) => patchReferral({ eyebrow: v })} />
                <Field label="Fyrirsögn" value={active.referral.heading} onChange={(v) => patchReferral({ heading: v })} />
                <Field label="Fyrirsögn — áhersla (blá)" value={active.referral.headingAccent} onChange={(v) => patchReferral({ headingAccent: v })} />
                <Field label="Inngangur" value={active.referral.intro} onChange={(v) => patchReferral({ intro: v })} area />
              </Section>
              <Section title="Hentar vel fyrir">
                <Field label="Titill" value={active.referral.yesTitle} onChange={(v) => patchReferral({ yesTitle: v })} />
                <StrListEditor items={active.referral.yes} onChange={(yes) => patchReferral({ yes })} addLabel="Bæta við" />
              </Section>
              <Section title="Vísaðu ekki">
                <Field label="Titill" value={active.referral.noTitle} onChange={(v) => patchReferral({ noTitle: v })} />
                <StrListEditor items={active.referral.no} onChange={(no) => patchReferral({ no })} addLabel="Bæta við" />
              </Section>
              <Section title="Hvernig þú vísar">
                <Field label="Titill" value={active.referral.referTitle} onChange={(v) => patchReferral({ referTitle: v })} />
                <StepsEditor steps={active.referral.referSteps} onChange={(referSteps) => patchReferral({ referSteps })} />
              </Section>
              <Section title="Hvað gerist svo">
                <Field label="Titill" value={active.referral.afterTitle} onChange={(v) => patchReferral({ afterTitle: v })} />
                <AfterEditor items={active.referral.after} onChange={(after) => patchReferral({ after })} />
              </Section>
              <Section title="Deiling (3 leiðir)">
                <Field label="Titill" value={active.referral.shareTitle} onChange={(v) => patchReferral({ shareTitle: v })} />
                <Field label="1 · Vefslóð" value={active.referral.url} onChange={(v) => patchReferral({ url: v })} />
                <Field label="2 · Beinn tengill + 3 · QR-kóði" value={active.referral.portalUrl} onChange={(v) => patchReferral({ portalUrl: v })} />
              </Section>
              <Section title="Fótur">
                <SafetyEditor safety={active.referral.safety} onChange={(safety) => patchReferral({ safety })} />
                <Field label="Tengiliður (label)" value={active.referral.contactLabel} onChange={(v) => patchReferral({ contactLabel: v })} />
                <Field label="Netfang" value={active.referral.contactEmail} onChange={(v) => patchReferral({ contactEmail: v })} />
              </Section>
            </>
          ) : (
            <>
              <Section title="Haus">
                <Field label="Merki" value={active.advert.badge} onChange={(v) => patchAdvert({ badge: v })} />
                <Field label="Fyrirsögn — lína 1 (hvít)" value={active.advert.headingA} onChange={(v) => patchAdvert({ headingA: v })} />
                <Field label="Fyrirsögn — áhersla (blá)" value={active.advert.headingAccent} onChange={(v) => patchAdvert({ headingAccent: v })} />
                <Field label="Inngangur" value={active.advert.lead} onChange={(v) => patchAdvert({ lead: v })} area />
              </Section>
              <Section title="Þjónustur">
                <Field label="Titill" value={active.advert.servicesTitle} onChange={(v) => patchAdvert({ servicesTitle: v })} />
                <ServicesEditor services={active.advert.services} onChange={(services) => patchAdvert({ services })} />
              </Section>
              <Section title="Skref">
                <StepsEditor steps={active.advert.steps} onChange={(steps) => patchAdvert({ steps })} />
              </Section>
              <Section title="Deiling og fótur">
                <Field label="Hvatning (label)" value={active.advert.ctaLabel} onChange={(v) => patchAdvert({ ctaLabel: v })} />
                <Field label="Vefslóð (birt)" value={active.advert.url} onChange={(v) => patchAdvert({ url: v })} />
                <Field label="Tengill fyrir QR-kóða" value={active.advert.portalUrl} onChange={(v) => patchAdvert({ portalUrl: v })} />
                <Field label="Samstarfstexti" value={active.advert.partnerNote} onChange={(v) => patchAdvert({ partnerNote: v })} area />
                <SafetyEditor safety={active.advert.safety} onChange={(safety) => patchAdvert({ safety })} />
              </Section>
            </>
          )}
        </div>

        {/* preview */}
        <div>
          <p className="mb-2 text-xs text-gray-400">
            Í prentglugganum: veldu <b>A4</b>, spássíur <b>Engar</b> og kveiktu á <b>Bakgrunnsgrafík</b>.
          </p>
          <div ref={stageRef} className="flex justify-center rounded-xl bg-gray-100 p-4">
            <div style={{ width: A4_W * fit, height: A4_H * fit, overflow: "hidden", ["--fit" as string]: String(fit) }}>
              <CollateralDoc doc={active} />
            </div>
          </div>
        </div>
      </div>

      {/* print surface (portalled to body; shown only in @media print) */}
      {mounted && createPortal(
        <div className="llcol-print llcol">
          <CollateralDoc doc={active} />
        </div>,
        document.body,
      )}
    </div>
  );
}
