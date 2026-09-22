"use client";

// Rendering for lecture content, shared by the customer viewer
// (/account/heilsuferd/fraedsla/[slug]) and the admin editor's live preview
// (/admin/lectures) — so what staff see is exactly what customers see.

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb, Quote } from "lucide-react";
import { slideLayout, type LectureSlide } from "@/lib/hc/types";

/** YouTube / Vimeo page URLs → embeddable URLs. Anything else plays as a file. */
export function embedUrl(url: string): { kind: "iframe" | "file"; src: string } {
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/.exec(url);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  return { kind: "file", src: url };
}

export function VideoEmbed({ url, title, onEnded }: { url: string; title: string; onEnded?: () => void }) {
  const v = embedUrl(url);
  return (
    <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-lg">
      {v.kind === "iframe"
        ? <iframe src={v.src} title={title} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        : <video src={v.src} controls className="h-full w-full" onEnded={onEnded} />}
    </div>
  );
}

/**
 * Minimal, safe markdown — no HTML passes through. Supports:
 *   ## heading · - list · **bold** · *italic* · > callout
 *   ![caption](/image.svg)                 a figure
 *   @[video](https://youtu.be/…) | caption an embedded video
 */
export function Markdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
      part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part.startsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em>
          : part);
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="space-y-5 text-[17px] leading-relaxed text-slate-700">
      {blocks.map((b, i) => {
        const t = b.trim();
        const lines = t.split("\n");
        const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t);
        if (img) {
          return (
            <figure key={i} className="my-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img[2]} alt={img[1]} className="w-full rounded-2xl border border-slate-100 bg-white shadow-sm" loading="lazy" />
              {img[1] && <figcaption className="mt-2 text-center text-sm text-slate-500">{img[1]}</figcaption>}
            </figure>
          );
        }
        const vid = /^@\[video\]\(([^)\s]+)\)(?:\s*\|\s*(.+))?$/.exec(t);
        if (vid) {
          return (
            <figure key={i} className="my-2">
              <VideoEmbed url={vid[1]} title={vid[2] || "Myndband"} />
              {vid[2] && <figcaption className="mt-2 text-center text-sm text-slate-500">{vid[2]}</figcaption>}
            </figure>
          );
        }
        if (lines.every((l) => /^>\s?/.test(l))) {
          return (
            <aside key={i} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-4 text-[16px] text-emerald-950">
              {inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "))}
            </aside>
          );
        }
        if (/^#{1,3}\s/.test(t)) {
          const level = t.match(/^#+/)![0].length;
          const h = t.replace(/^#+\s*/, "");
          return level === 1
            ? <h2 key={i} className="pt-2 text-2xl font-bold text-[#0F172A]">{inline(h)}</h2>
            : <h3 key={i} className="pt-2 text-xl font-bold text-[#0F172A]">{inline(h)}</h3>;
        }
        if (lines.every((l) => /^\s*[-*]\s/.test(l))) {
          return (
            <ul key={i} className="space-y-2">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#10B981]" />{inline(l.replace(/^\s*[-*]\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(t.replace(/\n/g, " "))}</p>;
      })}
    </div>
  );
}

const DARK = "overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2A23] to-[#065F46] text-white shadow-lg";

/** One slide, laid out by its type. `counter` is e.g. "2 / 6". */
export function SlideView({ slide, counter }: { slide: LectureSlide; counter?: string }) {
  const layout = slideLayout(slide);
  const eyebrow = counter ? <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{counter}</p> : null;
  const body = slide.body ? <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-emerald-50 sm:text-lg">{slide.body}</p> : null;

  switch (layout) {
    case "image":
      return (
        <div className={DARK}>
          <div className="grid min-h-[340px] items-center gap-6 p-7 sm:p-10 md:grid-cols-[1fr_1.15fr]">
            <div>{eyebrow}<h2 className="mt-3 text-2xl font-bold sm:text-3xl">{slide.title}</h2>{body}</div>
            {slide.image_url
              ? <div className="rounded-2xl bg-white/95 p-2 shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.image_url} alt={slide.title} className="h-auto w-full rounded-xl" />
                </div>
              : <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border-2 border-dashed border-white/30 text-sm text-emerald-100">Engin mynd valin</div>}
          </div>
        </div>
      );
    case "fullimage":
      return (
        <figure className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-slate-100">
          {slide.image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={slide.image_url} alt={slide.caption || slide.title} className="h-auto w-full" />
            : <div className="flex aspect-video items-center justify-center bg-slate-100 text-sm text-slate-500">Engin mynd valin</div>}
          {(slide.title || slide.caption) && (
            <figcaption className="px-6 py-4">
              {counter && <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">{counter}</p>}
              {slide.title && <p className="mt-1 text-lg font-bold text-[#0F172A]">{slide.title}</p>}
              {slide.caption && <p className="text-sm text-slate-600">{slide.caption}</p>}
            </figcaption>
          )}
        </figure>
      );
    case "video":
      return (
        <div className={DARK}>
          <div className="p-5 sm:p-8">
            {eyebrow}
            {slide.title && <h2 className="mt-2 text-xl font-bold sm:text-2xl">{slide.title}</h2>}
            <div className="mt-4">
              {slide.video_url
                ? <VideoEmbed url={slide.video_url} title={slide.title || "Myndband"} />
                : <div className="flex aspect-video items-center justify-center rounded-2xl border-2 border-dashed border-white/30 text-sm text-emerald-100">Ekkert myndband valið</div>}
            </div>
            {slide.caption && <p className="mt-3 text-sm text-emerald-100">{slide.caption}</p>}
          </div>
        </div>
      );
    case "quote":
      return (
        <div className={DARK}>
          <div className="flex min-h-[340px] flex-col justify-center p-8 sm:p-12">
            {eyebrow}
            <Quote className="mt-3 h-10 w-10 text-emerald-300" aria-hidden />
            <blockquote className="mt-4 text-2xl font-semibold leading-snug sm:text-3xl">{slide.body || slide.title}</blockquote>
            {slide.caption && <p className="mt-5 text-emerald-200">— {slide.caption}</p>}
          </div>
        </div>
      );
    case "bullets":
      return (
        <div className={DARK}>
          <div className="min-h-[340px] p-8 sm:p-10">
            {eyebrow}
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{slide.title}</h2>
            {slide.body && <p className="mt-3 text-emerald-100">{slide.body}</p>}
            <ul className="mt-6 space-y-3">
              {(slide.items ?? []).filter(Boolean).map((it, i) => (
                <li key={i} className="flex gap-3 text-base sm:text-lg">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-bold text-emerald-200">{i + 1}</span>
                  <span className="text-emerald-50">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "stat":
      return (
        <div className={DARK}>
          <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center sm:p-12">
            {eyebrow}
            <p className="mt-3 bg-gradient-to-r from-emerald-200 to-cyan-200 bg-clip-text text-6xl font-extrabold text-transparent sm:text-8xl">{slide.stat || "—"}</p>
            <h2 className="mt-3 text-xl font-bold sm:text-2xl">{slide.title}</h2>
            {slide.body && <p className="mt-3 max-w-xl text-emerald-100">{slide.body}</p>}
          </div>
        </div>
      );
    case "tip":
      return (
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 to-emerald-50 shadow-lg ring-1 ring-amber-100">
          <div className="flex min-h-[300px] flex-col justify-center gap-4 p-8 sm:flex-row sm:items-center sm:p-12">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-white shadow-md"><Lightbulb className="h-8 w-8" aria-hidden /></span>
            <div>
              {counter && <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">{counter} · Ráð</p>}
              <h2 className="mt-1 text-2xl font-bold text-[#0F172A]">{slide.title}</h2>
              {slide.body && <p className="mt-2 whitespace-pre-line text-lg text-slate-700">{slide.body}</p>}
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className={DARK}>
          <div className="flex min-h-[340px] flex-col justify-center p-8 sm:p-12">
            {eyebrow}<h2 className="mt-3 text-2xl font-bold sm:text-4xl">{slide.title}</h2>{body}
          </div>
        </div>
      );
  }
}

/** A slide deck with previous/next buttons, dots and arrow keys. */
export function SlideDeck({ slides, onLastSlide, start = 0 }: { slides: LectureSlide[]; onLastSlide?: () => void; start?: number }) {
  const [i, setI] = useState(Math.min(start, Math.max(0, slides.length - 1)));
  const last = slides.length - 1;
  const idx = Math.min(i, Math.max(0, last));

  useEffect(() => {
    if (slides.length && idx === last && onLastSlide) {
      const t = setTimeout(onLastSlide, 0);
      return () => clearTimeout(t);
    }
  }, [idx, last, slides.length, onLastSlide]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") setI((s) => Math.min(s + 1, last));
      if (e.key === "ArrowLeft") setI((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  if (!slides.length) return <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Engar glærur enn.</p>;

  return (
    <div>
      <SlideView slide={slides[idx]} counter={`${idx + 1} / ${slides.length}`} />
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setI(Math.max(0, idx - 1))} disabled={idx === 0}
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Fyrri
        </button>
        <div className="flex gap-1.5" role="tablist" aria-label="Glærur">
          {slides.map((_, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === idx} aria-label={`Glæra ${n + 1}`} onClick={() => setI(n)}
              className={`h-2 rounded-full transition-all ${n === idx ? "w-6 bg-[#10B981]" : "w-2 bg-slate-300 hover:bg-slate-400"}`} />
          ))}
        </div>
        <button type="button" onClick={() => setI(Math.min(last, idx + 1))} disabled={idx === last}
          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[#10B981] px-4 font-semibold text-white shadow-sm hover:bg-[#047857] disabled:opacity-30">
          Næsta <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
