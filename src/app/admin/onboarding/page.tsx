"use client";

/*
 * Onboarding, arranged rather than coded.
 *
 * The pieces already existed — a slideshow, a consent form, three questions,
 * a track chooser, 24 lectures, a booking screen — in a fixed order spread
 * across several components. Changing the order meant changing code, which
 * meant the order never changed.
 *
 * Here the left column is the pieces and the right column is the journey.
 * Add, reorder, configure, publish.
 *
 * The one thing this screen does that a list of draggable boxes would not:
 * it checks the ORDER. Every module declares what it needs and what it
 * provides — measurements need a payment, a summary needs answers, a profile
 * needs consent — so an arrangement that would dead-end somebody is refused
 * on publish, with the reason on the step that caused it. Saving a
 * half-arranged draft stays allowed, because half-arranged is what arranging
 * looks like.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStaffGuard } from "@/lib/useStaffGuard";
import { adminApi, adminJson } from "../hc-api";
import {
  DEFAULT_FLOW, MODULES, flowProblems, moduleDef,
  type FlowStep, type ModuleKind,
} from "@/lib/hc/onboarding-modules";

interface Flow {
  slug: string; name: string; audience: "all" | "check" | "coach";
  steps: FlowStep[]; active: boolean;
}
interface Lecture { slug: string; title: string; kind: string | null; duration_min: number | null }

const AUDIENCE_IS: Record<Flow["audience"], string> = {
  all: "Allir", check: "Heilsufarsskoðun", coach: "Þjálfun",
};
const QUESTION_IS: Record<string, string> = {
  goal: "Markmið", move: "Hreyfing í dag", age: "Aldur",
};

let seq = 0;
const newId = (kind: string) => `${kind}-${Date.now().toString(36)}-${seq++}`;

export default function OnboardingAdminPage() {
  const { authorized, loading: guardLoading } = useStaffGuard();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<Flow | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await adminJson<{ flows: Flow[]; lectures: Lecture[] }>("/api/admin/hc/onboarding");
    if (!ok) return;
    setTimeout(() => {
      setFlows(data.flows ?? []);
      setLectures(data.lectures ?? []);
    }, 0);
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      const f = flows.find((x) => x.slug === slug) ?? null;
      setDraft(f ? { ...f, steps: (f.steps ?? []).map((s) => ({ ...s })) } : null);
    }, 0);
    return () => clearTimeout(t);
  }, [slug, flows]);

  const problems = useMemo(() => (draft ? flowProblems(draft.steps) : []), [draft]);
  const problemFor = (id: string) => problems.find((p) => p.id === id)?.message;

  const patch = (i: number, p: Partial<FlowStep>) =>
    setDraft((d) => (d ? { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) } : d));
  const move = (i: number, by: number) =>
    setDraft((d) => {
      if (!d) return d;
      const j = i + by;
      if (j < 0 || j >= d.steps.length) return d;
      const steps = [...d.steps];
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });
  const add = (kind: ModuleKind) =>
    setDraft((d) => (d ? { ...d, steps: [...d.steps, { id: newId(kind), kind }] } : d));
  const remove = (i: number) =>
    setDraft((d) => (d ? { ...d, steps: d.steps.filter((_, j) => j !== i) } : d));

  const save = async (active: boolean) => {
    if (!draft) return;
    setBusy(true); setMsg("");
    const r = await adminApi("/api/admin/hc/onboarding", {
      method: "POST", body: JSON.stringify({ ...draft, active }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Tókst ekki að vista."); return; }
    setMsg(active ? "Birt." : "Vistað sem drög.");
    await load();
  };

  const createFlow = () => {
    const name = window.prompt("Heiti á ferli?");
    if (!name) return;
    const s = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/ö/g, "o")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const f: Flow = {
      slug: s || `ferli-${Date.now().toString(36)}`, name, audience: "all", active: false,
      /* Seeded with what ships today rather than an empty list: a blank page
         is a worse starting point than something to rearrange. */
      steps: DEFAULT_FLOW.map((x) => ({ ...x, id: newId(x.kind) })),
    };
    setFlows((prev) => [...prev, f]);
    setSlug(f.slug);
  };

  if (guardLoading) return <div className="p-8 text-slate-500">Hleð…</div>;
  if (!authorized) return <div className="p-8 text-slate-500">Aðgangur ekki leyfður.</div>;

  return (
    <div className="min-h-screen bg-[#ECF0F3]">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">Innleiðing</h1>
            <p className="text-sm text-slate-600">
              Raðaðu saman ferlinu sem nýr notandi fer í gegnum. Einingarnar eru efni sem er þegar til.
            </p>
          </div>
          <select value={slug ?? ""} onChange={(e) => setSlug(e.target.value || null)}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">Veldu ferli…</option>
            {flows.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.name} · {AUDIENCE_IS[f.audience]}{f.active ? " · birt" : ""}
              </option>
            ))}
          </select>
          <button type="button" onClick={createFlow}
            className="min-h-10 rounded-lg bg-[#047857] px-4 text-sm font-semibold text-white hover:bg-emerald-800">
            Nýtt ferli
          </button>
        </div>

        {msg && <p className="mb-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">{msg}</p>}

        {!draft ? (
          <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
            Veldu ferli eða búðu til nýtt.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            {/* ── the pieces ───────────────────────────────────────── */}
            <aside>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Einingar</h2>
              <ul className="space-y-1.5">
                {MODULES.map((m) => (
                  <li key={m.kind}>
                    <button type="button" onClick={() => add(m.kind)}
                      className="w-full rounded-xl bg-white p-3 text-left shadow-sm transition hover:ring-2 hover:ring-[#047857]/30">
                      <span className="block text-sm font-semibold text-slate-900">{m.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-600">{m.blurb}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            {/* ── the journey ──────────────────────────────────────── */}
            <section>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  aria-label="Heiti" className="min-h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold" />
                <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as Flow["audience"] })}
                  aria-label="Fyrir hverja" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  {(["all", "check", "coach"] as const).map((a) => <option key={a} value={a}>{AUDIENCE_IS[a]}</option>)}
                </select>
              </div>

              <ol className="space-y-2">
                {draft.steps.map((st, i) => {
                  const def = moduleDef(st.kind);
                  const bad = problemFor(st.id);
                  return (
                    <li key={st.id}
                      className={`rounded-xl bg-white p-3 shadow-sm ring-1 ${bad ? "ring-amber-300" : "ring-transparent"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 font-semibold text-slate-900">{def?.label ?? st.kind}</span>
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                          aria-label="Upp" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === draft.steps.length - 1}
                          aria-label="Niður" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">↓</button>
                        <button type="button" onClick={() => remove(i)}
                          aria-label="Fjarlægja" className="rounded px-2 py-1 text-slate-500 hover:bg-red-50 hover:text-red-700">✕</button>
                      </div>

                      {/* Only the fields this kind actually has. */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {def?.config?.includes("lectureSlug") && (
                          <select value={st.lectureSlug ?? ""} onChange={(e) => patch(i, { lectureSlug: e.target.value || null })}
                            aria-label="Fyrirlestur" className="min-h-9 rounded-lg border border-slate-300 px-2 text-sm">
                            <option value="">Veldu fyrirlestur…</option>
                            {lectures.map((l) => (
                              <option key={l.slug} value={l.slug}>
                                {l.title}{l.duration_min ? ` · ${l.duration_min} mín.` : ""}
                              </option>
                            ))}
                          </select>
                        )}
                        {def?.config?.includes("questionKey") && (
                          <select value={st.questionKey ?? ""} onChange={(e) => patch(i, { questionKey: (e.target.value || null) as never })}
                            aria-label="Spurning" className="min-h-9 rounded-lg border border-slate-300 px-2 text-sm">
                            <option value="">Veldu spurningu…</option>
                            {Object.entries(QUESTION_IS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        )}
                        {def?.config?.includes("title") && (
                          <input value={st.title ?? ""} onChange={(e) => patch(i, { title: e.target.value || null })}
                            placeholder="Fyrirsögn (valfrjálst)" aria-label="Fyrirsögn"
                            className="min-h-9 flex-1 rounded-lg border border-slate-300 px-2 text-sm" />
                        )}
                        {def?.config?.includes("skippable") && (
                          <label className="flex items-center gap-1.5 text-xs text-slate-600">
                            <input type="checkbox" checked={st.skippable === true}
                              onChange={(e) => patch(i, { skippable: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-400" />
                            Má sleppa
                          </label>
                        )}
                      </div>

                      {/* The reason, on the step that caused it. */}
                      {bad && <p className="mt-2 text-xs font-semibold text-amber-800">{bad}</p>}
                    </li>
                  );
                })}
                {draft.steps.length === 0 && (
                  <li className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-600 shadow-sm">
                    Veldu einingu til vinstri.
                  </li>
                )}
              </ol>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void save(false)} disabled={busy}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">
                  Vista drög
                </button>
                <button type="button" onClick={() => void save(true)} disabled={busy || problems.length > 0}
                  title={problems.length ? "Lagaðu röðina fyrst" : undefined}
                  className="min-h-10 rounded-lg bg-[#047857] px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                  Birta
                </button>
                {problems.length > 0 && (
                  <span className="text-sm text-amber-800">
                    {problems.length} {problems.length === 1 ? "atriði" : "atriði"} þarf að laga áður en hægt er að birta.
                  </span>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
