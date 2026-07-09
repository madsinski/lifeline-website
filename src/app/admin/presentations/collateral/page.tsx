"use client";

// Fjarlækningar print collateral studio — part of the presentations module.
// Edit the copy for three A4 print documents (reception poster, internal
// referral guide, newspaper advert) for the HSU pilot, with a live scaled
// preview and a "Save as PDF" path that prints at true A4. Content persists to
// Supabase via /api/admin/presentations/collateral. The print surface is
// portalled to <body> and the admin chrome is hidden in @media print (mirrors
// the deck's DeckPrint).

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { COLLATERAL_CSS } from "./collateral-css";
import { CollateralDoc, DOC_META, type DocId } from "./docs";
import {
  DEFAULT_CONTENT, SERVICE_ICONS, mergeContent,
  type CollateralContent, type Step, type Service, type Safety, type AfterItem,
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

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

// ── small form atoms ─────────────────────────────────────────────────────
const inputCls = "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400";

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
        </div>
      ))}
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
      <p className="text-[11px] text-gray-400">Táknmynd er valin úr föstu setti (níu Medalia-erindi). Útlit veggspjaldsins er hannað fyrir níu.</p>
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
            <label className="block w-20 shrink-0">
              <span className="mb-1 block text-xs font-medium text-gray-600">Merki</span>
              <input value={a.k} onChange={(e) => set(i, { k: e.target.value })} className={inputCls} />
            </label>
            <div className="flex-1"><Field label="Feitletrað" value={a.bold} onChange={(v) => set(i, { bold: v })} /></div>
          </div>
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

