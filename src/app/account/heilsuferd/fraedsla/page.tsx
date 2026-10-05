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
import BackLink from "@/app/components/hc/BackLink";
import { hcCard, hcKicker, hcPage } from "@/app/components/hc/ui";
import * as cache from "@/lib/hc/client-cache";
import { PILLAR_META, type Pillar } from "@/lib/hc/types";

interface LectureRef {
  slug: string; title: string; subtitle: string | null;
  duration_min: number | null; pillar: string | null; completed?: boolean;
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
  const next = (lectures ?? []).find((l) => !l.completed) ?? null;

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pb-28 pt-24 sm:pb-16 sm:pt-28">
        <div className="mb-1 print:hidden">
          <BackLink href="/account/heilsuferd/adgangur" label="Aðgangurinn minn" />
        </div>
        <JourneyNav active="fraedsla" />

        <section className={`${hcCard.hero} p-6`}>
          <p className={`${hcKicker} text-emerald-300`}>Fræðslan mín</p>
          <h1 className="mt-1 text-2xl font-bold">
            {lectures === null ? "…" : lectures.length === 0 ? "Engin fræðsla í áætluninni" : done === lectures.length ? "Þú hefur klárað allt" : `${done} af ${lectures.length} lokið`}
          </h1>
          {next && <p className="mt-2 text-emerald-100">Næst: {next.title}</p>}
        </section>

        {lectures === null && (
          <div className="animate-pulse space-y-2" aria-busy="true" aria-label="Hleð fræðslu">
            <div className="h-16 rounded-2xl bg-slate-200/70" />
            <div className="h-16 rounded-2xl bg-slate-200/50" />
          </div>
        )}

        {lectures !== null && lectures.length === 0 && (
          <p className={`${hcCard.base} p-6 text-center text-sm text-slate-500`}>
            Fræðsla bætist við áætlunina þegar hún er sett upp.
          </p>
        )}

        {lectures !== null && lectures.length > 0 && (
          <ul className="space-y-2">
            {[...lectures].sort((a, b) => Number(!!a.completed) - Number(!!b.completed)).map((l) => (
              <li key={l.slug}>
                <Link href={`/account/heilsuferd/fraedsla/${l.slug}`}
                  className={`${hcCard.base} flex items-center gap-3 p-4 transition hover:ring-slate-300`}>
                  {l.completed
                    ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" aria-label="Lokið" />
                    : <span className={`h-6 w-6 shrink-0 rounded-full border-2 ${l.slug === next?.slug ? "border-emerald-500" : "border-slate-200"}`} />}
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold ${l.completed ? "text-slate-500" : "text-hc-ink"}`}>{l.title}</span>
                    {l.subtitle && <span className="mt-0.5 block text-sm text-hc-ink-2">{l.subtitle}</span>}
                    <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden />
                      {l.pillar && l.pillar in PILLAR_META ? PILLAR_META[l.pillar as Pillar].label : "Almennt"}
                      {l.duration_min ? ` · ${l.duration_min} mín.` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
