"use client";

// Fræðsla — CMS for the welcome lecture and the lecture series in the
// customer's heilsuferð. A lecture is a video, a slide deck or an article.
// Each slide has its own content type (text, image + text, full image, video,
// quote, list, big number, tip). Media comes from the library (built-in
// graphics + uploads), an upload, or a URL. The live preview uses the exact
// renderer customers see (src/app/components/hc/LectureContent.tsx).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft, ArrowDown, ArrowUp, BarChart3, Bold, Copy, ExternalLink, Eye, EyeOff, FileText, Film, Heading2,
  Image as ImageIcon, Images, Lightbulb, Link2, List, ListOrdered, MessageSquareQuote, Plus, Presentation, Quote,
  Save, Search, Trash2, Upload, X,
} from "lucide-react";
import { useStaffGuard } from "@/lib/useStaffGuard";
import { adminApi, adminJson } from "../hc-api";
import { Markdown, SlideDeck, SlideView, VideoEmbed } from "@/app/components/hc/LectureContent";
import { SLIDE_LAYOUTS, slideLayout, type HcLecture, type LectureSlide, type SlideLayout } from "@/lib/hc/types";

type Row = HcLecture & { completions: number; id: string };
type Draft = Partial<Row> & { kind: HcLecture["kind"]; slides: LectureSlide[] };
interface MediaItem { url: string; name: string; kind: "image" | "video" | "pdf"; builtIn?: boolean }

const PILLARS: { key: NonNullable<HcLecture["pillar"]>; label: string; color: string }[] = [
  { key: "general", label: "Almennt", color: "#10B981" },
  { key: "sleep", label: "Svefn", color: "#767194" },
  { key: "exercise", label: "Hreyfing", color: "#EA580C" },
  { key: "nutrition", label: "Næring", color: "#65A30D" },
  { key: "mental", label: "Andleg líðan", color: "#0EA5E9" },
];
const KINDS: { key: HcLecture["kind"]; label: string; icon: React.ReactNode; hint: string }[] = [
  { key: "video", label: "Myndband", icon: <Film className="h-4 w-4" />, hint: "Eitt myndband, texti undir ef vill" },
  { key: "slides", label: "Glærur", icon: <Presentation className="h-4 w-4" />, hint: "Glærur af ólíkum gerðum" },
  { key: "article", label: "Grein", icon: <FileText className="h-4 w-4" />, hint: "Texti með myndum og myndböndum" },
];
const LAYOUT_ICON: Record<SlideLayout, React.ReactNode> = {
  text: <AlignLeft className="h-4 w-4" />, image: <ImageIcon className="h-4 w-4" />, fullimage: <Images className="h-4 w-4" />,
  video: <Film className="h-4 w-4" />, quote: <Quote className="h-4 w-4" />, bullets: <ListOrdered className="h-4 w-4" />,
  stat: <BarChart3 className="h-4 w-4" />, tip: <Lightbulb className="h-4 w-4" />,
};
const EMPTY: Draft = { title: "", subtitle: "", kind: "slides", video_url: "", slides: [{ layout: "text", title: "", body: "" }], article_md: "", duration_min: 5, pillar: "general", is_welcome: false, sort: 100, published: false };

const btn = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary = `${btn} bg-[#10B981] text-white hover:bg-[#047857]`;
const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const btnGhost = `${btn} text-slate-600 hover:bg-slate-100`;
const btnDanger = `${btn} text-red-600 hover:bg-red-50`;
const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-30";
const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

