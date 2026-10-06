"use client";

// The participant builds or edits their own action plan, one part at a time.
//
// It asks "Hvað viltu breyta?" first and nothing is open until that is
// answered: pick Svefn and you get the sleep actions in the plan, the sleep
// library to add from, your own sleep action and your sleep goals — the rest
// of the plan stays out of the way and untouched. The æfinga- and
// næringaráætlun and the fræðsla are their own choices for the same reason.
//
// One save still writes the whole plan through /api/hc/my-plan (versioned,
// audited, visible to staff); the category is a lens on the editor, not a
// partial payload, so nothing outside it can be lost.

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, ChevronRight, Dumbbell, LayoutGrid, Plus, Sparkles, Trash2, Utensils, X } from "lucide-react";
import PillarIcon from "./PillarIcon";
import { hcBtn, hcCard, hcKicker, hcTabs } from "./ui";
import { GRADE_IS } from "@/lib/hc/rating";
import { fitOf } from "@/lib/hc/fit";
import type { Signal } from "@/lib/hc/grunnheilsa";
import FitMeter from "./FitMeter";
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
  /** hc_knowledge slug → traffic light from this person's report. */
  signals: Record<string, Signal | null>;
  /** hc_knowledge slug → the report row's title. */
  marker_titles: Record<string, string>;
  suggestions: { key: string; pillar: Pillar; why: string }[];
}
/** One row in the editor: an existing plan item, a library pick, or the participant's own. */
interface Row { uid?: string; key: string | null; pillar: Pillar; title: string; summary: string; frequency: string | null; note: string; own: boolean; tmp: string }

/**
 * What this visit to the editor is about. A pillar covers everything tied to
 * it — the actions in the plan, the library to add from, your own action and
 * the goals — so "I want to fix my sleep" touches sleep and nothing else.
 * The three after it are plan-wide and have no pillar of their own.
 */
type Focus = Pillar | "exercise-program" | "nutrition-program" | "lectures";

/** Dative of each pillar, for "… í svefni". Lowercasing the label is not enough. */
/**
 * A tab in the category bar.
 *
 * `shrink-0` rather than `flex-1`: with eight items and `flex-1` the basis
 * collapses to 0 and the labels disappear instead of the bar scrolling.
 */
const tabCls = (active: boolean) =>
  `flex shrink-0 items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
    active ? "bg-hc-ink text-white" : "text-slate-600 hover:bg-slate-50"}`;

/**
 * The same tab, in the category's own colour.
 *
 * The editor was emerald whatever you were editing, so choosing Næring from a
 * lime-green group on the front page landed you on a green-brand page that
 * looked like a different part of the product. A category keeps its colour
 * across the two.
 */
const pillarTabStyle = (pl: Pillar, active: boolean): React.CSSProperties =>
  active ? { background: PILLAR_META[pl].color, color: "#fff" } : { color: PILLAR_META[pl].ink };

/** The plan-wide categories need shorter labels to sit in a tab. */
const TAB_SHORT: Record<string, string> = {
  "exercise-program": "Æfingaáætlun",
  "nutrition-program": "Næringaráætlun",
  lectures: "Fræðsla",
};

const PILLAR_DATIVE: Record<Pillar, string> = {
  sleep: "svefni",
  exercise: "hreyfingu",
  nutrition: "næringu",
  mental: "andlegri líðan",
};

const tmpId = () => Math.random().toString(36).slice(2);
const SIGNAL_IS = { red: "Þarfnast athygli", yellow: "Má bæta", green: "Í góðu lagi" } as const;
const SIGNAL_CLS = { red: "bg-red-50 text-red-800 ring-red-200", yellow: "bg-amber-50 text-amber-900 ring-amber-200", green: "bg-emerald-50 text-emerald-800 ring-emerald-200" } as const;