// ── page ─────────────────────────────────────────────────────────────────
export default function CollateralStudio() {
  const [doc, setDoc] = useState<DocId>("poster");
  const [fit, setFit] = useState(0.6);
  const [content, setContent] = useState<CollateralContent>(DEFAULT_CONTENT);
  const [saved, setSaved] = useState<CollateralContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dirty = JSON.stringify(content) !== JSON.stringify(saved);

  // load stored content
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/presentations/collateral", { headers: await authHeaders() });
        if (res.ok) {
          const j = await res.json();
          if (!cancel) { const m = mergeContent(j.data); setContent(m); setSaved(m); }
        }
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, []);

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
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/presentations/collateral", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ data: content }),
      });
      if (res.ok) { setSaved(content); setMsg("Vistað ✓"); }
      else {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error === "mfa_required" ? "Þarft að staðfesta með auðkenningu (MFA) til að vista." : `Villa: ${j.error ?? res.status}`);
      }
    } catch { setMsg("Netvilla — reyndu aftur."); }
    finally { setSaving(false); }
  }

  // typed section setters
  const patchPoster = (p: Partial<CollateralContent["poster"]>) => setContent((c) => ({ ...c, poster: { ...c.poster, ...p } }));
  const patchReferral = (p: Partial<CollateralContent["referral"]>) => setContent((c) => ({ ...c, referral: { ...c.referral, ...p } }));
  const patchAdvert = (p: Partial<CollateralContent["advert"]>) => setContent((c) => ({ ...c, advert: { ...c.advert, ...p } }));
  const setServices = (services: Service[]) => setContent((c) => ({ ...c, services }));

  return (
    <div className="llcol mx-auto max-w-7xl px-4 py-6">
      <style dangerouslySetInnerHTML={{ __html: COLLATERAL_CSS + PRINT_CSS }} />

      {/* header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/presentations" className="text-sm text-gray-400 hover:text-emerald-700">← Presentations</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Fjarlækningar — prentefni fyrir HSU</h1>
          <p className="text-sm text-gray-500">Breyttu textanum, forskoðaðu og vistaðu sem PDF. A4.</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-sm text-gray-500">{msg}</span>}
          <button onClick={save} disabled={!dirty || saving}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? "Vista…" : dirty ? "Vista breytingar" : "Vistað"}
          </button>
          <button onClick={() => window.print()} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Vista sem PDF
          </button>
        </div>
      </div>

      {/* document tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {DOC_META.map((d) => (
          <button key={d.id} onClick={() => setDoc(d.id)}
            className={`rounded-lg border px-4 py-2 text-left transition ${doc === d.id ? "border-emerald-500 bg-emerald-50/60" : "border-gray-200 bg-white hover:border-emerald-300"}`}>
            <div className="text-sm font-semibold text-gray-900">{d.name}</div>
            <div className="text-xs text-gray-500">{d.sub}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* editor */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400">Hleð efni…</p>
          ) : doc === "poster" ? (
            <>
              <Section title="Haus">
                <Field label="Merki (efst til hægri)" value={content.poster.badge} onChange={(v) => patchPoster({ badge: v })} />
                <Field label="Yfirskrift" value={content.poster.eyebrow} onChange={(v) => patchPoster({ eyebrow: v })} />
                <Field label="Fyrirsögn — lína 1" value={content.poster.headingA} onChange={(v) => patchPoster({ headingA: v })} />
                <Field label="Fyrirsögn — lína 2 (hvít)" value={content.poster.headingB} onChange={(v) => patchPoster({ headingB: v })} />
                <Field label="Fyrirsögn — áhersla (blá)" value={content.poster.headingAccent} onChange={(v) => patchPoster({ headingAccent: v })} />
                <Field label="Inngangur" value={content.poster.lead} onChange={(v) => patchPoster({ lead: v })} area />
              </Section>
              <Section title="Þjónustur">
                <Field label="Titill" value={content.poster.servicesTitle} onChange={(v) => patchPoster({ servicesTitle: v })} />
                <ServicesEditor services={content.services} onChange={setServices} />
              </Section>
              <Section title="Svona virkar það">
                <Field label="Titill" value={content.poster.stepsTitle} onChange={(v) => patchPoster({ stepsTitle: v })} />
                <StepsEditor steps={content.poster.steps} onChange={(steps) => patchPoster({ steps })} />
              </Section>
              <Section title="Fótur">
                <Field label="Hvatning (label)" value={content.poster.ctaLabel} onChange={(v) => patchPoster({ ctaLabel: v })} />
                <Field label="Veffang" value={content.poster.url} onChange={(v) => patchPoster({ url: v })} />
                <Field label="Athugasemd" value={content.poster.footerNote} onChange={(v) => patchPoster({ footerNote: v })} area />
                <SafetyEditor safety={content.poster.safety} onChange={(safety) => patchPoster({ safety })} />
              </Section>
            </>
          ) : doc === "referral" ? (
            <>
              <Section title="Haus">
                <Field label="Merki" value={content.referral.badge} onChange={(v) => patchReferral({ badge: v })} />
                <Field label="Yfirskrift" value={content.referral.eyebrow} onChange={(v) => patchReferral({ eyebrow: v })} />
                <Field label="Fyrirsögn" value={content.referral.heading} onChange={(v) => patchReferral({ heading: v })} />
                <Field label="Fyrirsögn — áhersla (blá)" value={content.referral.headingAccent} onChange={(v) => patchReferral({ headingAccent: v })} />
                <Field label="Inngangur" value={content.referral.intro} onChange={(v) => patchReferral({ intro: v })} area />
              </Section>
              <Section title="Hentar vel fyrir">
                <Field label="Titill" value={content.referral.yesTitle} onChange={(v) => patchReferral({ yesTitle: v })} />
                <StrListEditor items={content.referral.yes} onChange={(yes) => patchReferral({ yes })} addLabel="Bæta við" />
              </Section>
              <Section title="Vísaðu ekki">
                <Field label="Titill" value={content.referral.noTitle} onChange={(v) => patchReferral({ noTitle: v })} />
                <StrListEditor items={content.referral.no} onChange={(no) => patchReferral({ no })} addLabel="Bæta við" />
              </Section>
              <Section title="Hvernig þú vísar">
                <Field label="Titill" value={content.referral.referTitle} onChange={(v) => patchReferral({ referTitle: v })} />
                <StepsEditor steps={content.referral.referSteps} onChange={(referSteps) => patchReferral({ referSteps })} />
              </Section>
              <Section title="Hvað gerist svo">
                <Field label="Titill" value={content.referral.afterTitle} onChange={(v) => patchReferral({ afterTitle: v })} />
                <AfterEditor items={content.referral.after} onChange={(after) => patchReferral({ after })} />
              </Section>
              <Section title="Fótur">
                <SafetyEditor safety={content.referral.safety} onChange={(safety) => patchReferral({ safety })} />
                <Field label="Tengiliður (label)" value={content.referral.contactLabel} onChange={(v) => patchReferral({ contactLabel: v })} />
                <Field label="Netfang" value={content.referral.contactEmail} onChange={(v) => patchReferral({ contactEmail: v })} />
              </Section>
            </>
          ) : (
            <>
              <Section title="Haus">
                <Field label="Merki" value={content.advert.badge} onChange={(v) => patchAdvert({ badge: v })} />
                <Field label="Fyrirsögn — lína 1 (hvít)" value={content.advert.headingA} onChange={(v) => patchAdvert({ headingA: v })} />
                <Field label="Fyrirsögn — áhersla (blá)" value={content.advert.headingAccent} onChange={(v) => patchAdvert({ headingAccent: v })} />
                <Field label="Inngangur" value={content.advert.lead} onChange={(v) => patchAdvert({ lead: v })} area />
              </Section>
              <Section title="Þjónustur">
                <Field label="Titill" value={content.advert.servicesTitle} onChange={(v) => patchAdvert({ servicesTitle: v })} />
                <ServicesEditor services={content.services} onChange={setServices} />
              </Section>
              <Section title="Skref">
                <StepsEditor steps={content.advert.steps} onChange={(steps) => patchAdvert({ steps })} />
              </Section>
              <Section title="Fótur">
                <Field label="Hvatning (label)" value={content.advert.ctaLabel} onChange={(v) => patchAdvert({ ctaLabel: v })} />
                <Field label="Veffang" value={content.advert.url} onChange={(v) => patchAdvert({ url: v })} />
                <Field label="Samstarfstexti" value={content.advert.partnerNote} onChange={(v) => patchAdvert({ partnerNote: v })} area />
                <SafetyEditor safety={content.advert.safety} onChange={(safety) => patchAdvert({ safety })} />
              </Section>
            </>
          )}
          {!loading && (
            <button onClick={() => setContent(DEFAULT_CONTENT)} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
              Endurstilla á sjálfgefinn texta
            </button>
          )}
        </div>

        {/* preview */}
        <div>
          <p className="mb-2 text-xs text-gray-400">
            Í prentglugganum: veldu <b>A4</b>, spássíur <b>Engar</b> og kveiktu á <b>Bakgrunnsgrafík</b>.
          </p>
          <div ref={stageRef} className="flex justify-center rounded-xl bg-gray-100 p-4">
            <div style={{ width: A4_W * fit, height: A4_H * fit, overflow: "hidden", ["--fit" as string]: String(fit) }}>
              <CollateralDoc doc={doc} content={content} />
            </div>
          </div>
        </div>
      </div>

      {/* print surface (portalled to body; hidden off-screen, shown in @media print) */}
      {mounted && createPortal(
        <div className="llcol-print llcol">
          <CollateralDoc doc={doc} content={content} />
        </div>,
        document.body,
      )}
    </div>
  );
}