export default function LecturesAdmin() {
  const { authorized, loading } = useStaffGuard();
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [preview, setPreview] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [media, setMedia] = useState<{ onPick: (url: string) => void; accept: "image" | "video" } | null>(null);

  const load = useCallback(async () => {
    const r = await adminJson<{ lectures: Row[] }>("/api/admin/hc/lectures");
    if (r.ok) setRows(r.data.lectures);
  }, []);
  useEffect(() => {
    if (!authorized) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [authorized, load]);

  // Unsaved-changes guard on tab close.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const change = (patch: Partial<Draft>) => { setEdit((e) => (e ? { ...e, ...patch } : e)); setDirty(true); };

  const open = (d: Draft) => {
    if (dirty && !confirm("Óvistaðar breytingar tapast. Halda áfram?")) return;
    setEdit({ ...d, slides: (d.slides ?? []).map((s) => ({ ...s, layout: slideLayout(s) })) });
    setDirty(false); setMsg(null); setActiveSlide(0);
  };

  const save = useCallback(async (extra: Partial<Draft> = {}) => {
    if (!edit) return;
    setBusy(true); setMsg(null);
    const r = await adminJson<{ lecture: Row }>("/api/admin/hc/lectures", { method: "POST", body: JSON.stringify({ ...edit, ...extra }) });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error || "Villa" }); return; }
    setEdit({ ...r.data.lecture, slides: (r.data.lecture.slides ?? []).map((s) => ({ ...s, layout: slideLayout(s) })) });
    setDirty(false);
    setMsg({ ok: true, text: "Vistað." });
    await load();
  }, [edit, load]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (edit) void save(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [edit, save]);

  const remove = async () => {
    if (!edit?.id || !confirm(`Eyða „${edit.title}“? Þetta er ekki hægt að afturkalla.`)) return;
    await adminApi(`/api/admin/hc/lectures?id=${edit.id}`, { method: "DELETE" });
    setEdit(null); setDirty(false);
    await load();
  };
  const duplicate = () => {
    if (!edit) return;
    open({ ...edit, id: undefined, slug: undefined, title: `${edit.title} (afrit)`, published: false, is_welcome: false });
    setDirty(true);
  };
  const move = async (row: Row, dir: -1 | 1) => {
    const sorted = [...rows].sort((a, b) => a.sort - b.sort);
    const i = sorted.findIndex((r) => r.id === row.id);
    const other = sorted[i + dir];
    if (!other) return;
    // Swap sort values (spread them out first if equal).
    const a = row.sort === other.sort ? row.sort + dir * 5 : other.sort;
    const b = row.sort === other.sort ? other.sort : row.sort;
    await Promise.all([
      adminJson("/api/admin/hc/lectures", { method: "POST", body: JSON.stringify({ ...row, sort: a }) }),
      adminJson("/api/admin/hc/lectures", { method: "POST", body: JSON.stringify({ ...other, sort: b }) }),
    ]);
    await load();
  };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...rows].sort((a, b) => a.sort - b.sort)
      .filter((l) => filter === "all" || (filter === "published" ? l.published : !l.published))
      .filter((l) => !s || l.title.toLowerCase().includes(s) || (l.subtitle || "").toLowerCase().includes(s));
  }, [rows, q, filter]);

  if (loading) return <div className="p-8 text-slate-500">Hleð…</div>;
  if (!authorized) return <div className="p-8 text-slate-500">Aðgangur ekki leyfður.</div>;

  const slides = edit?.slides ?? [];
  const setSlides = (next: LectureSlide[]) => change({ slides: next });

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Fræðsla</h1>
          <p className="text-sm text-slate-500">Móttökufyrirlestur og fyrirlestraröð í heilsuferð viðskiptavina. {rows.filter((r) => r.published).length} birtir af {rows.length}.</p>
        </div>
        <button type="button" onClick={() => open({ ...EMPTY, sort: (Math.max(0, ...rows.map((r) => r.sort)) || 0) + 10 })} className={btnPrimary}>
          <Plus className="h-4 w-4" /> Nýr fyrirlestur
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        {/* ── List ── */}
        <aside className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Leita</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
          </label>
          <div className="flex gap-1" role="group" aria-label="Sía">
            {([["all", "Allt"], ["published", "Birt"], ["draft", "Drög"]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                className={`${btn} flex-1 ${filter === k ? "bg-[#0F172A] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l}</button>
            ))}
          </div>
          <ul className="space-y-2">
            {list.map((l, idx) => {
              const pillar = PILLARS.find((p) => p.key === (l.pillar ?? "general"));
              const kind = KINDS.find((k) => k.key === l.kind);
              return (
                <li key={l.id} className={`rounded-xl border bg-white ${edit?.id === l.id ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200"}`}>
                  <div className="flex items-stretch">
                    <button type="button" onClick={() => open(l)} className="min-w-0 flex-1 rounded-l-xl p-3 text-left hover:bg-slate-50">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: pillar?.color }} aria-hidden />
                        <span className="truncate font-semibold text-slate-800">{l.title}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">{kind?.icon}{kind?.label}</span>
                        <span className={`rounded px-1.5 py-0.5 font-semibold ${l.published ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{l.published ? "Birt" : "Drög"}</span>
                        {l.is_welcome && <span className="rounded bg-slate-900 px-1.5 py-0.5 font-bold text-white">Móttaka</span>}
                        <span>{l.completions} lokið</span>
                      </span>
                    </button>
                    <span className="flex flex-col justify-center border-l border-slate-100 px-1">
                      <button type="button" aria-label={`Færa „${l.title}“ upp`} disabled={idx === 0 || !!q || filter !== "all"} onClick={() => void move(l, -1)} className={iconBtn}><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Færa „${l.title}“ niður`} disabled={idx === list.length - 1 || !!q || filter !== "all"} onClick={() => void move(l, 1)} className={iconBtn}><ArrowDown className="h-4 w-4" /></button>
                    </span>
                  </div>
                </li>
              );
            })}
            {list.length === 0 && <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Ekkert fannst.</li>}
          </ul>
        </aside>

        {/* ── Editor ── */}
        {edit ? (
          <div className="min-w-0">
            <div className="sticky top-0 z-20 -mx-2 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{edit.title || "Nýr fyrirlestur"}</span>
              {dirty && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Óvistað</span>}
              <button type="button" role="switch" aria-checked={!!edit.published} onClick={() => change({ published: !edit.published })}
                className={`${btn} ${edit.published ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                <span className={`relative inline-block h-4 w-7 rounded-full transition ${edit.published ? "bg-emerald-500" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${edit.published ? "left-3.5" : "left-0.5"}`} />
                </span>
                {edit.published ? "Birt" : "Drög"}
              </button>
              <button type="button" onClick={() => setPreview((p) => !p)} aria-pressed={preview} className={btnGhost}>
                {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {preview ? "Fela forskoðun" : "Forskoðun"}
              </button>
              <button type="button" onClick={duplicate} className={btnGhost}><Copy className="h-4 w-4" /> Afrita</button>
              {edit.slug && edit.published && (
                <button type="button" onClick={() => window.open(`/account/heilsuferd/fraedsla/${edit.slug}`, "_blank", "noopener")} className={btnGhost}>
                  <ExternalLink className="h-4 w-4" /> Opna á vef
                </button>
              )}
              {edit.id && <button type="button" onClick={remove} className={btnDanger}><Trash2 className="h-4 w-4" /> Eyða</button>}
              <button type="button" onClick={() => void save()} disabled={busy || !dirty} className={btnPrimary} title="Ctrl+S">
                <Save className="h-4 w-4" /> {busy ? "Vistar…" : "Vista"}
              </button>
            </div>
            {msg && <p role="status" className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

            <div className={`grid gap-6 ${preview ? "2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
              <div className="min-w-0 space-y-5">
                {/* Basics */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="mb-3 font-bold text-slate-900">Grunnupplýsingar</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm sm:col-span-2"><span className="font-medium text-slate-700">Titill</span>
                      <input value={edit.title ?? ""} onChange={(e) => change({ title: e.target.value })} className={input} /></label>
                    <label className="text-sm sm:col-span-2"><span className="font-medium text-slate-700">Undirtitill</span>
                      <input value={edit.subtitle ?? ""} onChange={(e) => change({ subtitle: e.target.value })} className={input} /></label>
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-700">Tegund</p>
                  <div className="mt-1 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tegund">
                    {KINDS.map((k) => (
                      <button key={k.key} type="button" role="radio" aria-checked={edit.kind === k.key} onClick={() => change({ kind: k.key })}
                        className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${edit.kind === k.key ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20" : "border-slate-200 hover:bg-slate-50"}`}>
                        <span className="mt-0.5 text-emerald-700">{k.icon}</span>
                        <span><span className="block text-sm font-semibold text-slate-800">{k.label}</span><span className="block text-xs text-slate-500">{k.hint}</span></span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-700">Stoð</p>
                  <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Stoð">
                    {PILLARS.map((p) => (
                      <button key={p.key} type="button" role="radio" aria-checked={(edit.pillar ?? "general") === p.key} onClick={() => change({ pillar: p.key })}
                        className={`${btn} border ${(edit.pillar ?? "general") === p.key ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                        style={(edit.pillar ?? "general") === p.key ? { background: p.color } : undefined}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-4">
                    <label className="text-sm"><span className="font-medium text-slate-700">Lengd (mín.)</span>
                      <input type="number" min={1} value={edit.duration_min ?? ""} onChange={(e) => change({ duration_min: e.target.value ? Number(e.target.value) : null })} className={`${input} w-28`} /></label>
                    <button type="button" role="switch" aria-checked={!!edit.is_welcome} onClick={() => change({ is_welcome: !edit.is_welcome })}
                      className={`${btn} ${edit.is_welcome ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
                      {edit.is_welcome ? "✓ " : ""}Móttökufyrirlestur (skref 3)
                    </button>
                    {edit.slug && <span className="text-xs text-slate-400">Slóð: /fraedsla/{edit.slug}</span>}
                  </div>
                </section>

                {/* Video */}
                {edit.kind === "video" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="mb-3 font-bold text-slate-900">Myndband</h2>
                    <VideoField value={edit.video_url ?? ""} onChange={(v) => change({ video_url: v })} onLibrary={(cb) => setMedia({ onPick: cb, accept: "video" })} />
                  </section>
                )}

                {/* Slides */}
                {edit.kind === "slides" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="font-bold text-slate-900">Glærur <span className="font-normal text-slate-400">({slides.length})</span></h2>
                    </div>
                    <ol className="space-y-3">
                      {slides.map((s, i) => (
                        <SlideEditor
                          key={i}
                          index={i}
                          count={slides.length}
                          slide={s}
                          active={activeSlide === i}
                          onFocus={() => setActiveSlide(i)}
                          onChange={(patch) => setSlides(slides.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
                          onMove={(dir) => {
                            const c = [...slides];
                            const [it] = c.splice(i, 1);
                            c.splice(i + dir, 0, it);
                            setSlides(c);
                            setActiveSlide(i + dir);
                          }}
                          onDuplicate={() => { const c = [...slides]; c.splice(i + 1, 0, { ...s }); setSlides(c); setActiveSlide(i + 1); }}
                          onDelete={() => { if (confirm(`Eyða glæru ${i + 1}?`)) { setSlides(slides.filter((_, j) => j !== i)); setActiveSlide(Math.max(0, i - 1)); } }}
                          onLibrary={(accept, cb) => setMedia({ onPick: cb, accept })}
                        />
                      ))}
                    </ol>
                    <AddSlide onAdd={(layout) => { setSlides([...slides, { layout, title: "", body: "", items: layout === "bullets" ? [""] : undefined }]); setActiveSlide(slides.length); }} />
                  </section>
                )}

                {/* Article / text below */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="mb-1 font-bold text-slate-900">{edit.kind === "article" ? "Grein" : "Texti undir (valfrjálst)"}</h2>
                  <p className="mb-3 text-xs text-slate-500">Notaðu hnappana til að setja inn fyrirsagnir, lista, myndir, myndbönd og ábendingar.</p>
                  <MarkdownEditor value={edit.article_md ?? ""} onChange={(v) => change({ article_md: v })} onLibrary={(accept, cb) => setMedia({ onPick: cb, accept })} rows={edit.kind === "article" ? 18 : 8} />
                </section>
              </div>

              {preview && (
                <div className="min-w-0">
                  <div className="sticky top-20 rounded-2xl border border-slate-200 bg-gradient-to-b from-[#f8fafc] to-[#ecfdf5] p-5">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Forskoðun · eins og viðskiptavinur sér</p>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Fræðsla{edit.duration_min ? ` · ${edit.duration_min} mín.` : ""}</p>
                    <h1 className="mt-1 text-2xl font-bold text-[#0F172A]">{edit.title || "Titill"}</h1>
                    {edit.subtitle && <p className="text-slate-500">{edit.subtitle}</p>}
                    <div className="mt-4 max-h-[70vh] space-y-6 overflow-y-auto pr-1">
                      {edit.kind === "video" && (edit.video_url ? <VideoEmbed url={edit.video_url} title={edit.title || "Myndband"} /> : <Placeholder text="Ekkert myndband valið" />)}
                      {edit.kind === "slides" && <SlideDeck key={`${activeSlide}-${slides.length}`} slides={slides} start={activeSlide} />}
                      {edit.article_md && <Markdown text={edit.article_md} />}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            Veldu fyrirlestur til vinstri eða búðu til nýjan.
            <button type="button" onClick={() => open({ ...EMPTY })} className={btnSecondary}><Plus className="h-4 w-4" /> Nýr fyrirlestur</button>
          </div>
        )}
      </div>

      {media && <MediaPicker accept={media.accept} onClose={() => setMedia(null)} onPick={(url) => { media.onPick(url); setMedia(null); }} />}
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <div className="flex aspect-video items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-sm text-slate-500">{text}</div>;
}

// ── One slide ───────────────────────────────────────────────────────────────

function SlideEditor({ index, count, slide, active, onFocus, onChange, onMove, onDuplicate, onDelete, onLibrary }: {
  index: number; count: number; slide: LectureSlide; active: boolean;
  onFocus: () => void;
  onChange: (p: Partial<LectureSlide>) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLibrary: (accept: "image" | "video", cb: (url: string) => void) => void;
}) {
  const layout = slideLayout(slide);
  const [showLayouts, setShowLayouts] = useState(false);
  const meta = SLIDE_LAYOUTS.find((l) => l.key === layout)!;
  const field = (label: string, el: React.ReactNode) => <label className="block text-sm"><span className="font-medium text-slate-700">{label}</span>{el}</label>;

  return (
    <li onFocusCapture={onFocus} onClick={onFocus}
      className={`rounded-xl border transition ${active ? "border-emerald-400 ring-2 ring-emerald-500/15" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{index + 1}</span>
        <button type="button" aria-expanded={showLayouts} onClick={() => setShowLayouts((v) => !v)} className={btnSecondary}>
          {LAYOUT_ICON[layout]} {meta.label} <span className="text-slate-400">▾</span>
        </button>
        <span className="flex-1" />
        <button type="button" aria-label="Færa upp" disabled={index === 0} onClick={() => onMove(-1)} className={iconBtn}><ArrowUp className="h-4 w-4" /></button>
        <button type="button" aria-label="Færa niður" disabled={index === count - 1} onClick={() => onMove(1)} className={iconBtn}><ArrowDown className="h-4 w-4" /></button>
        <button type="button" aria-label="Afrita glæru" onClick={onDuplicate} className={iconBtn}><Copy className="h-4 w-4" /></button>
        <button type="button" aria-label="Eyða glæru" onClick={onDelete} className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}><Trash2 className="h-4 w-4" /></button>
      </div>

      {showLayouts && (
        <div className="grid grid-cols-2 gap-2 border-b border-slate-100 bg-slate-50 p-3 sm:grid-cols-4" role="radiogroup" aria-label="Gerð glæru">
          {SLIDE_LAYOUTS.map((l) => (
            <button key={l.key} type="button" role="radio" aria-checked={layout === l.key}
              onClick={() => { onChange({ layout: l.key, items: l.key === "bullets" && !slide.items?.length ? [""] : slide.items }); setShowLayouts(false); }}
              className={`flex flex-col items-start gap-1 rounded-lg border p-2 text-left text-xs transition ${layout === l.key ? "border-emerald-500 bg-white ring-2 ring-emerald-500/20" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <span className="flex items-center gap-1.5 font-semibold text-slate-800">{LAYOUT_ICON[l.key]}{l.label}</span>
              <span className="text-slate-500">{l.hint}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 p-3 lg:grid-cols-[1fr_200px]">
        <div className="space-y-3">
          {layout === "stat" && field("Stór tala", <input value={slide.stat ?? ""} onChange={(e) => onChange({ stat: e.target.value })} placeholder="t.d. 7–9 klst." className={input} />)}
          {layout !== "quote" && field(layout === "fullimage" ? "Fyrirsögn (valfrjálst)" : "Fyrirsögn", <input value={slide.title} onChange={(e) => onChange({ title: e.target.value })} className={input} />)}
          {layout !== "fullimage" && layout !== "video" && field(layout === "quote" ? "Tilvitnun" : layout === "bullets" ? "Inngangur (valfrjálst)" : "Texti",
            <textarea value={slide.body} onChange={(e) => onChange({ body: e.target.value })} rows={layout === "quote" ? 3 : 3} className={input} />)}
          {layout === "bullets" && (
            <div>
              <p className="text-sm font-medium text-slate-700">Punktar</p>
              <div className="mt-1 space-y-1.5">
                {(slide.items ?? []).map((it, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="w-5 text-right text-xs font-bold text-slate-400">{j + 1}</span>
                    <input value={it} onChange={(e) => onChange({ items: (slide.items ?? []).map((x, k) => (k === j ? e.target.value : x)) })} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    <button type="button" aria-label={`Eyða punkti ${j + 1}`} onClick={() => onChange({ items: (slide.items ?? []).filter((_, k) => k !== j) })} className={iconBtn}><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => onChange({ items: [...(slide.items ?? []), ""] })} className={`${btnGhost} mt-2`}><Plus className="h-4 w-4" /> Bæta við punkti</button>
            </div>
          )}
          {(layout === "image" || layout === "fullimage") && (
            <ImageField value={slide.image_url ?? ""} onChange={(v) => onChange({ image_url: v || null })} onLibrary={(cb) => onLibrary("image", cb)} />
          )}
          {layout === "video" && <VideoField value={slide.video_url ?? ""} onChange={(v) => onChange({ video_url: v || null })} onLibrary={(cb) => onLibrary("video", cb)} />}
          {(layout === "fullimage" || layout === "video" || layout === "quote") &&
            field(layout === "quote" ? "Höfundur" : "Myndatexti", <input value={slide.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} className={input} />)}
        </div>
        <div className="hidden lg:block">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Smámynd</p>
          <div className="h-[140px] overflow-hidden rounded-lg" aria-hidden>
            <div className="pointer-events-none origin-top-left scale-[0.33] [width:303%]">
              <SlideView slide={slide} />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function AddSlide({ onAdd }: { onAdd: (l: SlideLayout) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={`${btnSecondary} w-full border-dashed`}><Plus className="h-4 w-4" /> Bæta við glæru</button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Veldu gerð glæru</p>
            <button type="button" aria-label="Loka" onClick={() => setOpen(false)} className={iconBtn}><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SLIDE_LAYOUTS.map((l) => (
              <button key={l.key} type="button" onClick={() => { onAdd(l.key); setOpen(false); }}
                className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 bg-white p-2 text-left text-xs hover:border-emerald-400 hover:bg-emerald-50">
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">{LAYOUT_ICON[l.key]}{l.label}</span>
                <span className="text-slate-500">{l.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Media fields ────────────────────────────────────────────────────────────

async function uploadFile(file: File): Promise<{ url?: string; error?: string }> {
  const fd = new FormData();
  fd.set("file", file);
  const r = await adminApi("/api/admin/hc/lectures/upload", { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { url: j.url } : { error: j.error || "Upphleðsla mistókst." };
}

function UploadButton({ accept, onUploaded, label }: { accept: string; onUploaded: (url: string) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" tabIndex={-1}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true); setErr("");
          const r = await uploadFile(f);
          setBusy(false);
          if (r.url) onUploaded(r.url); else setErr(r.error || "");
        }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className={btnSecondary}>
        <Upload className="h-4 w-4" /> {busy ? "Hleð upp…" : label}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </>
  );
}

function ImageField({ value, onChange, onLibrary }: { value: string; onChange: (v: string) => void; onLibrary: (cb: (url: string) => void) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">Mynd</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {value && (
          <span className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-16 w-24 rounded-lg border border-slate-200 bg-white object-contain" />
          </span>
        )}
        <button type="button" onClick={() => onLibrary(onChange)} className={btnSecondary}><Images className="h-4 w-4" /> Úr safni</button>
        <UploadButton accept="image/*" label="Hlaða upp" onUploaded={onChange} />
        {value && <button type="button" onClick={() => onChange("")} className={btnDanger}><X className="h-4 w-4" /> Fjarlægja</button>}
      </div>
    </div>
  );
}

function VideoField({ value, onChange, onLibrary }: { value: string; onChange: (v: string) => void; onLibrary: (cb: (url: string) => void) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="space-y-2">
      <label className="block text-sm"><span className="font-medium text-slate-700">Slóð á myndband (YouTube, Vimeo eða mp4)</span>
        <span className="mt-1 flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== value && onChange(draft.trim())}
            placeholder="https://www.youtube.com/watch?v=…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" onClick={() => onChange(draft.trim())} className={btnSecondary}><Link2 className="h-4 w-4" /> Nota</button>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onLibrary((u) => { setDraft(u); onChange(u); })} className={btnSecondary}><Film className="h-4 w-4" /> Úr safni</button>
        <UploadButton accept="video/mp4,video/webm" label="Hlaða upp mp4" onUploaded={(u) => { setDraft(u); onChange(u); }} />
        {value && <button type="button" onClick={() => { setDraft(""); onChange(""); }} className={btnDanger}><X className="h-4 w-4" /> Fjarlægja</button>}
      </div>
      {value && <div className="max-w-md"><VideoEmbed url={value} title="Forskoðun" /></div>}
    </div>
  );
}

// ── Markdown editor with a real toolbar ─────────────────────────────────────

function MarkdownEditor({ value, onChange, onLibrary, rows }: {
  value: string; onChange: (v: string) => void; rows: number;
  onLibrary: (accept: "image" | "video", cb: (url: string) => void) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (before: string, after = "", block = false) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const sel = value.slice(start, end);
    const pre = block && start > 0 && !value.slice(0, start).endsWith("\n\n") ? (value.slice(0, start).endsWith("\n") ? "\n" : "\n\n") : "";
    const post = block ? "\n\n" : "";
    const next = value.slice(0, start) + pre + before + sel + after + post + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + pre.length + before.length + sel.length + after.length + post.length;
      el.focus(); el.setSelectionRange(pos, pos);
    });
  };
  const tools: { label: string; icon: React.ReactNode; run: () => void }[] = [
    { label: "Millifyrirsögn", icon: <Heading2 className="h-4 w-4" />, run: () => insert("## ", "", true) },
    { label: "Feitletrað", icon: <Bold className="h-4 w-4" />, run: () => insert("**", "**") },
    { label: "Listi", icon: <List className="h-4 w-4" />, run: () => insert("- ", "", true) },
    { label: "Ábending", icon: <MessageSquareQuote className="h-4 w-4" />, run: () => insert("> ", "", true) },
    { label: "Mynd", icon: <ImageIcon className="h-4 w-4" />, run: () => onLibrary("image", (url) => insert(`![Myndatexti](${url})`, "", true)) },
    { label: "Myndband", icon: <Film className="h-4 w-4" />, run: () => onLibrary("video", (url) => insert(`@[video](${url}) | Lýsing á myndbandi`, "", true)) },
  ];
  return (
    <div className="rounded-xl border border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-1.5" role="toolbar" aria-label="Snið">
        {tools.map((t) => (
          <button key={t.label} type="button" onClick={t.run} title={t.label} className={`${btnGhost} min-h-8 px-2`}>
            {t.icon}<span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="block w-full resize-y rounded-b-xl px-3 py-2 font-mono text-sm focus:outline-none" />
    </div>
  );
}

// ── Media library ───────────────────────────────────────────────────────────

function MediaPicker({ accept, onClose, onPick }: { accept: "image" | "video"; onClose: () => void; onPick: (url: string) => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [tab, setTab] = useState<"library" | "upload" | "url">("library");
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    adminJson<{ items: MediaItem[] }>("/api/admin/hc/lectures/upload").then((r) => { if (alive) setItems(r.ok ? r.data.items : []); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { alive = false; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const shown = (items ?? []).filter((i) => i.kind === accept);
  const drop = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr("");
    const r = await uploadFile(f);
    setBusy(false);
    if (r.url) onPick(r.url); else setErr(r.error || "");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Myndasafn" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold">{accept === "image" ? "Velja mynd" : "Velja myndband"}</h2>
          <button type="button" aria-label="Loka" onClick={onClose} className={iconBtn}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-1 border-b border-slate-200 px-5 py-2" role="tablist">
          {([["library", "Safn"], ["upload", "Hlaða upp"], ["url", "Slóð"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`${btn} ${tab === k ? "bg-[#0F172A] text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l}</button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {tab === "library" && (
            items === null ? <p className="text-sm text-slate-500">Hleð…</p>
              : shown.length === 0 ? <p className="text-sm text-slate-500">Ekkert í safninu enn. Hladdu upp eða notaðu slóð.</p>
              : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {shown.map((m) => (
                    <button key={m.url} type="button" onClick={() => onPick(m.url)}
                      className="group overflow-hidden rounded-xl border border-slate-200 text-left transition hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                      {m.kind === "image"
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.url} alt="" className="aspect-[4/3] w-full bg-slate-50 object-contain" loading="lazy" />
                        : <video src={m.url} className="aspect-video w-full bg-black" muted />}
                      <span className="block truncate px-2 py-1.5 text-xs text-slate-600">{m.builtIn ? "★ " : ""}{m.name}</span>
                    </button>
                  ))}
                </div>
              )
          )}
          {tab === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void drop(e.dataTransfer.files?.[0]); }}
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center text-sm ${dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300"}`}>
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="text-slate-600">Dragðu skrá hingað eða</p>
              <UploadButton accept={accept === "image" ? "image/*" : "video/mp4,video/webm"} label={busy ? "Hleð upp…" : "Velja skrá"} onUploaded={onPick} />
              <p className="text-xs text-slate-400">{accept === "image" ? "PNG, JPG, WEBP, GIF eða SVG" : "MP4 eða WEBM, allt að 200 MB"}</p>
              {err && <p className="text-sm text-red-600">{err}</p>}
            </div>
          )}
          {tab === "url" && (
            <div className="space-y-3">
              <label className="block text-sm"><span className="font-medium text-slate-700">{accept === "image" ? "Slóð á mynd" : "Slóð á YouTube, Vimeo eða mp4"}</span>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={input} autoFocus /></label>
              {url && accept === "video" && <div className="max-w-md"><VideoEmbed url={url} title="Forskoðun" /></div>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {url && accept === "image" && <img src={url} alt="" className="max-h-48 rounded-lg border border-slate-200" />}
              <button type="button" disabled={!/^(https?:\/\/|\/)/.test(url.trim())} onClick={() => onPick(url.trim())} className={btnPrimary}>Nota þessa slóð</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
