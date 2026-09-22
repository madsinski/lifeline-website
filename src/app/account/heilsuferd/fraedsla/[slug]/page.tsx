"use client";

// Lecture viewer: video, slide presentation or article. Marking it done
// (or reaching the last slide) records progress; the welcome lecture ticks
// the journey's welcome step.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { HcLecture } from "@/lib/hc/types";

async function authed(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), "Content-Type": "application/json" } });
}

/** YouTube / Vimeo page URLs → embeddable URLs. Anything else plays as a file. */
function embedUrl(url: string): { kind: "iframe" | "file"; src: string } {
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/.exec(url);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  return { kind: "file", src: url };
}

/** Minimal, safe markdown: headings, lists, paragraphs, bold/italic. No HTML passes through. */
function Markdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
      part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part.startsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em>
          : part);
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-4 text-[17px] leading-relaxed text-slate-700">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (/^#{1,3}\s/.test(b)) {
          const level = b.match(/^#+/)![0].length;
          const t = b.replace(/^#+\s*/, "");
          return level === 1
            ? <h2 key={i} className="pt-2 text-2xl font-bold text-[#0F172A]">{inline(t)}</h2>
            : <h3 key={i} className="pt-2 text-xl font-bold text-[#0F172A]">{inline(t)}</h3>;
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
        return <p key={i}>{inline(b.replace(/\n/g, " "))}</p>;
      })}
    </div>
  );
}

export default function LecturePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [lecture, setLecture] = useState<HcLecture | null>(null);
  const [done, setDone] = useState(false);
  const [next, setNext] = useState<{ slug: string; title: string } | null>(null);
  const [slide, setSlide] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const r = await authed(`/api/hc/lectures/${slug}`);
      if (r.status === 401) { router.replace(`/account/login?next=${encodeURIComponent(`/account/heilsuferd/fraedsla/${slug}`)}`); return; }
      if (!r.ok) { setError("Fyrirlesturinn fannst ekki."); return; }
      const j = await r.json();
      setLecture(j.lecture);
      setDone(!!j.completed_at);
      setNext(j.next);
    })();
  }, [slug, router]);

  const complete = useCallback(async () => {
    if (done) return;
    await authed(`/api/hc/lectures/${slug}`, { method: "POST", body: JSON.stringify({ action: "complete" }) });
    setDone(true);
  }, [done, slug]);

  const slides = lecture?.slides ?? [];
  useEffect(() => {
    if (!(lecture?.kind === "slides" && slides.length && slide === slides.length - 1)) return;
    const t = setTimeout(() => void complete(), 0);
    return () => clearTimeout(t);
  }, [lecture, slide, slides.length, complete]);

  useEffect(() => {
    if (lecture?.kind !== "slides") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setSlide((s) => Math.min(s + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setSlide((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lecture, slides.length]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#ecfdf5]">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:pt-28">
        <Link href="/account/heilsuferd" className="text-sm font-medium text-slate-500 hover:text-slate-800">← Heilsuferðin</Link>
        {error && <p className="mt-8 text-slate-600">{error}</p>}
        {lecture && (
          <article className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Fræðsla{lecture.duration_min ? ` · ${lecture.duration_min} mín.` : ""}</p>
            <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">{lecture.title}</h1>
            {lecture.subtitle && <p className="mt-1 text-lg text-slate-500">{lecture.subtitle}</p>}

            <div className="mt-6">
              {lecture.kind === "video" && lecture.video_url && (() => {
                const v = embedUrl(lecture.video_url);
                return (
                  <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-lg">
                    {v.kind === "iframe"
                      ? <iframe src={v.src} title={lecture.title} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
                      : <video src={v.src} controls className="h-full w-full" onEnded={() => void complete()} />}
                  </div>
                );
              })()}

              {lecture.kind === "slides" && slides.length > 0 && (
                <div>
                  <div className="relative flex aspect-[16/10] flex-col justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2A23] to-[#065F46] p-8 text-white shadow-lg sm:p-12">
                    {slides[slide].image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slides[slide].image_url!} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
                    )}
                    <div className="relative">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{slide + 1} / {slides.length}</p>
                      <h2 className="mt-3 text-2xl font-bold sm:text-4xl">{slides[slide].title}</h2>
                      <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-emerald-50 sm:text-xl">{slides[slide].body}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <button onClick={() => setSlide((s) => Math.max(0, s - 1))} disabled={slide === 0} className="rounded-full border border-slate-200 px-5 py-2 font-semibold text-slate-700 disabled:opacity-30">← Fyrri</button>
                    <div className="flex gap-1.5" aria-hidden>
                      {slides.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-[#10B981]" : "w-1.5 bg-slate-300"}`} />)}
                    </div>
                    <button onClick={() => setSlide((s) => Math.min(slides.length - 1, s + 1))} disabled={slide === slides.length - 1} className="rounded-full bg-[#10B981] px-5 py-2 font-semibold text-white disabled:opacity-30">Næsta →</button>
                  </div>
                </div>
              )}

              {(lecture.kind === "article" || lecture.article_md) && lecture.article_md && (
                <div className={lecture.kind === "article" ? "" : "mt-8"}><Markdown text={lecture.article_md} /></div>
              )}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
              {done
                ? <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">✓ Lokið</span>
                : lecture.kind !== "slides" && <button onClick={complete} className="rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857]">Merkja sem lokið</button>}
              <span className="flex-1" />
              {next
                ? <Link href={`/account/heilsuferd/fraedsla/${next.slug}`} className="text-sm font-semibold text-slate-700 hover:text-slate-900">Næsti: {next.title} →</Link>
                : <Link href="/account/heilsuferd" className="text-sm font-semibold text-slate-700">Aftur í heilsuferðina →</Link>}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
