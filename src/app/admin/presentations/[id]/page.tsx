"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  SLIDE_SCHEMAS, SLIDE_TYPE_ORDER, makeBlankSlide, DESIGNS,
  type Slide, type SlideType, type SlideTheme, type PresentationData, type DesignId,
} from "@/lib/presentations/types";
import { Deck, SlideStage } from "@/app/components/presentation/Deck";
import { SlideFields } from "../_components/SlideFields";

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
  const [sel, setSel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [present, setPresent] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
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
      setSlides(((p.data as PresentationData)?.slides) ?? []);
      setDesign(((p.data as PresentationData)?.design) ?? "lifeline");
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
          body: JSON.stringify({ title, data: { slides, design } }),
        });
        setSave(res.ok ? "saved" : "error");
      } catch { setSave("error"); }
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [title, slides, design, loaded, id]);

  const selected = slides[sel] ?? null;

  const updateSlide = useCallback((next: Slide) => {
    setSlides((prev) => prev.map((s, i) => (i === sel ? next : s)));
  }, [sel]);

  function addSlide(type: SlideType) {
    const ns = makeBlankSlide(type);
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
        <button onClick={togglePublish} className={`rounded-md px-3 py-1.5 text-sm font-medium ${published ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
          {published ? "Published" : "Publish"}
        </button>
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
          <div className="relative">
            <button onClick={() => setAddOpen((v) => !v)} className="mt-1 w-full rounded-md border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">+ Add slide</button>
            {addOpen && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                {SLIDE_TYPE_ORDER.map((t) => (
                  <button key={t} onClick={() => addSlide(t)} className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-emerald-50">
                    <span className="font-medium">{SLIDE_SCHEMAS[t].label}</span>
                    <span className="ml-1 text-[11px] text-gray-400">{SLIDE_SCHEMAS[t].description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* preview */}
        <div className="overflow-y-auto bg-gray-100 p-6">
          <SlideStage slide={selected} design={design} />
          {selected && (
            <p className="mt-3 text-center text-xs text-gray-400">Slide {sel + 1} of {slides.length} · {SLIDE_SCHEMAS[selected.type].label}</p>
          )}
        </div>

        {/* field editor */}
        <div className="overflow-y-auto border-l border-gray-100 bg-white p-4">
          {selected ? (
            <>
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{SLIDE_SCHEMAS[selected.type].label}</span>
                <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                  Theme:
                  <select
                    value={selected.theme}
                    onChange={(e) => updateSlide({ ...selected, theme: e.target.value as SlideTheme })}
                    className="rounded border border-gray-300 px-1.5 py-0.5"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>

              <SlideFields slide={selected} presentationId={id!} onChange={updateSlide} />

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
            </>
          ) : (
            <p className="text-gray-400">Add a slide to begin.</p>
          )}
        </div>
      </div>

      {present && <Deck slides={slides} design={design} initialIndex={sel} onClose={() => setPresent(false)} />}
    </div>
  );
}
