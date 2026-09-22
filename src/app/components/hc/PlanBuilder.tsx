"use client";

// Action-plan builder: start from a scenario template, drag action modules
// in and out per pillar (sleep / exercise / nutrition / mental), write
// personal notes, pick and adjust an exercise and a nutrition template,
// preview exactly what the customer sees, publish.
//
// Used in the nurse workstation (/vinnustod, cookie auth) and in
// /admin/coach/plans (Bearer auth) — the caller passes `api`, a fetch
// wrapper that adds its own credentials.

import { useCallback, useEffect, useMemo, useState } from "react";
import PlanView from "./PlanView";
import {
  PILLARS, PILLAR_META,
  type ActionPlan, type ExerciseTemplate, type NutritionTemplate, type Pillar, type PlanGoal,
  type PlanItem, type PlanLibrary, type PlanModule,
} from "@/lib/hc/types";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

type Draft = {
  template_key: string | null;
  headline: string;
  summary: string;
  goals: PlanGoal[];
  modules: PlanItem[];
  exercise: ActionPlan["exercise"];
  nutrition: ActionPlan["nutrition"];
  nurse_note: string;
  start_date: string;
  review_date: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const plus = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

function fromModule(m: PlanModule): PlanItem {
  return { uid: uid(), key: m.key, pillar: m.pillar, title: m.title, summary: m.summary, details: m.details, frequency: m.frequency, note: null };
}
const stripActive = <T extends { active: boolean }>(t: T): Omit<T, "active"> => {
  const { active: _a, ...rest } = t;
  void _a;
  return rest;
};

export default function PlanBuilder({ journeyId, api, onPublished }: { journeyId: string; api: Api; onPublished?: () => void }) {
  const [lib, setLib] = useState<PlanLibrary | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [filter, setFilter] = useState<Pillar | "all">("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [l, p] = await Promise.all([api("/api/hc/plan-library"), api(`/api/hc/plans/${journeyId}`)]);
      if (!l.ok || !p.ok) { setMsg({ tone: "err", text: "Gat ekki sótt áætlun eða safn." }); return; }
      const library = (await l.json()) as PlanLibrary;
      const pj = await p.json();
      setLib(library);
      setClientName(pj.client?.full_name ?? null);
      const plan = pj.plan as ActionPlan | null;
      setStatus(plan?.status ?? null);
      setDraft(plan ? {
        template_key: plan.template_key,
        headline: plan.headline ?? "",
        summary: plan.summary ?? "",
        goals: plan.goals ?? [],
        modules: plan.modules ?? [],
        exercise: plan.exercise,
        nutrition: plan.nutrition,
        nurse_note: plan.nurse_note ?? "",
        start_date: plan.start_date ?? today(),
        review_date: plan.review_date ?? plus(91),
      } : {
        template_key: null, headline: "", summary: "", goals: [], modules: [], exercise: null, nutrition: null,
        nurse_note: "", start_date: today(), review_date: plus(91),
      });
    })();
  }, [api, journeyId]);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  }, []);

  const applyTemplate = (key: string) => {
    if (!lib || !draft) return;
    const t = lib.templates.find((x) => x.key === key);
    if (!t) return;
    if (draft.modules.length && !confirm("Skipta út núverandi aðgerðum fyrir sniðmátið?")) return;
    const mods = t.module_keys.map((k) => lib.modules.find((m) => m.key === k)).filter((m): m is PlanModule => !!m);
    const ex = lib.exercise.find((e) => e.key === t.exercise_template_key);
    const nu = lib.nutrition.find((n) => n.key === t.nutrition_template_key);
    update({
      template_key: t.key,
      headline: draft.headline || t.name,
      modules: mods.map(fromModule),
      exercise: ex ? stripActive(ex) : draft.exercise,
      nutrition: nu ? stripActive(nu) : draft.nutrition,
    });
  };

  const addModule = (key: string, beforeUid?: string) => {
    if (!lib || !draft) return;
    const m = lib.modules.find((x) => x.key === key);
    if (!m) return;
    const item = fromModule(m);
    const list = [...draft.modules];
    const at = beforeUid ? list.findIndex((x) => x.uid === beforeUid) : -1;
    if (at >= 0) list.splice(at, 0, item); else list.push(item);
    update({ modules: list });
  };
  const moveItem = (fromUid: string, beforeUid: string | null, pillar: Pillar) => {
    if (!draft) return;
    const list = [...draft.modules];
    const from = list.findIndex((x) => x.uid === fromUid);
    if (from < 0) return;
    const [item] = list.splice(from, 1);
    // Library modules keep their pillar; a custom item can be moved across.
    const moved = item.key ? item : { ...item, pillar };
    const at = beforeUid ? list.findIndex((x) => x.uid === beforeUid) : -1;
    if (at >= 0) list.splice(at, 0, moved); else list.push(moved);
    update({ modules: list });
  };
  const removeItem = (u: string) => draft && update({ modules: draft.modules.filter((m) => m.uid !== u) });
  const patchItem = (u: string, patch: Partial<PlanItem>) =>
    draft && update({ modules: draft.modules.map((m) => (m.uid === u ? { ...m, ...patch } : m)) });
  const addCustom = (pillar: Pillar) =>
    draft && update({ modules: [...draft.modules, { uid: uid(), key: null, pillar, title: "Ný aðgerð", summary: "", details: null, frequency: null, note: null }] });

  const onDrop = (e: React.DragEvent, pillar: Pillar, beforeUid: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    try {
      const d = JSON.parse(e.dataTransfer.getData("text/plain")) as { t: "lib" | "plan"; k: string };
      if (d.t === "lib") addModule(d.k, beforeUid ?? undefined);
      else if (d.k !== beforeUid) moveItem(d.k, beforeUid, pillar);
    } catch { /* not ours */ }
  };
  const onDropOut = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const d = JSON.parse(e.dataTransfer.getData("text/plain")) as { t: string; k: string };
      if (d.t === "plan") removeItem(d.k);
    } catch { /* not ours */ }
  };

  const save = async (): Promise<boolean> => {
    if (!draft) return false;
    setBusy(true); setMsg(null);
    const r = await api(`/api/hc/plans/${journeyId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "err", text: (await r.json().catch(() => ({}))).error || "Vistun mistókst." }); return false; }
    const j = await r.json();
    setStatus(j.plan?.status ?? "draft");
    setDirty(false);
    setMsg({ tone: "ok", text: "Drög vistuð." });
    return true;
  };
  const publish = async () => {
    if (!(await save())) return;
    setBusy(true);
    const r = await api(`/api/hc/plans/${journeyId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "err", text: (await r.json().catch(() => ({}))).error || "Birting mistókst." }); return; }
    setStatus("published");
    setMsg({ tone: "ok", text: "Áætlunin er birt á aðgangi skjólstæðings og tölvupóstur sendur." });
    onPublished?.();
  };

  const libModules = useMemo(() => {
    if (!lib) return [];
    const q = search.trim().toLowerCase();
    return lib.modules.filter((m) =>
      (filter === "all" || m.pillar === filter) &&
      (!q || m.title.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q))));
  }, [lib, filter, search]);

  if (!draft || !lib) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{msg?.text ?? "Hleð áætlun…"}</div>;
  }

  if (preview) {
    const asPlan: ActionPlan = {
      id: "preview", journey_id: journeyId, client_id: "", template_key: draft.template_key,
      headline: draft.headline || null, summary: draft.summary || null, goals: draft.goals, modules: draft.modules,
      exercise: draft.exercise, nutrition: draft.nutrition, nurse_note: draft.nurse_note || null,
      start_date: draft.start_date, review_date: draft.review_date, status: "draft", published_at: null, version: 1, updated_at: "",
    };
    return (
      <div>
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          <span>Forskoðun: svona sér skjólstæðingurinn áætlunina.</span>
          <button onClick={() => setPreview(false)} className="rounded-full bg-white px-4 py-1.5 font-semibold ring-1 ring-amber-200">Til baka í ritil</button>
        </div>
        <PlanView plan={asPlan} clientName={clientName} />
      </div>
    );
  }

  const goalFor = (p: Pillar) => draft.goals.find((g) => g.pillar === p)?.text ?? "";
  const setGoal = (p: Pillar, text: string) =>
    update({ goals: [...draft.goals.filter((g) => g.pillar !== p), ...(text.trim() ? [{ pillar: p, text }] : [])] });

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aðgerðaáætlun</p>
          <p className="truncate font-semibold text-[#0F172A]">{clientName || "Skjólstæðingur"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
          {status === "published" ? (dirty ? "Birt · óvistaðar breytingar" : "Birt") : dirty ? "Óvistað" : status === "draft" ? "Drög" : "Ný"}
        </span>
        <select
          value=""
          onChange={(e) => e.target.value && applyTemplate(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          aria-label="Byrja út frá sniðmáti"
        >
          <option value="">Byrja út frá sniðmáti…</option>
          {lib.templates.map((t) => <option key={t.key} value={t.key}>{t.name}{t.scenario ? ` — ${t.scenario}` : ""}</option>)}
        </select>
        <button onClick={() => setPreview(true)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Forskoða</button>
        <button onClick={save} disabled={busy} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Vista drög</button>
        <button onClick={publish} disabled={busy || draft.modules.length === 0} className="rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
          {status === "published" ? "Uppfæra birta áætlun" : "Birta skjólstæðingi"}
        </button>
      </div>
      {msg && (
        <div role="status" className={`rounded-xl px-4 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Library */}
        <aside
          className={`h-fit rounded-2xl border bg-white p-4 lg:sticky lg:top-4 ${dragOver === "out" ? "border-red-300 bg-red-50/40" : "border-slate-200"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver("out"); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={onDropOut}
          aria-label="Aðgerðasafn"
        >
          <p className="text-sm font-bold text-[#0F172A]">Aðgerðasafn</p>
          <p className="mb-3 text-xs text-slate-500">Dragðu aðgerð inn í áætlunina, eða úr henni hingað til að fjarlægja.</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Leita…" className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          <div className="mb-3 flex flex-wrap gap-1">
            {(["all", ...PILLARS] as const).map((p) => (
              <button key={p} onClick={() => setFilter(p)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filter === p ? "bg-[#0F172A] text-white" : "bg-slate-100 text-slate-600"}`}>
                {p === "all" ? "Allt" : PILLAR_META[p].label}
              </button>
            ))}
          </div>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {libModules.map((m) => {
              const inPlan = draft.modules.some((x) => x.key === m.key);
              return (
                <div
                  key={m.key}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ t: "lib", k: m.key }))}
                  className={`cursor-grab rounded-xl border p-3 text-sm active:cursor-grabbing ${inPlan ? "opacity-50" : ""}`}
                  style={{ borderColor: PILLAR_META[m.pillar].ring, background: PILLAR_META[m.pillar].soft }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-[#0F172A]">{m.title}</p>
                      <p className="text-xs text-slate-600">{m.summary}</p>
                    </div>
                    <button onClick={() => addModule(m.key)} className="rounded-lg bg-white px-2 py-0.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200" aria-label={`Bæta við ${m.title}`}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Plan */}
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm">
              <span className="font-semibold text-slate-700">Fyrirsögn</span>
              <input value={draft.headline} onChange={(e) => update({ headline: e.target.value })} placeholder="T.d. Betri svefn og meiri orka" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="sm:col-span-2 text-sm">
              <span className="font-semibold text-slate-700">Samantekt úr viðtali</span>
              <textarea value={draft.summary} onChange={(e) => update({ summary: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="text-sm"><span className="font-semibold text-slate-700">Upphaf</span>
              <input type="date" value={draft.start_date} onChange={(e) => update({ start_date: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm"><span className="font-semibold text-slate-700">Endurmat / eftirfylgd</span>
              <input type="date" value={draft.review_date} onChange={(e) => update({ review_date: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {PILLARS.map((p) => {
              const meta = PILLAR_META[p];
              const items = draft.modules.filter((m) => m.pillar === p);
              return (
                <section
                  key={p}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(p); }}
                  onDragLeave={() => setDragOver((d) => (d === p ? null : d))}
                  onDrop={(e) => onDrop(e, p, null)}
                  className="rounded-2xl border-2 bg-white p-4 transition"
                  style={{ borderColor: dragOver === p ? meta.color : meta.ring }}
                  aria-label={meta.label}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: meta.color }} aria-hidden />
                    <h3 className="font-bold text-[#0F172A]">{meta.label}</h3>
                    <span className="flex-1" />
                    <button onClick={() => addCustom(p)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">+ Eigin aðgerð</button>
                  </div>
                  <input
                    value={goalFor(p)}
                    onChange={(e) => setGoal(p, e.target.value)}
                    placeholder="Markmið fyrir þessa stoð (valfrjálst)"
                    className="mb-3 w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: meta.soft }}
                  />
                  {items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Dragðu aðgerðir hingað</p>
                  )}
                  <div className="space-y-2">
                    {items.map((m) => (
                      <div
                        key={m.uid}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ t: "plan", k: m.uid }))}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDrop(e, p, m.uid)}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-start gap-2">
                          <span className="cursor-grab select-none pt-1 text-slate-300" aria-hidden>⋮⋮</span>
                          <div className="flex-1 space-y-1">
                            <input value={m.title} onChange={(e) => patchItem(m.uid, { title: e.target.value })} className="w-full rounded px-1 font-semibold text-[#0F172A] hover:bg-slate-50" aria-label="Heiti" />
                            <input value={m.summary} onChange={(e) => patchItem(m.uid, { summary: e.target.value })} placeholder="Lýsing" className="w-full rounded px-1 text-sm text-slate-600 hover:bg-slate-50" aria-label="Lýsing" />
                            <input value={m.frequency ?? ""} onChange={(e) => patchItem(m.uid, { frequency: e.target.value || null })} placeholder="Tíðni" className="w-40 rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600" aria-label="Tíðni" />
                            <textarea
                              value={m.note ?? ""}
                              onChange={(e) => patchItem(m.uid, { note: e.target.value || null })}
                              placeholder="Persónuleg athugasemd til skjólstæðings"
                              rows={m.note ? 2 : 1}
                              className="w-full rounded-lg bg-amber-50/70 px-2 py-1 text-sm text-amber-900 placeholder:text-amber-700/50"
                            />
                          </div>
                          <button onClick={() => removeItem(m.uid)} className="text-slate-400 hover:text-red-500" aria-label={`Fjarlægja ${m.title}`}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <ExerciseEditor
            value={draft.exercise}
            templates={lib.exercise}
            onChange={(exercise) => update({ exercise })}
          />
          <NutritionEditor
            value={draft.nutrition}
            templates={lib.nutrition}
            onChange={(nutrition) => update({ nutrition })}
          />

          <label className="block rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <span className="font-semibold text-slate-700">Skilaboð til skjólstæðings</span>
            <textarea value={draft.nurse_note} onChange={(e) => update({ nurse_note: e.target.value })} rows={4} placeholder="Birtist efst á yfirlitinu." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
        </div>
      </div>
    </div>
  );
}

function ExerciseEditor({ value, templates, onChange }: {
  value: ActionPlan["exercise"];
  templates: ExerciseTemplate[];
  onChange: (v: ActionPlan["exercise"]) => void;
}) {
  const pick = (key: string) => {
    if (!key) { onChange(null); return; }
    const t = templates.find((x) => x.key === key);
    if (t) onChange(stripActive(t));
  };
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-[#0F172A]">Æfingaáætlun</h3>
        <span className="flex-1" />
        <select value={value?.key ?? ""} onChange={(e) => pick(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" aria-label="Æfingasniðmát">
          <option value="">Engin æfingaáætlun</option>
          {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          {value && !templates.some((t) => t.key === value.key) && <option value={value.key}>{value.name} (sérsniðin)</option>}
        </select>
      </div>
      {value && (
        <div className="mt-3 space-y-3">
          {value.sessions.map((s, si) => (
            <details key={si} className="rounded-xl border border-slate-100 p-3" open={si === 0}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">{s.day} · {s.title}</summary>
              <div className="mt-2 space-y-1.5">
                {s.items.map((it, ii) => (
                  <div key={ii} className="flex gap-2">
                    <input value={it.name} aria-label="Æfing"
                      onChange={(e) => onChange({ ...value, key: `${value.key.replace(/-custom$/, "")}-custom`, sessions: value.sessions.map((x, a) => a !== si ? x : { ...x, items: x.items.map((y, b) => b !== ii ? y : { ...y, name: e.target.value }) }) })}
                      className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                    <input value={it.prescription} aria-label="Magn"
                      onChange={(e) => onChange({ ...value, key: `${value.key.replace(/-custom$/, "")}-custom`, sessions: value.sessions.map((x, a) => a !== si ? x : { ...x, items: x.items.map((y, b) => b !== ii ? y : { ...y, prescription: e.target.value }) }) })}
                      className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                    <button aria-label="Fjarlægja æfingu" className="px-1 text-slate-400 hover:text-red-500"
                      onClick={() => onChange({ ...value, sessions: value.sessions.map((x, a) => a !== si ? x : { ...x, items: x.items.filter((_, b) => b !== ii) }) })}>×</button>
                  </div>
                ))}
                <button className="text-xs font-semibold text-orange-700"
                  onClick={() => onChange({ ...value, sessions: value.sessions.map((x, a) => a !== si ? x : { ...x, items: [...x.items, { name: "", prescription: "" }] }) })}>
                  + Bæta við æfingu
                </button>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function NutritionEditor({ value, templates, onChange }: {
  value: ActionPlan["nutrition"];
  templates: NutritionTemplate[];
  onChange: (v: ActionPlan["nutrition"]) => void;
}) {
  const pick = (key: string) => {
    if (!key) { onChange(null); return; }
    const t = templates.find((x) => x.key === key);
    if (t) onChange(stripActive(t));
  };
  return (
    <div className="rounded-2xl border border-lime-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-[#0F172A]">Næringaráætlun</h3>
        <span className="flex-1" />
        <select value={value?.key ?? ""} onChange={(e) => pick(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" aria-label="Næringarsniðmát">
          <option value="">Engin næringaráætlun</option>
          {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </select>
      </div>
      {value && (
        <div className="mt-3 space-y-1.5">
          {value.principles.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input value={p} aria-label="Meginregla"
                onChange={(e) => onChange({ ...value, principles: value.principles.map((x, j) => (j === i ? e.target.value : x)) })}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
              <button aria-label="Fjarlægja" className="px-1 text-slate-400 hover:text-red-500"
                onClick={() => onChange({ ...value, principles: value.principles.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <button className="text-xs font-semibold text-lime-700" onClick={() => onChange({ ...value, principles: [...value.principles, ""] })}>+ Bæta við reglu</button>
        </div>
      )}
    </div>
  );
}
