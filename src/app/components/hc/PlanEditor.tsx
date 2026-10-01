"use client";

// The participant builds or edits their own action plan: drag the actions
// into the order they want, take suggestions from their own report, add from
// the same library the nurse uses, write their own, set goals and pick
// fræðsla. Saved through /api/hc/my-plan (versioned, audited, visible to staff).

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, GripVertical, Plus, Sparkles, Trash2, X } from "lucide-react";
import PillarIcon from "./PillarIcon";
import { hcBtn, hcCard, hcKicker } from "./ui";
import { bangScore, GRADE_IS, scoreBand } from "@/lib/hc/rating";
import { PILLAR_META, PILLARS, type Pillar, type PlanGoal, type PlanItem, type PlanModule } from "@/lib/hc/types";
import type { PillarPriority } from "@/lib/hc/self-plan";
import * as cache from "@/lib/hc/client-cache";
import { ProgramList, usePrograms } from "./ProgramPicker";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
interface LectureRef { slug: string; title: string; subtitle: string | null; duration_min: number | null; pillar: string | null }
interface Loaded {
  modules: PlanModule[];
  lectures: LectureRef[];
  plan: { goals: PlanGoal[]; modules: PlanItem[]; lecture_slugs: string[] | null; exercise?: { key: string } | null; nutrition?: { key: string } | null } | null;
  staff_drafting: boolean;
  has_report: boolean;
  priorities: PillarPriority[];
  suggestions: { key: string; pillar: Pillar; why: string }[];
}
/** One row in the editor: an existing plan item, a library pick, or the participant's own. */
interface Row { uid?: string; key: string | null; pillar: Pillar; title: string; summary: string; frequency: string | null; note: string; own: boolean; tmp: string }

const tmpId = () => Math.random().toString(36).slice(2);
const SIGNAL_IS = { red: "Þarfnast athygli", yellow: "Má bæta", green: "Í góðu lagi" } as const;
const SIGNAL_CLS = { red: "bg-red-50 text-red-800 ring-red-200", yellow: "bg-amber-50 text-amber-900 ring-amber-200", green: "bg-emerald-50 text-emerald-800 ring-emerald-200" } as const;

