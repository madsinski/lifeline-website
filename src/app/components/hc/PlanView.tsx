"use client";

// The customer's action plan. On screen: tabs, cards and dropdowns (phone
// first). In print: every section expanded on its own page, nothing hidden —
// the screen and print trees are separate so a closed <details> can never
// swallow content on paper.

import { useState } from "react";
import { PILLARS, PILLAR_META, type ActionPlan, type Pillar, type PlanItem } from "@/lib/hc/types";

type Tab = "overview" | "detail" | "exercise" | "nutrition";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("is-IS", { day: "numeric", month: "long", year: "numeric" }) : null;

const LEVEL: Record<string, string> = { beginner: "Byrjandi", intermediate: "Miðlungs", advanced: "Lengra komin" };

export default function PlanView({ plan, clientName }: { plan: ActionPlan; clientName?: string | null }) {
  const [tab, setTab] = useState<Tab>("overview");
  const byPillar = (p: Pillar) => plan.modules.filter((m) => m.pillar === p);
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "overview", label: "Yfirlit", show: true },
    { key: "detail", label: "Ítarlegt", show: true },
    { key: "exercise", label: "Hreyfing", show: !!plan.exercise?.sessions?.length },
    { key: "nutrition", label: "Næring", show: !!plan.nutrition },
  ];

  return (
    <div className="plan-view">
      {/* ── Screen ─────────────────────────────────────────────── */}
      <div className="print:hidden">
        <Header plan={plan} clientName={clientName} />
        <div className="sticky top-0 z-10 -mx-4 mb-6 bg-white/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:px-2">
          <div className="flex items-center gap-2 overflow-x-auto" role="tablist" aria-label="Hlutar áætlunar">
            {tabs.filter((t) => t.show).map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                  tab === t.key ? "bg-[#0F172A] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
            <span className="flex-1" />
            <button
              onClick={() => window.print()}
              className="whitespace-nowrap rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Prenta / PDF
            </button>
          </div>
        </div>

        {tab === "overview" && <Overview plan={plan} byPillar={byPillar} />}
        {tab === "detail" && (
          <div className="space-y-8">
            {PILLARS.filter((p) => byPillar(p).length).map((p) => (
              <section key={p}>
                <PillarHeading pillar={p} />
                <div className="mt-3 space-y-3">
                  {byPillar(p).map((m) => <ModuleCard key={m.uid} m={m} />)}
                </div>
              </section>
            ))}
          </div>
        )}
        {tab === "exercise" && plan.exercise && <Exercise plan={plan} />}
        {tab === "nutrition" && plan.nutrition && <Nutrition plan={plan} />}
      </div>

      {/* ── Print ──────────────────────────────────────────────── */}
      <div className="hidden print:block">
        <Header plan={plan} clientName={clientName} print />
        <Overview plan={plan} byPillar={byPillar} />
        <div className="break-before-page">
          <h2 className="mb-4 text-xl font-bold">Ítarleg áætlun</h2>
          {PILLARS.filter((p) => byPillar(p).length).map((p) => (
            <section key={p} className="mb-6 break-inside-avoid">
              <PillarHeading pillar={p} />
              {byPillar(p).map((m) => (
                <div key={m.uid} className="mt-2 break-inside-avoid border-l-4 pl-3" style={{ borderColor: PILLAR_META[p].color }}>
                  <p className="font-semibold">{m.title}{m.frequency ? ` · ${m.frequency}` : ""}</p>
                  <p className="text-sm">{m.summary}</p>
                  {m.details && <p className="text-sm text-slate-600">{m.details}</p>}
                  {m.note && <p className="text-sm italic">Athugasemd: {m.note}</p>}
                </div>
              ))}
            </section>
          ))}
        </div>
        {plan.exercise?.sessions?.length ? <div className="break-before-page"><Exercise plan={plan} /></div> : null}
        {plan.nutrition ? <div className="break-before-page"><Nutrition plan={plan} /></div> : null}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, footer, header.site-header { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Header({ plan, clientName, print }: { plan: ActionPlan; clientName?: string | null; print?: boolean }) {
  const start = fmtDate(plan.start_date);
  const review = fmtDate(plan.review_date);
  return (
    <div className={print ? "mb-6 border-b pb-4" : "mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2A23] to-[#065F46] p-6 text-white sm:p-8"}>
      <p className={`text-xs font-bold uppercase tracking-[0.2em] ${print ? "text-emerald-700" : "text-emerald-300"}`}>Aðgerðaáætlun · Lifeline Health</p>
      <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{plan.headline || "Áætlunin þín til næstu þriggja mánaða"}</h1>
      <p className={`mt-2 text-sm ${print ? "text-slate-600" : "text-emerald-100"}`}>
        {clientName ? `${clientName} · ` : ""}{start ? `Frá ${start}` : ""}{review ? ` · Endurmat ${review}` : ""}
      </p>
      {plan.summary && <p className={`mt-4 max-w-2xl text-[15px] leading-relaxed ${print ? "" : "text-white/90"}`}>{plan.summary}</p>}
    </div>
  );
}

function PillarHeading({ pillar }: { pillar: Pillar }) {
  const m = PILLAR_META[pillar];
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ background: m.color }} aria-hidden />
      <h2 className="text-lg font-bold text-[#0F172A]">{m.label}</h2>
    </div>
  );
}