export default function PlanEditor({ api, onDone, onCancel, initialFocus }: {
  api: Api; onDone: () => void; onCancel: () => void;
  /** Opened from an action on "Í dag": skip the chooser and go to its pillar. */
  initialFocus?: Pillar | null;
}) {
  const [d, setD] = useState<Loaded | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [goals, setGoals] = useState<PlanGoal[]>([]);
  const [lectures, setLectures] = useState<string[]>([]);
  const [exKey, setExKey] = useState<string | null>(null);
  const [nuKey, setNuKey] = useState<string | null>(null);
  const programs = usePrograms(api);
  // Nothing is open to begin with: the first question is which part of the
  // plan this visit is about. Picking one narrows everything below to it.
  const [focus, setFocus] = useState<Focus | null>(initialFocus ?? null);
  const [touched, setTouched] = useState<string[]>([]);
  const [own, setOwn] = useState<{ pillar: Pillar; title: string; frequency: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
    })();
  }, [api]);

  const inPlan = useMemo(() => new Set(rows.map((r) => r.key).filter(Boolean)), [rows]);

  // Every pillar's library, scored and sorted once when the data arrives, so
  // switching tabs is a lookup rather than re-scoring sixty actions.
  const libByPillar = useMemo(() => {
    const sig = d?.signals ?? {};
    const out = {} as Record<Pillar, { m: PlanModule; f: ReturnType<typeof fitOf> }[]>;
    for (const p of PILLARS) {
      out[p] = (d?.modules ?? [])
        .filter((m) => m.pillar === p)
        .map((m) => ({ m, f: fitOf(m, sig) }))
        .sort((a, b) => b.f.fit - a.f.fit);
    }
    return out;
  }, [d]);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= rows.length) return;
    setRows((rs) => { const n = [...rs]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
  };
  const add = (m: PlanModule) => {
    if (inPlan.has(m.key)) return;
    setRows((rs) => [...rs, { key: m.key, pillar: m.pillar, title: m.title, summary: m.summary, frequency: m.frequency, note: "", own: false, tmp: tmpId() }]);
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

  const suggestionFor = new Map(d.suggestions.map((s) => [s.key, s.why]));
  const priorityOf = new Map(d.priorities.map((pr) => [pr.pillar, pr]));
  const isPillar = (f: Focus): f is Pillar => (PILLARS as string[]).includes(f);
  const mark = (f: Focus) => setTouched((t) => (t.includes(f) ? t : [...t, f]));

  const OTHER_LABEL: Record<string, string> = {
    "exercise-program": "Æfingaáætlunin",
    "nutrition-program": "Næringaráætlunin",
    lectures: "Fræðslan",
  };
  const labelOf = (f: Focus) => (isPillar(f) ? PILLAR_META[f].label : OTHER_LABEL[f]);

  /** One save writes the whole plan, so the bar is the same in both steps. */
  const saveBar = (
    <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-hc-card bg-white/95 p-3 shadow-hc-overlay ring-1 ring-slate-200 backdrop-blur sm:bottom-4">
      <button type="button" onClick={() => void save()} disabled={busy || rows.length === 0} className={hcBtn.primary}>
        {busy ? "Vista…" : d.plan ? "Vista breytingar" : "Vista áætlunina"}
      </button>
      <button type="button" onClick={onCancel} className={hcBtn.ghost}>Hætta við</button>
      {touched.length > 0 && !busy && <p className="text-sm font-medium text-amber-800">Óvistaðar breytingar</p>}
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
    </div>
  );

  // ── Step 1: what is this visit about? ──────────────────────────────────────
  // The pillars come worst-first out of the report, so the one that needs the
  // work is the first thing read.
  if (!focus) {
    const order = d.priorities.length > 0
      ? [...d.priorities.map((pr) => pr.pillar), ...PILLARS.filter((pl) => !d.priorities.some((pr) => pr.pillar === pl))]
      : PILLARS;
    const chooser = (f: Focus, sub: string, extra?: React.ReactNode) => (
      <button key={f} type="button" onClick={() => setFocus(f)}
        className={`${hcCard.base} flex items-start gap-3 p-4 text-left transition hover:ring-2 hover:ring-hc-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand`}>
        {isPillar(f)
          ? <PillarIcon pillar={f} />
          : <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              {f === "lectures" ? <BookOpen className="h-5 w-5" aria-hidden />
                : f === "exercise-program" ? <Dumbbell className="h-5 w-5" aria-hidden />
                : <Utensils className="h-5 w-5" aria-hidden />}
            </span>}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-hc-ink">{labelOf(f)}</span>
            {touched.includes(f) && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1"
                style={isPillar(f)
                  ? { background: PILLAR_META[f].soft, color: PILLAR_META[f].ink, borderColor: PILLAR_META[f].ring }
                  : undefined}>
                Breytt
              </span>
            )}
          </span>
          {extra}
          <span className="mt-1 block text-xs text-hc-ink-2">{sub}</span>
        </span>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
      </button>
    );
    return (
      <div className="space-y-6">
        <section className={`${hcCard.hero} p-6`}>
          <p className={`${hcKicker} text-emerald-300`}>{d.plan ? "Breyta áætlun" : "Búa til áætlun"}</p>
          <h1 className="mt-1 text-2xl font-bold">Hvað viltu breyta?</h1>
          <p className="mt-2 max-w-2xl text-emerald-100">
            Veldu eitt í einu. Þá sérðu aðeins það sem því tengist og hitt í áætluninni er óhreyft.
            {d.has_report ? " Merkingarnar koma úr skýrslunni þinni." : ""}
          </p>
        </section>

        <section>
          <p className={`${hcKicker} mb-2 text-slate-500`}>Flokkarnir</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {order.map((pl) => {
              const n = rows.filter((r) => r.pillar === pl).length;
              const pr = priorityOf.get(pl);
              return chooser(pl,
                [n > 0 ? `${n} ${n === 1 ? "aðgerð" : "aðgerðir"} í áætluninni` : "Engin aðgerð enn", ...(pr && pr.reasons.length > 0 ? [pr.reasons.join(" · ")] : [])].join(" · "),
                pr?.signal
                  ? <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${SIGNAL_CLS[pr.signal]}`}>{SIGNAL_IS[pr.signal]}</span>
                  : d.has_report ? <span className="mt-1 block text-xs text-slate-500">Ekkert mælt</span> : null);
            })}
          </div>
        </section>

        <section>
          <p className={`${hcKicker} mb-2 text-slate-500`}>Annað í áætluninni</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {chooser("exercise-program", programs?.exercise.find((r) => r.key === exKey)?.name ?? "Engin valin")}
            {chooser("nutrition-program", programs?.nutrition.find((r) => r.key === nuKey)?.name ?? "Engin valin")}
            {chooser("lectures", lectures.length > 0 ? `${lectures.length} ${lectures.length === 1 ? "fyrirlestur valinn" : "fyrirlestrar valdir"}` : "Enginn valinn")}
          </div>
        </section>

        {saveBar}
      </div>
    );
  }

  // ── Step 2: only what the chosen category covers ──────────────────────────
  const pillar = isPillar(focus) ? focus : null;
  const mine = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.pillar === pillar);
  // Already scored and sorted best-for-this-person first (see libByPillar).
  const libModules = pillar ? libByPillar[pillar] : [];
  const pr = pillar ? priorityOf.get(pillar) : undefined;
  /** Up/down swaps with the next action of the same pillar, leaving the rest alone. */
  const nudge = (pos: number, dir: -1 | 1) => {
    const to = mine[pos + dir];
    if (to) move(mine[pos].i, to.i);
  };

  return (
    <div className="space-y-6">
      {/* Every category one tap away. Switching is local state over data that
          is already loaded and already scored, so it paints in the same frame. */}
      <div className="sticky top-20 z-20 -mx-4 bg-hc-page/90 px-4 py-2 backdrop-blur print:hidden">
        <nav className={hcTabs.bar} aria-label="Hvað er verið að breyta">
          <button type="button" onClick={() => setFocus(null)} className={tabCls(false)} title="Yfirlit yfir alla flokka">
            <LayoutGrid className="h-4 w-4" aria-hidden />
          </button>
          <span className="mx-1 w-px shrink-0 self-stretch bg-slate-200" aria-hidden />
          {PILLARS.map((pl) => (
            <button key={pl} type="button" onClick={() => setFocus(pl)} aria-current={focus === pl ? "page" : undefined}
              className={`${tabCls(focus === pl)} ${focus === pl ? "" : "hover:bg-slate-50"}`} style={pillarTabStyle(pl, focus === pl)}>
              {PILLAR_META[pl].label}
              {touched.includes(pl) && <span className="ml-1" aria-label="breytt" style={{ color: focus === pl ? "#fff" : PILLAR_META[pl].color }}>•</span>}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-slate-200" aria-hidden />
          {(["exercise-program", "nutrition-program", "lectures"] as Focus[]).map((f) => (
            <button key={f} type="button" onClick={() => setFocus(f)} aria-current={focus === f ? "page" : undefined} className={tabCls(focus === f)}>
              {TAB_SHORT[f as string]}{touched.includes(f) && <span className="ml-1 text-emerald-500" aria-label="breytt">•</span>}
            </button>
          ))}
        </nav>
      </div>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3"
          style={pillar ? { background: PILLAR_META[pillar].soft } : undefined}>
          {pillar && <PillarIcon pillar={pillar} size="sm" />}
          <h1 className="text-lg font-bold" style={pillar ? { color: PILLAR_META[pillar].ink } : undefined}>{labelOf(focus)}</h1>
          {pr?.signal && (
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${SIGNAL_CLS[pr.signal]}`}>
              Skýrslan: {SIGNAL_IS[pr.signal]}{pr.reasons.length > 0 ? ` · ${pr.reasons.join(" · ")}` : ""}
            </span>
          )}
        </div>
        <p className="px-4 py-2 text-sm text-slate-600">
          {pillar
            ? "Hér er allt sem tengist þessum flokki. Annað í áætluninni breytist ekki."
            : focus === "lectures" ? "Veldu fræðsluna sem þú vilt hafa í áætluninni."
            : "Veldu áætlunina sem þú vilt fylgja."}
        </p>
      </section>

      {pillar && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section>
            <p className={`${hcKicker} mb-2 text-slate-500`}>Aðgerðirnar mínar í {PILLAR_DATIVE[pillar]} ({mine.length})</p>
            {mine.length === 0 && <p className={`${hcCard.base} p-6 text-center text-sm text-slate-500`}>Engin aðgerð í þessum flokki enn. Bættu við úr safninu.</p>}
            <ol className="space-y-2">
              {mine.map(({ r, i }, pos) => (
                <li key={r.tmp} className={`${hcCard.base} flex gap-2 p-3`}>
                  <PillarIcon pillar={r.pillar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-hc-ink">{r.title}</p>
                    {r.frequency && <p className="text-xs font-medium text-hc-ink-2">{r.frequency}</p>}
                    {r.summary && <p className="mt-0.5 line-clamp-2 text-sm text-hc-ink-2">{r.summary}</p>}
                    <input value={r.note} onChange={(e) => { mark(focus); setRows((rs) => rs.map((x, k) => (k === i ? { ...x, note: e.target.value } : x))); }}
                      placeholder="Mín athugasemd (t.d. „á þriðjudögum eftir vinnu“)" maxLength={300}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm focus:border-hc-brand focus:bg-white focus:outline-none" />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button type="button" aria-label="Færa upp" disabled={pos === 0} onClick={() => { mark(focus); nudge(pos, -1); }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label="Færa niður" disabled={pos === mine.length - 1} onClick={() => { mark(focus); nudge(pos, 1); }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Taka út: ${r.title}`} onClick={() => { mark(focus); setRows((rs) => rs.filter((_, k) => k !== i)); }} className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ol>

            {own ? (
              <div className={`${hcCard.base} mt-3 space-y-2 p-4`}>
                <p className="font-semibold text-hc-ink">Mín eigin aðgerð í {PILLAR_DATIVE[pillar]}</p>
                <input value={own.title} onChange={(e) => setOwn({ ...own, title: e.target.value })} maxLength={80} placeholder="Hvað ætlarðu að gera? (t.d. „Ganga í vinnuna“)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                <input value={own.frequency} onChange={(e) => setOwn({ ...own, frequency: e.target.value })} maxLength={40} placeholder="Hversu oft? (t.d. „3× í viku“)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                <div className="flex gap-2">
                  <button type="button" disabled={own.title.trim().length < 3} className={hcBtn.primary}
                    onClick={() => { mark(focus); setRows((rs) => [...rs, { key: null, pillar, title: own.title.trim(), summary: "", frequency: own.frequency.trim() || null, note: "", own: true, tmp: tmpId() }]); setOwn(null); }}>Bæta við</button>
                  <button type="button" onClick={() => setOwn(null)} className={hcBtn.ghost}>Hætta við</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setOwn({ pillar, title: "", frequency: "" })} className={`${hcBtn.secondary} mt-3`}><Plus className="h-4 w-4" /> Mín eigin aðgerð</button>
            )}

            <div className="mt-6">
              <p className={`${hcKicker} mb-2 text-slate-500`}>Markmiðin mín í {PILLAR_DATIVE[pillar]}</p>
              <div className="space-y-2">
                {goals.map((g, i) => (g.pillar === pillar ? (
                  <div key={i} className={`${hcCard.base} flex items-center gap-2 p-2`}>
                    <input value={g.text} maxLength={160} onChange={(e) => { mark(focus); setGoals((gs) => gs.map((x, k) => (k === i ? { ...x, text: e.target.value } : x))); }}
                      placeholder="t.d. „Sofa 7 tíma flestar nætur“" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                    <button type="button" aria-label="Eyða markmiði" onClick={() => { mark(focus); setGoals((gs) => gs.filter((_, k) => k !== i)); }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                  </div>
                ) : null))}
              </div>
              {goals.filter((g) => g.pillar === pillar).length < 3 && (
                <button type="button" onClick={() => { mark(focus); setGoals((gs) => [...gs, { pillar, text: "" }]); }} className={`${hcBtn.ghost} mt-1`}><Plus className="h-4 w-4" /> Markmið</button>
              )}
            </div>
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className={`${hcCard.base} overflow-hidden`}>
              <div className="border-b border-slate-100 p-3">
                <p className="font-semibold text-hc-ink">Bæta við úr safninu</p>
                <p className="text-xs text-slate-500">{PILLAR_META[pillar].label} · {d.has_report ? "það sem hentar þér best efst" : "besta gagnið fyrir tímann fyrst"}</p>
              </div>
              <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
                {libModules.map(({ m, f }, i) => {
                  const why = suggestionFor.get(m.key);
                  const taken = inPlan.has(m.key);
                  const top = i === 0 && d.has_report;
                  return (
                    <li key={m.key} className={`p-3 ${top ? "bg-emerald-50/60 ring-1 ring-inset ring-hc-brand" : ""}`}>
                      {top && (
                        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-hc-brand-dark">
                          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Mælum helst með þessu
                        </p>
                      )}
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-hc-ink">{m.title}</p>
                          {m.frequency && <p className="text-xs text-hc-ink-2">{m.frequency}</p>}
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{m.summary}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {why && f.targets.length === 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200"><Sparkles className="h-3 w-3" aria-hidden />Tillaga · {why}</span>}
                            {m.evidence_grade && GRADE_IS[m.evidence_grade] && <span title={GRADE_IS[m.evidence_grade].hint} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GRADE_IS[m.evidence_grade].className}`}>Rannsóknir {m.evidence_grade}</span>}
                          </div>
                          <FitMeter fit={f} titles={d.marker_titles ?? {}} rank={i + 1} />
                        </div>
                        <button type="button" disabled={taken} onClick={() => { mark(focus); add(m); }} aria-label={taken ? `${m.title} er í áætluninni` : `Bæta við: ${m.title}`}
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
      )}

      {focus === "exercise-program" && programs && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <p className={`${hcKicker} text-slate-500`}>Veldu æfingaáætlun</p>
            {exKey && <button type="button" onClick={() => { mark(focus); setExKey(null); }} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Engin</button>}
          </div>
          <ProgramList rows={programs.exercise} current={exKey} onPick={(k) => { mark("exercise-program"); setExKey(k); }} tone="exercise" />
        </section>
      )}

      {focus === "nutrition-program" && programs && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <p className={`${hcKicker} text-slate-500`}>Veldu næringaráætlun</p>
            {nuKey && <button type="button" onClick={() => { mark(focus); setNuKey(null); }} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Engin</button>}
          </div>
          <ProgramList rows={programs.nutrition} current={nuKey} onPick={(k) => { mark("nutrition-program"); setNuKey(k); }} tone="nutrition" />
        </section>
      )}

      {focus === "lectures" && (
        <section>
          <p className={`${hcKicker} mb-2 text-slate-500`}>Fræðsla í áætluninni</p>
          {d.lectures.length === 0
            ? <p className={`${hcCard.base} p-6 text-center text-sm text-slate-500`}>Engin fræðsla í boði enn.</p>
            : (
              <div className="grid gap-2 sm:grid-cols-2">
                {d.lectures.map((l) => {
                  const on = lectures.includes(l.slug);
                  return (
                    <label key={l.slug} className={`${hcCard.base} flex cursor-pointer items-start gap-2 p-3 ${on ? "ring-2 ring-hc-brand" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => { mark("lectures"); setLectures((ls) => (on ? ls.filter((x) => x !== l.slug) : [...ls, l.slug])); }} className="mt-1 h-4 w-4 accent-emerald-600" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-hc-ink"><BookOpen className="h-3.5 w-3.5 text-slate-400" aria-hidden />{l.title}</span>
                        <span className="block text-xs text-slate-500">{l.pillar && l.pillar in PILLAR_META ? PILLAR_META[l.pillar as Pillar].label : "Almennt"}{l.duration_min ? ` · ${l.duration_min} mín.` : ""}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
        </section>
      )}

      {saveBar}
    </div>
  );
}