export default function PlanEditor({ api, onDone, onCancel }: { api: Api; onDone: () => void; onCancel: () => void }) {
  const [d, setD] = useState<Loaded | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [goals, setGoals] = useState<PlanGoal[]>([]);
  const [lectures, setLectures] = useState<string[]>([]);
  const [exKey, setExKey] = useState<string | null>(null);
  const [nuKey, setNuKey] = useState<string | null>(null);
  const programs = usePrograms(api);
  const [lib, setLib] = useState<Pillar>("sleep");
  const [own, setOwn] = useState<{ pillar: Pillar; title: string; frequency: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    (async () => {
      const r = await api("/api/hc/my-plan");
      const j = (await r.json().catch(() => null)) as Loaded | null;
      if (!r.ok || !j) { setMsg("Tókst ekki að sækja áætlunina."); return; }
      setD(j);
      const byKey = new Map(j.modules.map((m) => [m.key, m]));
      if (j.plan) {
        setRows(j.plan.modules.map((m) => ({ uid: m.uid, key: m.key, pillar: m.pillar, title: m.title, summary: m.summary, frequency: m.frequency, note: m.note ?? "", own: !!m.key?.startsWith("own:"), tmp: tmpId() })));
        setGoals(j.plan.goals ?? []);
        setLectures(j.plan.lecture_slugs ?? []);
        setExKey(j.plan.exercise?.key ?? null);
        setNuKey(j.plan.nutrition?.key ?? null);
      } else {
        // A first plan starts from the suggestions; everything can be changed.
        setRows(j.suggestions.map((s) => byKey.get(s.key)).filter((m): m is PlanModule => !!m)
          .map((m) => ({ key: m.key, pillar: m.pillar, title: m.title, summary: m.summary, frequency: m.frequency, note: "", own: false, tmp: tmpId() })));
        setLectures(j.lectures.filter((l) => j.priorities.slice(0, 2).some((p) => p.pillar === l.pillar)).slice(0, 3).map((l) => l.slug));
      }
      const top = j.priorities.find((p) => p.signal === "red" || p.signal === "yellow");
      if (top) setLib(top.pillar);
    })();
  }, [api]);

  const inPlan = useMemo(() => new Set(rows.map((r) => r.key).filter(Boolean)), [rows]);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= rows.length) return;
    setRows((rs) => { const n = [...rs]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
  };
  const add = (m: PlanModule) => {
    if (inPlan.has(m.key)) return;
    setRows((rs) => [...rs, { key: m.key, pillar: m.pillar, title: m.title, summary: m.summary, frequency: m.frequency, note: "", own: false, tmp: tmpId() }]);
  };

  /** Pointer-based drag (works with touch, unlike HTML5 drag and drop). */
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag === null || !listRef.current) return;
    const items = Array.from(listRef.current.children) as HTMLElement[];
    // The new place = how many of the other rows have their middle above the pointer.
    const y = e.clientY;
    const to = items.filter((el, k) => { if (k === drag) return false; const r = el.getBoundingClientRect(); return r.top + r.height / 2 < y; }).length;
    if (to !== drag) { move(drag, to); setDrag(to); }
  };

  const save = async () => {
    setBusy(true); setMsg("");
    const r = await api("/api/hc/my-plan", {
      method: "POST",
      body: JSON.stringify({
        items: rows.map((x) => ({ uid: x.uid, key: x.own && !x.uid ? null : x.key, pillar: x.pillar, title: x.title, summary: x.summary, frequency: x.frequency, note: x.note })),
        goals: goals.filter((g) => g.text.trim()),
        lecture_slugs: lectures,
        // Only sent when changed, so an unchanged programme keeps any edits staff made to it.
        ...(exKey !== (d?.plan?.exercise?.key ?? null) ? { exercise_key: exKey } : {}),
        ...(nuKey !== (d?.plan?.nutrition?.key ?? null) ? { nutrition_key: nuKey } : {}),
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Tókst ekki að vista."); return; }
    cache.invalidate("/api/hc/");
    onDone();
  };

  if (!d) return <p className="text-slate-500">{msg || "Hleð…"}</p>;
  if (d.staff_drafting) {
    return (
      <div className={`${hcCard.base} p-6`}>
        <p className="font-semibold text-hc-ink">Hjúkrunarfræðingur er að ganga frá áætluninni þinni.</p>
        <p className="mt-1 text-sm text-hc-ink-2">Þú getur breytt henni um leið og hún er birt.</p>
        <button type="button" onClick={onCancel} className={`${hcBtn.secondary} mt-4`}>Til baka</button>
      </div>
    );
  }

  const libModules = d.modules.filter((m) => m.pillar === lib).sort((a, b) => (bangScore(b) ?? 0) - (bangScore(a) ?? 0));
  const suggestionFor = new Map(d.suggestions.map((s) => [s.key, s.why]));

  return (
    <div className="space-y-6">
      <section className={`${hcCard.hero} p-6`}>
        <p className={`${hcKicker} text-emerald-300`}>{d.plan ? "Breyta áætlun" : "Búa til áætlun"}</p>
        <h1 className="mt-1 text-2xl font-bold">Áætlunin þín, eins og þú vilt hafa hana</h1>
        <p className="mt-2 max-w-2xl text-emerald-100">
          Dragðu aðgerðirnar í þá röð sem þér hentar, taktu út það sem passar ekki og bættu við úr safninu eða þínum eigin.
          {d.has_report ? " Tillögurnar byggja á skýrslunni þinni." : ""} Hjúkrunarfræðingurinn þinn sér breytingarnar.
        </p>
      </section>

      {/* Where the report points */}
      {d.has_report && (
        <section>
          <p className={`${hcKicker} mb-2 text-slate-500`}>Hvað skýrslan segir</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {d.priorities.map((p) => (
              <button key={p.pillar} type="button" onClick={() => setLib(p.pillar)}
                className={`${hcCard.base} flex items-start gap-3 p-3 text-left transition hover:ring-slate-300 ${lib === p.pillar ? "ring-2 ring-hc-ink" : ""}`}>
                <PillarIcon pillar={p.pillar} />
                <span className="min-w-0">
                  <span className="block font-semibold text-hc-ink">{PILLAR_META[p.pillar].label}</span>
                  {p.signal
                    ? <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${SIGNAL_CLS[p.signal]}`}>{SIGNAL_IS[p.signal]}</span>
                    : <span className="mt-1 block text-xs text-slate-500">Ekkert mælt</span>}
                  {p.reasons.length > 0 && <span className="mt-1 block text-xs text-hc-ink-2">{p.reasons.join(" · ")}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* The plan */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <p className={`${hcKicker} text-slate-500`}>Aðgerðirnar mínar ({rows.length})</p>
            <p className="text-xs text-slate-500">Dragðu <GripVertical className="inline h-3.5 w-3.5" aria-hidden /> til að raða</p>
          </div>
          {rows.length === 0 && <p className={`${hcCard.base} p-6 text-center text-sm text-slate-500`}>Engar aðgerðir enn. Bættu við úr safninu.</p>}
          <ol ref={listRef} className="space-y-2" onPointerMove={onPointerMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
            {rows.map((r, i) => (
              <li key={r.tmp} className={`${hcCard.base} flex gap-2 p-3 transition ${drag === i ? "scale-[1.01] shadow-hc-raised ring-2 ring-hc-brand" : ""}`}>
                <button type="button" aria-label={`Draga: ${r.title}`}
                  onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(i); }}
                  className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 active:cursor-grabbing">
                  <GripVertical className="h-5 w-5" aria-hidden />
                </button>
                <PillarIcon pillar={r.pillar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-hc-ink">{r.title}</p>
                  {r.frequency && <p className="text-xs font-medium text-hc-ink-2">{r.frequency}</p>}
                  {r.summary && <p className="mt-0.5 line-clamp-2 text-sm text-hc-ink-2">{r.summary}</p>}
                  <input value={r.note} onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))}
                    placeholder="Mín athugasemd (t.d. „á þriðjudögum eftir vinnu“)" maxLength={300}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm focus:border-hc-brand focus:bg-white focus:outline-none" />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" aria-label="Færa upp" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label="Færa niður" disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Taka út: ${r.title}`} onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ol>

          {/* Own action */}
          {own ? (
            <div className={`${hcCard.base} mt-3 space-y-2 p-4`}>
              <p className="font-semibold text-hc-ink">Mín eigin aðgerð</p>
              <div className="flex flex-wrap gap-1.5">
                {PILLARS.map((p) => (
                  <button key={p} type="button" onClick={() => setOwn({ ...own, pillar: p })} aria-pressed={own.pillar === p}
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${own.pillar === p ? "bg-hc-ink text-white" : "bg-slate-100 text-slate-700"}`}>{PILLAR_META[p].label}</button>
                ))}
              </div>
              <input value={own.title} onChange={(e) => setOwn({ ...own, title: e.target.value })} maxLength={80} placeholder="Hvað ætlarðu að gera? (t.d. „Ganga í vinnuna“)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <input value={own.frequency} onChange={(e) => setOwn({ ...own, frequency: e.target.value })} maxLength={40} placeholder="Hversu oft? (t.d. „3× í viku“)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              <div className="flex gap-2">
                <button type="button" disabled={own.title.trim().length < 3} className={hcBtn.primary}
                  onClick={() => { setRows((rs) => [...rs, { key: null, pillar: own.pillar, title: own.title.trim(), summary: "", frequency: own.frequency.trim() || null, note: "", own: true, tmp: tmpId() }]); setOwn(null); }}>Bæta við</button>
                <button type="button" onClick={() => setOwn(null)} className={hcBtn.ghost}>Hætta við</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setOwn({ pillar: lib, title: "", frequency: "" })} className={`${hcBtn.secondary} mt-3`}><Plus className="h-4 w-4" /> Mín eigin aðgerð</button>
          )}

          {/* Programmes */}
          {programs && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className={`${hcKicker} text-slate-500`}>Æfingaáætlun</p>
                  {exKey && <button type="button" onClick={() => setExKey(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Engin</button>}
                </div>
                <ProgramList rows={programs.exercise} current={exKey} onPick={setExKey} tone="exercise" />
              </div>
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className={`${hcKicker} text-slate-500`}>Næringaráætlun</p>
                  {nuKey && <button type="button" onClick={() => setNuKey(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Engin</button>}
                </div>
                <ProgramList rows={programs.nutrition} current={nuKey} onPick={setNuKey} tone="nutrition" />
              </div>
            </div>
          )}

          {/* Goals */}
          <div className="mt-6">
            <p className={`${hcKicker} mb-2 text-slate-500`}>Markmiðin mín</p>
            <div className="space-y-2">
              {goals.map((g, i) => (
                <div key={i} className={`${hcCard.base} flex items-center gap-2 p-2`}>
                  <select value={g.pillar} onChange={(e) => setGoals((gs) => gs.map((x, k) => (k === i ? { ...x, pillar: e.target.value as Pillar } : x)))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
                    {PILLARS.map((p) => <option key={p} value={p}>{PILLAR_META[p].label}</option>)}
                  </select>
                  <input value={g.text} maxLength={160} onChange={(e) => setGoals((gs) => gs.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                    placeholder="t.d. „Sofa 7 tíma flestar nætur“" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <button type="button" aria-label="Eyða markmiði" onClick={() => setGoals((gs) => gs.filter((_, k) => k !== i))} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            {goals.length < 6 && <button type="button" onClick={() => setGoals((gs) => [...gs, { pillar: lib, text: "" }])} className={`${hcBtn.ghost} mt-1`}><Plus className="h-4 w-4" /> Markmið</button>}
          </div>

          {/* Fræðsla */}
          {d.lectures.length > 0 && (
            <div className="mt-6">
              <p className={`${hcKicker} mb-2 text-slate-500`}>Fræðsla í áætluninni</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {d.lectures.map((l) => {
                  const on = lectures.includes(l.slug);
                  return (
                    <label key={l.slug} className={`${hcCard.base} flex cursor-pointer items-start gap-2 p-3 ${on ? "ring-2 ring-hc-brand" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => setLectures((ls) => (on ? ls.filter((s) => s !== l.slug) : [...ls, l.slug]))} className="mt-1 h-4 w-4 accent-emerald-600" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-hc-ink"><BookOpen className="h-3.5 w-3.5 text-slate-400" aria-hidden />{l.title}</span>
                        <span className="block text-xs text-slate-500">{l.pillar && l.pillar in PILLAR_META ? PILLAR_META[l.pillar as Pillar].label : "Almennt"}{l.duration_min ? ` · ${l.duration_min} mín.` : ""}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* The library */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className={`${hcCard.base} overflow-hidden`}>
            <div className="border-b border-slate-100 p-3">
              <p className="font-semibold text-hc-ink">Safnið</p>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {PILLARS.map((p) => (
                  <button key={p} type="button" onClick={() => setLib(p)} aria-pressed={lib === p}
                    className={`rounded-lg px-1 py-1.5 text-xs font-semibold ${lib === p ? "bg-hc-ink text-white" : "text-slate-600 hover:bg-slate-100"}`}>{PILLAR_META[p].label}</button>
                ))}
              </div>
            </div>
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {libModules.map((m) => {
                const s = bangScore(m);
                const band = s != null ? scoreBand(s) : null;
                const why = suggestionFor.get(m.key);
                const taken = inPlan.has(m.key);
                return (
                  <li key={m.key} className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-hc-ink">{m.title}</p>
                        {m.frequency && <p className="text-xs text-hc-ink-2">{m.frequency}</p>}
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{m.summary}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {why && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200"><Sparkles className="h-3 w-3" aria-hidden />Tillaga · {why}</span>}
                          {band && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${band.className}`}>{band.label}</span>}
                          {m.evidence_grade && GRADE_IS[m.evidence_grade] && <span title={GRADE_IS[m.evidence_grade].hint} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GRADE_IS[m.evidence_grade].className}`}>Rannsóknir {m.evidence_grade}</span>}
                        </div>
                      </div>
                      <button type="button" disabled={taken} onClick={() => add(m)} aria-label={taken ? `${m.title} er í áætluninni` : `Bæta við: ${m.title}`}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${taken ? "bg-emerald-50 text-emerald-700" : "bg-hc-brand text-white hover:bg-hc-brand-dark"}`}>
                        {taken ? "Í áætlun" : "+ Bæta við"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-hc-card bg-white/95 p-3 shadow-hc-overlay ring-1 ring-slate-200 backdrop-blur sm:bottom-4">
        <button type="button" onClick={() => void save()} disabled={busy || rows.length === 0} className={hcBtn.primary}>
          {busy ? "Vista…" : d.plan ? "Vista breytingar" : "Vista áætlunina"}
        </button>
        <button type="button" onClick={onCancel} className={hcBtn.ghost}>Hætta við</button>
        {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
      </div>
    </div>
  );
}
