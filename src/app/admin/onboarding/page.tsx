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
import OnboardingPlayer from "@/app/components/hc/OnboardingPlayer";
import {
  DEFAULT_FLOW, MODULES, flowProblems, moduleDef,
  type FlowStep, type ModuleKind,
} from "@/lib/hc/onboarding-modules";
import { useDialogA11y } from "@/app/admin/components/ui/useDialogA11y";
import { X } from "lucide-react";

interface Flow {
  slug: string; name: string; audience: "all" | "check" | "coach";
  steps: FlowStep[]; active: boolean;
}
interface Lecture { slug: string; title: string; kind: string | null; duration_min: number | null }
interface Funnel { started: number; done: number; stoppedAt: Record<number, number> }

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
  const [funnel, setFunnel] = useState<Record<string, Funnel>>({});
  const [who, setWho] = useState("");
  const [found, setFound] = useState<{ name: string | null; progress: { flow_slug: string; step_index: number; answers: Record<string, unknown>; done_at: string | null } | null } | null | undefined>(undefined);
  const [slug, setSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<Flow | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  /* Which step the preview is showing. Clicking a step in the list moves
     it, so the pane follows what is being edited. */
  const [at, setAt] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  /* Full-screen, for when 390px of phone is not enough to judge a screen. */
  const [bigPreview, setBigPreview] = useState(false);
  const previewRef = useDialogA11y(bigPreview, () => setBigPreview(false));

  const load = useCallback(async () => {
    const { ok, data } = await adminJson<{ flows: Flow[]; lectures: Lecture[]; funnel: Record<string, Funnel> }>("/api/admin/hc/onboarding");
    if (!ok) return;
    setTimeout(() => {
      setFlows(data.flows ?? []);
      setLectures(data.lectures ?? []);
      setFunnel(data.funnel ?? {});
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

  const problems = useMemo(() => (draft ? flowProblems(draft.steps, draft.audience) : []), [draft]);
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
          {!showPreview && (
            <button type="button" onClick={() => setShowPreview(true)}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
              Forskoða
            </button>
          )}
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
          <div className={`grid gap-4 ${showPreview ? "lg:grid-cols-[200px_minmax(0,1fr)_430px]" : "lg:grid-cols-[260px_1fr]"}`}>
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
                        <button type="button" onClick={() => setAt(i)}
                          title="Sýna þetta skref í forskoðun"
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition ${
                            at === i ? "bg-[#047857] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                          {i + 1}
                        </button>
                        <span className="min-w-0 flex-1 font-semibold text-slate-900">{def?.label ?? st.kind}</span>
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                          aria-label="Upp" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === draft.steps.length - 1}
                          aria-label="Niður" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">↓</button>
                        <button type="button" onClick={() => remove(i)}
                          aria-label="Fjarlægja" className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-700"><X className="h-4 w-4" aria-hidden /></button>
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

              {/* Whether anybody finishes it.
                  The composer could arrange a journey and say nothing about
                  how it performs — which is how a flow with a dead step
                  stays published for a month. "Stöðvast á" is the number
                  that tells you WHICH step to change, so it is the one
                  printed largest. */}
              {(() => {
                const f = funnel[draft.slug];
                if (!f?.started) {
                  return (
                    <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                      Enginn hefur farið í gegnum þetta ferli enn.
                    </p>
                  );
                }
                const stops = Object.entries(f.stoppedAt).sort((a, b) => b[1] - a[1]);
                return (
                  <div className="mt-4 rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Hvernig gengur</p>
                    <p className="mt-1 text-sm text-slate-700">
                      <strong className="text-slate-900">{f.done}</strong> af{" "}
                      <strong className="text-slate-900">{f.started}</strong> hafa klárað
                      {f.started > 0 && <span className="text-slate-500"> ({Math.round((f.done / f.started) * 100)}%)</span>}
                    </p>
                    {stops.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {stops.slice(0, 3).map(([idx, n]) => {
                          const st = draft.steps[Number(idx)];
                          const label = st ? (moduleDef(st.kind)?.label ?? st.kind) : "óþekkt skref";
                          return (
                            <li key={idx} className="text-sm text-slate-700">
                              <span className="font-semibold text-amber-800">{n}</span> stöðvast á{" "}
                              <span className="font-semibold">{Number(idx) + 1}. {label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })()}

              {/* One person, by email. For replaying a support ticket:
                  what they answered and where they are. */}
              <div className="mt-3 rounded-xl bg-white p-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Skoða einn notanda</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="netfang"
                    aria-label="Netfang" className="min-h-9 flex-1 rounded-lg border border-slate-300 px-2 text-sm" />
                  <button type="button" disabled={!who.trim()}
                    onClick={() => void (async () => {
                      setFound(undefined);
                      const { ok, data } = await adminJson<{ client: { name: string | null } | null; progress: never }>(
                        `/api/admin/hc/onboarding?client=${encodeURIComponent(who.trim())}`);
                      setFound(ok ? (data.client ? { name: data.client.name, progress: data.progress ?? null } : null) : null);
                    })()}
                    className="min-h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-40">
                    Fletta upp
                  </button>
                </div>
                {found === null && <p className="mt-2 text-sm text-slate-600">Fannst ekki.</p>}
                {found && found !== undefined && (
                  <div className="mt-2 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{found.name ?? "—"}</p>
                    {found.progress ? (
                      <>
                        <p className="text-slate-600">
                          {found.progress.flow_slug} · skref {found.progress.step_index + 1}
                          {found.progress.done_at ? " · klárað" : " · í gangi"}
                        </p>
                        <pre className="mt-1.5 overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
{JSON.stringify(found.progress.answers, null, 1)}
                        </pre>
                      </>
                    ) : <p className="text-slate-600">Hefur ekki byrjað í neinu ferli.</p>}
                  </div>
                )}
              </div>

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

            {/* ── Forskoðun ──────────────────────────────────────────
                The draft as the person will see it, including steps that
                have not been saved. The composer could arrange a flow and
                show nothing of it; the only way to see one was to be a
                client walking it, which is a slow way to notice that a
                heading is wrong.

                It is the real player, not a mock-up — same component the
                app runs — with every write turned off. A preview that
                recorded answers would put the admin in their own funnel. */}
            {showPreview && (
              <aside className="lg:sticky lg:top-6 lg:self-start">
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="flex-1 text-xs font-bold uppercase tracking-wide text-slate-500">Forskoðun</h2>
                  <button type="button" onClick={() => setBigPreview(true)}
                    className="text-xs font-semibold text-hc-brand-text hover:underline">Stækka</button>
                  <button type="button" onClick={() => setShowPreview(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800">Fela</button>
                </div>
                {draft.steps.length === 0 ? (
                  <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-600 shadow-sm">
                    Engin skref til að sýna.
                  </p>
                ) : (
                  /* A phone, because that is what this is walked on. */
                  <div className="overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-[#ECF0F3] shadow-xl">
                    {/* Tall enough to show a whole screen without scrolling
                        the frame: the pillars step is the longest and ran
                        past 600px, so the admin was judging a screen by its
                        top half. */}
                    <div className="h-[760px] overflow-y-auto">
                      <OnboardingPlayer
                        /* Remounted when the arrangement or the focused step
                           changes, so edits show immediately instead of after
                           a reload. */
                        key={`${at}-${draft.steps.map((x) => x.kind + (x.questionKey ?? "") + (x.title ?? "")).join("|")}`}
                        api={adminApi}
                        onFinished={() => {}}
                        preview={{ steps: draft.steps, index: at }}
                      />
                    </div>
                  </div>
                )}
                <p className="mt-2 text-xs leading-snug text-slate-500">
                  Ekkert er vistað héðan. Smelltu á númer skrefs til að sjá það.
                </p>
              </aside>
            )}
          </div>
        )}

        {/* Full screen, phone-shaped.
            Judging a screen inside a 430px column means judging it at a
            size nobody will see it at; this is the same width a phone gives
            it, with room around it to actually look. */}
        {bigPreview && draft && draft.steps.length > 0 && (
          <div ref={previewRef} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
            role="dialog" aria-modal="true" aria-label="Forskoðun">
            <div className="flex max-h-full flex-col items-center gap-3">
              <div className="flex w-full items-center gap-2">
                <p className="flex-1 text-sm font-semibold text-white">
                  {draft.name} · skref {at + 1} af {draft.steps.length}
                </p>
                <button type="button" onClick={() => setAt((v) => Math.max(0, v - 1))} disabled={at === 0}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-30">←</button>
                <button type="button" onClick={() => setAt((v) => Math.min(draft.steps.length - 1, v + 1))}
                  disabled={at >= draft.steps.length - 1}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-30">→</button>
                <button type="button" onClick={() => setBigPreview(false)}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-slate-900">Loka</button>
              </div>
              <div className="overflow-hidden rounded-[2.5rem] border-[10px] border-slate-900 bg-[#ECF0F3] shadow-2xl">
                <div className="h-[80vh] w-[390px] overflow-y-auto">
                  <OnboardingPlayer
                    key={`big-${at}-${draft.steps.map((x) => x.kind + (x.questionKey ?? "") + (x.title ?? "")).join("|")}`}
                    api={adminApi}
                    onFinished={() => {}}
                    preview={{ steps: draft.steps, index: at }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
