"use client";

// The customer's action plan. On screen: tabs, cards and dropdowns (phone
// first). In print: a separate one-page A4 summary (PrintPage) — client name,
// who made the plan, the four pillars, the week and the nurse's message.

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PILLARS, PILLAR_META, type ActionPlan, type Pillar, type PlanItem } from "@/lib/hc/types";

type Tab = "overview" | "detail" | "exercise" | "nutrition";

// Spelled out by hand: browsers without Icelandic ICU data fall back to English.
const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const fmtDate = (d: string | null) => {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : `${x.getDate()}. ${MONTHS_IS[x.getMonth()]} ${x.getFullYear()}`;
};
const noopSubscribe = () => () => {};

const LEVEL: Record<string, string> = { beginner: "Byrjandi", intermediate: "Miðlungs", advanced: "Lengra komin" };

export default function PlanView({ plan, clientName, author }: { plan: ActionPlan; clientName?: string | null; author?: string | null }) {
  const [tab, setTab] = useState<Tab>("overview");
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
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

      {/* ── Print: one A4 page, portalled to <body> so nothing else on the
          page (navbar, footer, floating buttons) can end up on the sheet. */}
      {mounted && createPortal(
        <div className="plan-print-root hidden print:block">
          <PrintPage plan={plan} clientName={clientName} author={author ?? plan.created_by ?? null} byPillar={byPillar} />
        </div>,
        document.body,
      )}

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 9mm 10mm; }
          html, body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body > *:not(.plan-print-root) { display: none !important; }
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

/** "Anna Jónsdóttir (vera)" → "Anna Jónsdóttir · Vera lífsgæðasetur" */
function authorLabel(a: string | null | undefined): string | null {
  if (!a) return null;
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(a);
  if (!m) return a;
  const org: Record<string, string> = { lifeline: "Lifeline Health", vera: "Vera lífsgæðasetur", heilsugaesla: "Heilsugæslan", Lifeline: "Lifeline Health" };
  return `${m[1]} · ${org[m[2]] ?? m[2]}`;
}

/**
 * The printed plan: exactly one A4 page. Fixed height with overflow hidden,
 * short caps per section (4 actions per pillar, 4 principles, 7 days), so
 * nothing can push onto a second sheet. The detailed view stays on screen.
 */
