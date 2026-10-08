"use client";

// Heima — what today asks of you, and nothing else.
//
// The app's HomeScreen is 3,314 lines and carries AI recommendations, a
// programme chooser, an assessment card and more. That is a dashboard. This
// is the screen someone opens at seven in the morning, so it answers one
// question — what am I meant to do today — and gets out of the way. The rest
// is a tap into Heilsan.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Dumbbell, Utensils } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { PILLARS, PILLAR_META, type ActionPlan, type Pillar } from "@/lib/hc/types";
import { isoDay } from "@/lib/hc/adherence";

interface Loaded {
  journey_id: string;
  plan: ActionPlan | null;
  logs: { action_uid: string; done_on: string }[];
}

const HELLO = () => {
  const h = new Date().getHours();
  if (h < 5) return "Góða nótt";
  if (h < 11) return "Góðan daginn";
  if (h < 18) return "Góðan dag";
  return "Gott kvöld";
};

export default function AppHome() {
  const api = useApi();
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [a, p] = await Promise.all([api("/api/hc/actions"), api("/api/hc/profile")]);
      const aj = a.ok ? await a.json().catch(() => null) : null;
      const pj = p.ok ? await p.json().catch(() => null) : null;
      setTimeout(() => {
        setData(aj ? { journey_id: aj.journey_id, plan: aj.plan ?? null, logs: aj.logs ?? [] } : null);
        setName((pj?.profile?.full_name ?? "").split(" ")[0] || null);
      }, 0);
    })();
  }, [api]);

  const today = isoDay();
  const done = new Set((data?.logs ?? []).filter((l) => l.done_on === today).map((l) => l.action_uid));
  const items = data?.plan?.modules ?? [];
  const left = items.filter((m) => !done.has(m.uid));

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-hc-brand-dark">
          {new Date().toLocaleDateString("is-IS", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold text-hc-ink">
          {HELLO()}{name ? `, ${name}` : ""}
        </h1>
      </header>

      {data === undefined && <div className="h-28 animate-pulse rounded-3xl bg-white" aria-hidden />}

      {data === null && (
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="font-semibold text-hc-ink">Heilsuferðin er ekki byrjuð</p>
          <p className="mt-1 text-sm text-hc-ink-2">Þegar heilsumatið er komið birtist áætlunin þín hér.</p>
          <Link href="/account/heilsuferd" className="mt-3 inline-flex min-h-10 items-center rounded-full bg-hc-brand px-4 font-semibold text-white">
            Sjá heilsuferðina
          </Link>
        </div>
      )}

      {data?.plan && (
        <>
          {/* How much of today is left, before anything else. */}
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-lg font-bold text-hc-ink">
                {left.length === 0 ? "Allt búið í dag" : `${left.length} eftir í dag`}
              </p>
              <p className="text-sm text-slate-500">{items.length - left.length} af {items.length}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-hc-brand transition-all"
                style={{ width: `${items.length ? ((items.length - left.length) / items.length) * 100 : 0}%` }} />
            </div>
            <Link href="/account/heilsuferd/aaetlun?tab=today"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-hc-brand-dark hover:underline">
              Opna daginn <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>

          {/* The two things with a time and a place. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/account/heilsuferd/aaetlun?tab=exercise"
              className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:ring-orange-200">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                <Dumbbell className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wide text-orange-700">Æfing dagsins</span>
                <span className="block truncate font-semibold text-hc-ink">Sjá æfinguna</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
            </Link>
            <Link href="/account/heilsuferd/aaetlun?tab=nutrition"
              className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:ring-lime-200">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-100 text-lime-800">
                <Utensils className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wide text-lime-800">Máltíðir dagsins</span>
                <span className="block truncate font-semibold text-hc-ink">Sjá matinn</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
            </Link>
          </div>

          {/* The four pillars, as a glance rather than a list. */}
          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Stoðirnar fjórar</p>
            <div className="grid grid-cols-4 gap-2">
              {PILLARS.map((p: Pillar) => {
                const mine = items.filter((m) => m.pillar === p);
                const ok = mine.filter((m) => done.has(m.uid)).length;
                const meta = PILLAR_META[p];
                return (
                  <div key={p} className="rounded-2xl p-2 text-center" style={{ background: meta.soft }}>
                    <p className="text-[11px] font-bold" style={{ color: meta.ink }}>{meta.label}</p>
                    <p className="text-lg font-bold tabular-nums" style={{ color: meta.color }}>
                      {mine.length ? `${ok}/${mine.length}` : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