function Overview({ plan, byPillar }: { plan: ActionPlan; byPillar: (p: Pillar) => PlanItem[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        {PILLARS.map((p) => {
          const meta = PILLAR_META[p];
          const goal = plan.goals.find((g) => g.pillar === p);
          const items = byPillar(p);
          if (!goal && !items.length) return null;
          return (
            <div key={p} className="break-inside-avoid rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: meta.ring }}>
              <div className="flex items-center justify-between">
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: meta.soft, color: meta.color }}>{meta.label}</span>
                <span className="text-xs text-slate-400">{items.length} {items.length === 1 ? "aðgerð" : "aðgerðir"}</span>
              </div>
              {goal && <p className="mt-3 text-[15px] font-semibold leading-snug text-[#0F172A]">{goal.text}</p>}
              <ul className="mt-3 space-y-2">
                {items.map((m) => (
                  <li key={m.uid} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
                    <span><span className="font-medium">{m.title}</span>{m.frequency ? <span className="text-slate-500"> · {m.frequency}</span> : null}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {plan.nurse_note && (
        <div className="break-inside-avoid rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Frá hjúkrunarfræðingnum þínum</p>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-800">{plan.nurse_note}</p>
        </div>
      )}
    </div>
  );
}

function ModuleCard({ m }: { m: PlanItem }) {
  const meta = PILLAR_META[m.pillar];
  const hasMore = !!(m.details || m.note);
  const body = (
    <div className="flex items-start gap-3">
      <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
      <div className="flex-1">
        <p className="font-semibold text-[#0F172A]">{m.title}</p>
        <p className="mt-0.5 text-sm text-slate-600">{m.summary}</p>
        {m.frequency && <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{m.frequency}</span>}
      </div>
    </div>
  );
  if (!hasMore) return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">{body}</div>;
  return (
    <details className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm open:ring-1 open:ring-slate-200">
      <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
        <div className="flex-1">{body}</div>
        <span className="mt-1 text-slate-400 transition group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="mt-3 space-y-3 pl-4 text-sm leading-relaxed text-slate-700">
        {m.details && <p>{m.details}</p>}
        {m.note && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900"><span className="font-semibold">Athugasemd til þín: </span>{m.note}</p>
        )}
      </div>
    </details>
  );
}

function Exercise({ plan }: { plan: ActionPlan }) {
  const e = plan.exercise!;
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[#0F172A]">{e.name}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {LEVEL[e.level] ?? e.level} · {e.days_per_week} dagar í viku{e.session_minutes ? ` · um ${e.session_minutes} mín.` : ""}
          {e.goal ? ` · ${e.goal}` : ""}
        </p>
        {e.description && <p className="mt-2 text-sm text-slate-600">{e.description}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
        {e.sessions.map((s, i) => (
          <div key={i} className="break-inside-avoid overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
            <div className="bg-orange-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-700">{s.day}</p>
              <p className="font-semibold text-[#0F172A]">{s.title}{s.focus ? <span className="font-normal text-slate-500"> · {s.focus}</span> : null}</p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {s.items.map((it, j) => (
                  <tr key={j} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-800">{it.name}{it.note ? <span className="block text-xs text-slate-500">{it.note}</span> : null}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-semibold text-slate-700">{it.prescription}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function Nutrition({ plan }: { plan: ActionPlan }) {
  const n = plan.nutrition!;
  return (
    <div>
      <h2 className="text-xl font-bold text-[#0F172A]">{n.name}</h2>
      {n.goal && <p className="mt-1 text-sm text-slate-600">{n.goal}</p>}
      {n.description && <p className="mt-2 text-sm text-slate-600">{n.description}</p>}
      {n.principles.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          {n.principles.map((p, i) => (
            <div key={i} className="break-inside-avoid rounded-2xl border border-lime-100 bg-lime-50/50 p-4 text-sm font-medium text-slate-800">
              <span className="mr-2 font-bold text-lime-700">{i + 1}.</span>{p}
            </div>
          ))}
        </div>
      )}
      {n.day_example.length > 0 && (
        <div className="mt-6 break-inside-avoid">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Dæmi um dag</h3>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white">
            {n.day_example.map((d, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 text-sm">
                <span className="w-28 shrink-0 font-semibold text-slate-800">{d.meal}</span>
                <span className="text-slate-600">{d.example}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