function PrintPage({ plan, clientName, author, byPillar }: {
  plan: ActionPlan; clientName?: string | null; author: string | null; byPillar: (p: Pillar) => PlanItem[];
}) {
  const start = fmtDate(plan.start_date);
  const review = fmtDate(plan.review_date);
  const by = authorLabel(author);
  const clip = (t: string | null | undefined, n: number) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t || "");
  // Rough line budget: a busy plan drops per-action notes and shows fewer
  // actions so the week, the message and the footer still fit on the sheet.
  const lines = PILLARS.reduce((n, p) => n + Math.min(byPillar(p).length, 5) * 2, 0)
    + (plan.exercise?.sessions?.length ?? 0) * 2 + (plan.nurse_note ? 4 : 0);
  const dense = lines > 44;
  const perPillar = dense ? 4 : 5;
  return (
    <div className="plan-print mx-auto flex h-[276mm] w-[190mm] flex-col overflow-hidden text-[9.5pt] leading-snug text-slate-800">
      <div className="h-1.5 w-full rounded-full bg-[#10B981]" />
      <header className="mt-3 flex items-start justify-between gap-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lifeline-logo-rebrand.png" alt="Lifeline Health" className="h-[9mm] w-auto" />
          <p className="mt-2 text-[7.5pt] font-bold uppercase tracking-[0.2em] text-emerald-700">Aðgerðaáætlun</p>
        </div>
        <div className="text-right">
          <p className="text-[14pt] font-bold text-slate-900">{clientName || ""}</p>
          {by && <p className="text-[8.5pt] text-slate-600">Unnin af {by}</p>}
          <p className="text-[8.5pt] text-slate-500">{start ? `${start}` : ""}{review ? ` – endurmat ${review}` : ""}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <section className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
        <h1 className="text-[13pt] font-bold text-slate-900">{plan.headline || "Áætlun til næstu þriggja mánaða"}</h1>
        {plan.summary && <p className={`mt-1 whitespace-pre-line text-[9pt] text-slate-600 ${dense ? "line-clamp-2" : "line-clamp-3"}`}>{clip(plan.summary, 420)}</p>}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        {PILLARS.map((p) => {
          const meta = PILLAR_META[p];
          const goal = plan.goals.find((g) => g.pillar === p);
          const items = byPillar(p).slice(0, perPillar);
          const more = byPillar(p).length - items.length;
          return (
            <div key={p} className="overflow-hidden rounded-lg border px-3 py-2.5" style={{ borderColor: meta.ring, borderTopWidth: 4, borderTopColor: meta.color }}>
              <p className="text-[10.5pt] font-bold" style={{ color: meta.color }}>{meta.label}</p>
              {goal && <p className="mt-0.5 text-[9pt] font-semibold text-slate-900">{clip(goal.text, 140)}</p>}
              {items.length === 0 && <p className="mt-1 text-[8.5pt] text-slate-400">Engar aðgerðir.</p>}
              <ul className="mt-1.5 space-y-1.5">
                {items.map((m) => (
                  <li key={m.uid} className="flex gap-2">
                    <span className="mt-[3px] inline-block h-3 w-3 shrink-0 rounded-sm border-[1.5px]" style={{ borderColor: meta.color }} />
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-900">{clip(m.title, 60)}</span>
                      {m.frequency && <span className="text-slate-500"> · {m.frequency}</span>}
                      {m.note && !dense && <span className="block text-[8pt] italic text-slate-600">{clip(m.note, 110)}</span>}
                    </span>
                  </li>
                ))}
                {more > 0 && <li className="text-[8pt] text-slate-400">+ {more} til viðbótar á aðganginum</li>}
              </ul>
            </div>
          );
        })}
      </section>

      {(plan.exercise?.sessions?.length || plan.nutrition) ? (
        <section className="mt-3 grid grid-cols-[1.25fr_1fr] gap-3">
          {plan.exercise?.sessions?.length ? (
            <div className="rounded-lg border border-orange-200 px-3 py-2.5">
              <p className="text-[9.5pt] font-bold text-orange-700">Hreyfing: {clip(plan.exercise.name, 40)}</p>
              <table className="mt-1 w-full text-[8.5pt]">
                <tbody>
                  {plan.exercise.sessions.slice(0, 7).map((s, i) => (
                    <tr key={i} className="border-t border-orange-100 align-top first:border-t-0">
                      <td className="w-[22mm] py-1 pr-2 font-semibold text-slate-800">{clip(s.day, 14)}</td>
                      <td className="py-1 text-slate-700">
                        <span className="font-semibold">{clip(s.title, 40)}</span>
                        {s.items.length ? (
                          <span className={`block text-[8pt] text-slate-500 ${dense ? "line-clamp-1" : ""}`}>
                            {clip(s.items.slice(0, 5).map((it) => (it.prescription ? `${it.name} ${it.prescription}` : it.name)).join(" · "), dense ? 90 : 150)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div />}
          {plan.nutrition ? (
            <div className="rounded-lg border border-lime-200 px-3 py-2.5">
              <p className="text-[9.5pt] font-bold text-lime-700">Næring: {clip(plan.nutrition.name, 40)}</p>
              <ul className="mt-1 space-y-0.5 text-[8.5pt] text-slate-700">
                {plan.nutrition.principles.slice(0, 6).map((x, i) => <li key={i}>• {clip(x, 80)}</li>)}
              </ul>
            </div>
          ) : <div />}
        </section>
      ) : null}

      {plan.nurse_note && (
        <section className="mt-3 rounded-lg bg-emerald-50 px-4 py-2.5">
          <p className="text-[7.5pt] font-bold uppercase tracking-wide text-emerald-700">Skilaboð</p>
          <p className={`mt-0.5 whitespace-pre-line text-[9pt] text-slate-800 ${dense ? "line-clamp-2" : "line-clamp-3"}`}>{clip(plan.nurse_note, 360)}</p>
        </section>
      )}

      </div>
      <footer className="mt-3 flex shrink-0 justify-between border-t border-slate-200 pt-1.5 text-[7.5pt] text-slate-400">
        <span>Lifeline Health ehf. · lifelinehealth.is</span>
        <span>Ítarleg útgáfa, æfingar og fræðsla á aðganginum þínum</span>
      </footer>
    </div>
  );
}
