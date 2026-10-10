"use client";

// "Fræðslan mín": the lectures in this participant's plan.
//
// Lived at the bottom of "Í dag" and took a whole card there for a list that
// is read once a week at most. It is a tab of its own now, so the daily
// surface stays about today.

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import JourneyNav from "@/app/components/hc/JourneyNav";
import { hcCard, hcKicker, hcPage } from "@/app/components/hc/ui";
import * as cache from "@/lib/hc/client-cache";
import { PILLAR_META, type Pillar } from "@/lib/hc/types";

/** Pillars in the journey's own order, then anything unfiled. */
const PILLAR_ORDER = ["sleep", "exercise", "nutrition", "mental", "general"] as const;

interface LectureRef {
  slug: string; title: string; subtitle: string | null;
  duration_min: number | null; pillar: string | null; completed?: boolean;
}

/** Completion as a ring, the same sign the hero uses for the day. */
function Ring({ done, of }: { done: number; of: number }) {
  const share = of > 0 ? done / of : 0;
  const R = 16, C = 2 * Math.PI * R;
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center text-hc-brand"
      aria-label={`${done} af ${of} lokið`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" strokeWidth="3.5" className="opacity-15" />
        <circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - share)} style={{ transition: "stroke-dashoffset 400ms" }} />
      </svg>
      <span className="relative text-xs font-bold tabular-nums text-hc-ink">{done}/{of}</span>
    </span>
  );
}

export default function FraedslaPage() {
  return <Suspense><Fraedsla /></Suspense>;
}

function Fraedsla() {
  const router = useRouter();
  const [lectures, setLectures] = useState<LectureRef[] | null>(null);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace(`/account/login?next=${encodeURIComponent("/account/heilsuferd/fraedsla")}`); return; }
      const seed = cache.peek<{ lectures?: LectureRef[] }>("/api/hc/plan");
      if (seed?.body?.lectures) setLectures(seed.body.lectures);
      const r = await cache.load(api, "/api/hc/plan");
      setLectures(((r.body as { lectures?: LectureRef[] }).lectures) ?? []);
    })();
  }, [api, router]);

  const done = (lectures ?? []).filter((l) => l.completed).length;
  /** Everything except the one offered at the top, so it is not listed twice. */
  const rest = (lectures ?? []).filter((l) => l.slug !== next?.slug);
  const next = (lectures ?? []).find((l) => !l.completed) ?? null;

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        {/* Nav first and no back link, like every other page in the journey:
            the navbar carries "Aðgangurinn minn", and a back link from
            Fræðsla to the account was a route nobody asked for. */}
        <div className="sm:mb-4"><JourneyNav active="fraedsla" /></div>

        {/* A line, not a hero.
            The page used to open with a gradient card announcing "3 af 7
            lokið" — status above the thing to do, which is the pattern Í dag
            and Æfingar both moved away from. The count is a ring on the
            title line now, and the space goes to the next lecture. */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className={`${hcKicker} text-hc-brand-dark`}>Fræðslan mín</p>
            <h1 className="text-2xl font-bold text-hc-ink sm:text-3xl">Fræðsla</h1>
          </div>
          {!!lectures?.length && <Ring done={done} of={lectures.length} />}
        </div>

        {lectures === null && (
          <div className="animate-pulse space-y-2" aria-busy="true" aria-label="Hleð fræðslu">
            <div className="h-28 rounded-hc-card bg-slate-200/70" />
            <div className="h-16 rounded-hc-card bg-slate-200/50" />
          </div>
        )}

        {lectures !== null && lectures.length === 0 && (
          <p className={`${hcCard.base} p-6 text-center text-sm text-slate-500`}>
            Fræðsla bætist við áætlunina þegar hún er sett upp.
          </p>
        )}

        {/* The next one, given the room the status card used to take. This
            is the "Æfing dagsins" treatment: the page leads with the thing
            to do, and the list of everything else follows. */}
        {next && (
          <Link href={`/account/heilsuferd/fraedsla/${next.slug}`}
            className={`${hcCard.hero} flex flex-col p-5 transition hover:shadow-hc-raised`}>
            <span className={`${hcKicker} text-emerald-200`}>Næsta fræðsla</span>
            <span className="mt-1 text-xl font-bold leading-tight">{next.title}</span>
            {next.subtitle && <span className="mt-1 text-sm text-emerald-50/90">{next.subtitle}</span>}
            <span className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4" aria-hidden />
              {next.duration_min ? `${next.duration_min} mín.` : "Opna"} →
            </span>
          </Link>
        )}

        {/* Grouped by pillar, with each row wearing its own colour — the
            same way the Í dag checklist reads now. Completed ones sink to
            the bottom of their group rather than vanishing: finished is
            worth seeing. */}
        {PILLAR_ORDER.map((p) => {
          const rows = rest.filter((l) => (l.pillar && l.pillar in PILLAR_META ? l.pillar : "general") === p);
          if (!rows.length) return null;
          const meta = p === "general" ? null : PILLAR_META[p as Pillar];
          return (
            <section key={p} className={`${hcCard.base} overflow-hidden`}>
              <p className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em]"
                style={meta ? { background: meta.soft, color: meta.ink } : { background: "#F1F5F9", color: "#475569" }}>
                {meta ? meta.label : "Almennt"}
              </p>
              <ul className="divide-y divide-slate-100">
                {rows.map((l) => (
                  <li key={l.slug}>
                    <Link href={`/account/heilsuferd/fraedsla/${l.slug}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                      {l.completed
                        ? <CheckCircle2 className="h-6 w-6 shrink-0 text-hc-brand-dark" aria-label="Lokið" />
                        : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-200" aria-hidden />}
                      <span className="min-w-0 flex-1">
                        <span className={`block font-semibold ${l.completed ? "text-slate-400" : "text-hc-ink"}`}>{l.title}</span>
                        {l.subtitle && <span className="mt-0.5 block truncate text-sm text-slate-500">{l.subtitle}</span>}
                      </span>
                      {l.duration_min ? <span className="shrink-0 text-sm tabular-nums text-slate-400">{l.duration_min} mín.</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
