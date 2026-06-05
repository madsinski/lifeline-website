"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  SLIDE_SCHEMAS, SLIDE_TYPE_ORDER, makeBlankSlide, DESIGNS,
  type Slide, type SlideType, type SlideTheme, type PresentationData, type DesignId,
  type DeckTextMaps, type BrandKey,
} from "@/lib/presentations/types";
import {
  applyTextMap, extractTextMap, translatablePaths, getAtPath,
  planSync, applySync, resolveSlides, hasIcelandic,
} from "@/lib/presentations/i18n";
import { Deck, SlideStage } from "@/app/components/presentation/Deck";
import { DeckPrint } from "@/app/components/presentation/DeckPrint";
import { SlideFields } from "../_components/SlideFields";

type EditLang = "en" | "is";
const EMPTY_SNAP = { en: {}, is: {} };

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function PresentationEditor() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [design, setDesign] = useState<DesignId>("lifeline");
  const [tIs, setTIs] = useState<DeckTextMaps>({});
  const [syncSnap, setSyncSnap] = useState<{ en: DeckTextMaps; is: DeckTextMaps }>(EMPTY_SNAP);
  const [editLang, setEditLang] = useState<EditLang>("en");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [present, setPresent] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addBrand, setAddBrand] = useState<BrandKey>("lifeline");
  const [previewType, setPreviewType] = useState<SlideType>("title");
  const [copied, setCopied] = useState(false);
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipNextSave = useRef(true);

  // Load
  useEffect(() => {
    if (!id) return;
    (async () => {
      const res = await fetch(`/api/admin/presentations/${id}`, { headers: await authHeaders() });
      if (!res.ok) { setLoaded(true); return; }
      const j = await res.json();
      const p = j.presentation;
      setTitle(p.title ?? "");
      setSlug(p.slug ?? "");
      setPublished(!!p.is_published);
      const data = (p.data as PresentationData) || { slides: [] };
      setSlides(data.slides ?? []);
      setDesign(data.design ?? "lifeline");
      setTIs(data.tIs ?? {});
      setSyncSnap(data.syncSnap ?? EMPTY_SNAP);
      setLoaded(true);
    })();
  }, [id]);

  // Debounced autosave of title + slides
  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSave("saving");
      try {
        const res = await fetch(`/api/admin/presentations/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ title, data: { slides, design, tIs, syncSnap } }),
        });
        setSave(res.ok ? "saved" : "error");
      } catch { setSave("error"); }
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [title, slides, design, tIs, syncSnap, loaded, id]);

  const selected = slides[sel] ?? null;

  const updateSlide = useCallback((next: Slide) => {
    setSlides((prev) => prev.map((s, i) => (i === sel ? next : s)));
  }, [sel]);

  // What the editor shows/edits in the right panel, per edit language.
  const displaySlide = selected ? (editLang === "is" ? applyTextMap(selected, tIs[selected.id]) : selected) : null;

  const handleFieldChange = useCallback((next: Slide) => {
    if (!selected) return;
    if (editLang === "en") { updateSlide(next); return; }
    // IS mode: keep only fields whose Icelandic text differs from English.
    const enMap = extractTextMap(selected);
    const map: Record<string, string> = {};
    for (const p of translatablePaths(selected)) {
      const v = getAtPath(next, p);
      if (v && v !== enMap[p]) map[p] = v;
    }
    setTIs((prev) => ({ ...prev, [selected.id]: map }));
  }, [selected, editLang, updateSlide]);

  async function runSync() {
    setSyncing(true); setSyncMsg(null);
    try {
      const data: PresentationData = { slides, design, tIs, syncSnap };
      const plan = planSync(data);
      if (plan.items.length === 0) { setSyncMsg("Already in sync — nothing changed."); return; }
      // Translate in small batches so each request stays well under the
      // function/gateway timeout (a whole-deck call can otherwise 504).
      const CHUNK = 12;
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const all: string[] = [];
      for (let off = 0; off < plan.items.length; off += CHUNK) {
        const slice = plan.items.slice(off, off + CHUNK);
        setSyncMsg(`Translating… ${Math.min(off + CHUNK, plan.items.length)} / ${plan.items.length}`);
        const res = await fetch(`/api/admin/presentations/${id}/translate`, {
          method: "POST", headers,
          body: JSON.stringify({ items: slice.map(({ from, to, text }) => ({ from, to, text })) }),
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); setSyncMsg(`Sync failed: ${j.error || res.status}`); return; }
        const { translations } = await res.json();
        for (let k = 0; k < slice.length; k++) all.push((translations?.[k] ?? slice[k].text) as string);
      }
      const results = plan.items.map((it, idx) => ({ slideId: it.slideId, path: it.path, to: it.to, text: all[idx] ?? it.text }));
      const nextData = applySync(data, results);
      setSlides(nextData.slides);
      setTIs(nextData.tIs || {});
      setSyncSnap(nextData.syncSnap || EMPTY_SNAP);
      setSyncMsg(`Synced ${results.length} field${results.length === 1 ? "" : "s"}${plan.conflicts ? ` · ${plan.conflicts} conflict${plan.conflicts === 1 ? "" : "s"} resolved to English` : ""}.`);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally { setSyncing(false); }
  }

  function addSlide(type: SlideType) {
    const ns = { ...makeBlankSlide(type), brand: addBrand };
    setSlides((prev) => {
      const copy = prev.slice();
      copy.splice(sel + 1, 0, ns);
      return copy;
    });
    setSel((i) => i + 1);
    setAddOpen(false);
  }
  function removeSlide(i: number) {
    if (!confirm("Delete this slide?")) return;
    setSlides((prev) => prev.filter((_, idx) => idx !== i));
    setSel((cur) => Math.max(0, cur > i ? cur - 1 : cur));
  }
  function moveSlide(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= slides.length) return;
    setSlides((prev) => { const c = prev.slice(); [c[i], c[j]] = [c[j], c[i]]; return c; });
    setSel(j);
  }

  async function togglePublish() {
    const next = !published;
    setPublished(next);
    await fetch(`/api/admin/presentations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ is_published: next }),
    }).catch(() => {});
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(`${origin}/present/${slug}`); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }

  if (!loaded) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
        <Link href="/admin/presentations" className="text-sm text-gray-400 hover:text-gray-700">← All</Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-lg font-semibold text-gray-900 hover:border-gray-200 focus:border-emerald-500 focus:outline-none"
          placeholder="Untitled presentation"
        />
        <span className={`text-xs ${save === "error" ? "text-red-600" : save === "saved" ? "text-emerald-600" : "text-gray-400"}`}>
          {save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "error" ? "Save failed" : ""}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Design
          <select value={design} onChange={(e) => setDesign(e.target.value as DesignId)} className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none" title="Deck design">
            {DESIGNS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <button onClick={() => setPresent(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">▶ Present</button>
        <button onClick={() => setPrintOpen(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50" title="Export to PDF">⤓ PDF</button>
        <button onClick={togglePublish} className={`rounded-md px-3 py-1.5 text-sm font-medium ${published ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
          {published ? "Published" : "Publish"}
        </button>
      </div>

      {/* translation bar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 bg-white px-4 py-1.5 text-xs">
        <span className="font-medium text-gray-400">Language</span>
        <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
          {(["en", "is"] as const).map((l) => (
            <button key={l} onClick={() => setEditLang(l)} className={`px-2.5 py-1 ${editLang === l ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              {l === "en" ? "English" : "Íslenska"}
            </button>
          ))}
        </div>
        <button onClick={runSync} disabled={syncing} className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
          {syncing ? "Syncing…" : "⟳ Sync translations"}
        </button>
        {syncMsg && <span className="text-gray-500">{syncMsg}</span>}
        <span className="ml-auto text-gray-400">{editLang === "is" ? "Editing Icelandic — structure & images shared with English." : "Editing English (source)."}</span>
      </div>

      {published && (
        <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-4 py-1.5 text-xs">
          <span className="text-emerald-700">Public link:</span>
          <code className="rounded bg-white px-1.5 py-0.5 text-gray-600">{origin}/present/{slug}</code>
          <button onClick={copyLink} className="font-medium text-emerald-600 hover:underline">{copied ? "Copied!" : "Copy"}</button>
          <a href={`/present/${slug}`} target="_blank" rel="noreferrer" className="font-medium text-gray-500 hover:underline">Open ↗</a>
        </div>
      )}

      {/* 3-column workspace */}
      <div className="grid flex-1 grid-cols-[220px_1fr_340px] overflow-hidden">
        {/* slide list */}
        <div className="overflow-y-auto border-r border-gray-100 bg-gray-50/50 p-2">
          {slides.map((s, i) => (
            <div
              key={s.id}
              onClick={() => setSel(i)}
              className={`group mb-1.5 cursor-pointer rounded-md border p-2 ${i === sel ? "border-emerald-400 bg-white shadow-sm" : "border-transparent hover:bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-400">{i + 1}. {SLIDE_SCHEMAS[s.type].label}</span>
                <div className="flex items-center gap-0.5 text-gray-300 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); moveSlide(i, -1); }} className="px-1 hover:text-gray-700">↑</button>
                  <button onClick={(e) => { e.stopPropagation(); moveSlide(i, 1); }} className="px-1 hover:text-gray-700">↓</button>
                  <button onClick={(e) => { e.stopPropagation(); removeSlide(i); }} className="px-1 hover:text-red-500">✕</button>
                </div>
              </div>
              <div className="mt-0.5 truncate text-xs text-gray-700">{s.heading?.replace(/==/g, "") || s.quote?.replace(/==/g, "") || s.kicker || "—"}</div>
            </div>
          ))}
          <button
            onClick={() => { setAddBrand(selected?.brand ?? "lifeline"); setPreviewType(selected?.type ?? "title"); setAddOpen(true); }}
            className="mt-1 w-full rounded-md border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600"
          >+ Add slide</button>
        </div>

        {/* preview */}
        <div className="overflow-y-auto bg-gray-100 p-6">
          <SlideStage slide={displaySlide} design={design} />
          {selected && (
            <p className="mt-3 text-center text-xs text-gray-400">Slide {sel + 1} of {slides.length} · {SLIDE_SCHEMAS[selected.type].label}{editLang === "is" ? " · Icelandic preview" : ""}</p>
          )}
        </div>

        {/* field editor */}
        <div className="overflow-y-auto border-l border-gray-100 bg-white p-4">
          {selected && displaySlide ? (
            <>
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{SLIDE_SCHEMAS[selected.type].label}</span>
                {editLang === "is" && <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">🇮🇸 Icelandic</span>}
                {editLang === "en" && (
                  <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                    <label className="flex items-center gap-1">Logo
                      <select
                        value={selected.brand ?? "lifeline"}
                        onChange={(e) => updateSlide({ ...selected, brand: e.target.value as BrandKey })}
                        className="rounded border border-gray-300 px-1.5 py-0.5"
                      >
                        <option value="lifeline">Lifeline</option>
                        <option value="fjarlaekningar">Fjarlækningar</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1">Theme
                      <select
                        value={selected.theme}
                        onChange={(e) => updateSlide({ ...selected, theme: e.target.value as SlideTheme })}
                        className="rounded border border-gray-300 px-1.5 py-0.5"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>

              <SlideFields slide={displaySlide} presentationId={id!} onChange={handleFieldChange} textOnly={editLang === "is"} />

              {editLang === "en" && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <label className="mb-1 block text-xs font-medium text-gray-500">Presenter notes (private)</label>
                  <textarea
                    rows={4}
                    value={selected.notes ?? ""}
                    onChange={(e) => updateSlide({ ...selected, notes: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="Shown to the presenter with the N key. Never visible to the audience."
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400">Add a slide to begin.</p>
          )}
        </div>
      </div>

      {present && (
        <Deck
          slides={slides}
          slidesIs={hasIcelandic({ slides, tIs }) ? resolveSlides({ slides, tIs }, "is") : undefined}
          design={design}
          initialIndex={sel}
          onClose={() => setPresent(false)}
        />
      )}

      {printOpen && (
        <DeckPrint
          slides={editLang === "is" && hasIcelandic({ slides, tIs }) ? resolveSlides({ slides, tIs }, "is") : slides}
          design={design}
          onClose={() => setPrintOpen(false)}
        />
      )}

      {addOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setAddOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
              <h3 className="font-semibold text-gray-800">Add slide</h3>
              <span className="text-xs text-gray-400">Pick a layout — preview on the right.</span>
              <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                <span>Logo</span>
                <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                  {([["lifeline", "Lifeline"], ["fjarlaekningar", "Fjarlækningar"]] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setAddBrand(v)} className={`px-2.5 py-1 ${addBrand === v ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{label}</button>
                  ))}
                </div>
                <button onClick={() => setAddOpen(false)} className="ml-1 rounded p-1 text-gray-400 hover:text-gray-700" aria-label="Close">✕</button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-[230px_1fr] gap-3 overflow-hidden p-3">
              <div className="overflow-y-auto rounded-md border border-gray-100 bg-gray-50/50 p-1">
                {SLIDE_TYPE_ORDER.map((t) => (
                  <button
                    key={t}
                    onMouseEnter={() => setPreviewType(t)}
                    onFocus={() => setPreviewType(t)}
                    onClick={() => addSlide(t)}
                    className={`block w-full rounded px-2.5 py-2 text-left ${previewType === t ? "bg-white shadow-sm ring-1 ring-emerald-300" : "hover:bg-white"}`}
                  >
                    <div className="text-sm font-medium text-gray-800">{SLIDE_SCHEMAS[t].label}</div>
                    <div className="text-[11px] text-gray-400">{SLIDE_SCHEMAS[t].description}</div>
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 flex-col">
                <div className="rounded-md bg-gray-100 p-3">
                  <SlideStage slide={{ ...makeBlankSlide(previewType), brand: addBrand }} design={design} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-500">{SLIDE_SCHEMAS[previewType].label} · {SLIDE_SCHEMAS[previewType].description}</p>
                  <button onClick={() => addSlide(previewType)} className="flex-none rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Add this slide</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
