"use client";

// Lecture viewer: video, slide presentation or article. Marking it done
// (or reaching the last slide) records progress; the welcome lecture ticks
// the journey's welcome step. Rendering is shared with the admin preview
// (src/app/components/hc/LectureContent.tsx).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import BackLink from "@/app/components/hc/BackLink";
import { Markdown, SlideDeck, VideoEmbed } from "@/app/components/hc/LectureContent";
import type { HcLecture } from "@/lib/hc/types";

async function authed(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), "Content-Type": "application/json" } });
}

export default function LecturePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [lecture, setLecture] = useState<HcLecture | null>(null);
  const [done, setDone] = useState(false);
  const [next, setNext] = useState<{ slug: string; title: string } | null>(null);
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
    setDone(true);
    await authed(`/api/hc/lectures/${slug}`, { method: "POST", body: JSON.stringify({ action: "complete" }) });
  }, [done, slug]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#ecfdf5]">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:pt-28">
        <BackLink href="/account/heilsuferd" label="Heilsuferðin" />
        {error && <p className="mt-8 text-slate-600">{error}</p>}
        {lecture && (
          <article className="mt-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Fræðsla{lecture.duration_min ? ` · ${lecture.duration_min} mín.` : ""}</p>
            <h1 className="mt-2 text-3xl font-bold text-[#0F172A]">{lecture.title}</h1>
            {lecture.subtitle && <p className="mt-1 text-lg text-slate-500">{lecture.subtitle}</p>}

            <div className="mt-6">
              {lecture.kind === "video" && lecture.video_url && (
                <VideoEmbed url={lecture.video_url} title={lecture.title} onEnded={() => void complete()} />
              )}
              {lecture.kind === "slides" && <SlideDeck slides={lecture.slides ?? []} onLastSlide={() => void complete()} />}
              {lecture.article_md && (
                <div className={lecture.kind === "article" ? "" : "mt-8"}><Markdown text={lecture.article_md} /></div>
              )}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
              {done
                ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden /> Lokið</span>
                : lecture.kind !== "slides" && (
                  <button type="button" onClick={() => void complete()} className="min-h-11 rounded-full bg-[#10B981] px-5 font-semibold text-white hover:bg-[#047857]">
                    Merkja sem lokið
                  </button>
                )}
              <span className="flex-1" />
              {next
                ? <Link href={`/account/heilsuferd/fraedsla/${next.slug}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                    Næsti: {next.title} <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                : <BackLink href="/account/heilsuferd" label="Aftur í heilsuferðina" />}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
