"use client";

/*
 * Plays whatever the admin arranged.
 *
 * The composer at /admin/onboarding produces an ordered list of modules;
 * this renders them one at a time and records where somebody has got to. The
 * point of the pair is that changing the order is a publish rather than a
 * deploy.
 *
 * Two things it refuses to do, both learned from the flow it replaces:
 *
 *   It never blocks the app. No published flow, a failed fetch, an unknown
 *   module kind — each of those falls through to the app rather than to a
 *   blank screen. Onboarding that can strand somebody is worse than no
 *   onboarding, and the old sequence could strand you behind an email
 *   confirmation with no way past.
 *
 *   It never silently loses an answer. Each answer is written when it is
 *   given, not batched at the end, so closing the tab halfway through costs
 *   the current screen and nothing before it.
 *
 * Modules with their own screens elsewhere in the product — package,
 * measurements — are links into those screens rather than copies of them. A
 * second checkout is a second place for a payment bug to live.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2, Stethoscope, Dumbbell, ExternalLink } from "lucide-react";
import { AGES, GOALS, MOVES, daysPerWeek, previewLines, suggestsCheck, type StartAnswers } from "@/lib/hc/start-flow";
import { moduleDef, type FlowStep } from "@/lib/hc/onboarding-modules";
import { PUBLIC_PRIVACY_VERSION, PUBLIC_TERMS_VERSION } from "@/lib/public-pages-content";
import { supabase } from "@/lib/supabase";
import InstallGuide from "./InstallGuide";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Flow { slug: string; name: string; steps: FlowStep[] }
interface Lecture { slug: string; title: string; subtitle: string | null; kind: string | null; article_md: string | null; video_url: string | null; duration_min: number | null }

/** The four pillars, self-rated. Three bands rather than a 1-10 slider: a
 *  number somebody invents to two digits of precision is a number that
 *  misleads the programme that reads it. */
const PILLARS = [
  /* `dative` exists because "Byrjum á …" governs it, and the nominative
     label cannot be bent into that sentence by a join. Carrying both beats
     discovering at runtime that the heading and the sentence need different
     forms of the same word. */
  { key: "sleep", label: "Svefn", dative: "svefni", hint: "Hvernig sefur þú að jafnaði?" },
  { key: "nutrition", label: "Næring", dative: "næringu", hint: "Hvernig borðar þú að jafnaði?" },
  { key: "exercise", label: "Hreyfing", dative: "hreyfingu", hint: "Hvernig gengur hreyfingin?" },
  { key: "mental", label: "Andleg líðan", dative: "andlegri líðan", hint: "Hvernig líður þér andlega?" },
] as const;

/** "a, b og c" — not "a og b og c", which is what a plain join gives. */
function listIs(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} og ${xs[xs.length - 1]}`;
}
const BANDS = [
  { key: "low", label: "Illa" },
  { key: "mid", label: "Svona la la" },
  { key: "high", label: "Vel" },
] as const;

/** What changes an exercise prescription. Multi-select, and "ekkert" is an
 *  explicit answer rather than an empty one — a blank here is
 *  indistinguishable from a skipped screen otherwise. */
const LIMITS = [
  { key: "knee", label: "Hné" },
  { key: "back", label: "Bak" },
  { key: "shoulder", label: "Öxl" },
  { key: "hip", label: "Mjöðm" },
  { key: "heart", label: "Hjarta eða blóðþrýstingur" },
  { key: "pregnant", label: "Þungun" },
  { key: "other", label: "Annað" },
] as const;

const QUESTIONS = {
  goal: { title: "Hvað ertu að leita að?", hint: "Veldu það sem skiptir mestu núna.", options: GOALS },
  move: { title: "Hvað hreyfir þú þig mikið núna?", hint: "Við byrjum þar sem þú ert.", options: MOVES },
  age: { title: "Á hvaða aldri ertu?", hint: "Viðmiðin okkar eru aldursbundin.", options: AGES },
} as const;

export default function OnboardingPlayer({ api, onFinished, preview }: {
  api: Api;
  /** Called when the flow completes, so the app can reload and show itself. */
  onFinished: () => void;
  /**
   * Render an unsaved arrangement instead of the published one.
   *
   * The composer had no way to show its own work: you arranged a flow, you
   * published it, and the only way to see it was to be a client walking it.
   * With this it renders the draft as it stands — including steps that have
   * not been saved — so the thing being edited and the thing being looked at
   * are the same thing.
   *
   * Everything that writes is a no-op here. A preview that recorded answers
   * would mark the admin as having started the flow, and "started: 1" in
   * their own funnel is a number that means nothing.
   */
  preview?: { steps: FlowStep[]; index: number };
}) {
  const [flow, setFlow] = useState<Flow | null | undefined>(undefined);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [accept, setAccept] = useState(false);
  const [lecture, setLecture] = useState<Lecture | null>(null);

  useEffect(() => {
    if (preview) {
      const t = setTimeout(() => {
        setFlow({ slug: "preview", name: "Forskoðun", steps: preview.steps });
        setI(Math.min(preview.index, Math.max(preview.steps.length - 1, 0)));
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      const r = await api("/api/hc/onboarding").catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      /* Anything other than a published flow means "not my problem" — and
         it has to SAY so, not merely render nothing. A player that returns
         null while its parent waits for it leaves an empty screen, which is
         the exact failure this is meant to prevent. */
      if (!j?.flow || j.done || !j.flow.steps?.length) { setFlow(null); onFinished(); return; }
      setFlow(j.flow);
      setI(j.stepIndex ?? 0);
      setAnswers(j.answers ?? {});
    }, 0);
    return () => clearTimeout(t);
  }, [api, onFinished, preview]);

  const step: FlowStep | undefined = flow?.steps[i];

  /* A lecture step needs its lecture. Fetched per step rather than up front:
     a flow with six lectures should not cost six requests to show the first
     screen. */
  useEffect(() => {
    if (step?.kind !== "lecture" || !step.lectureSlug) {
      /* Deferred like every other set in this file: the compiler rejects a
         synchronous set inside an effect. */
      const c = setTimeout(() => setLecture(null), 0);
      return () => clearTimeout(c);
    }
    const slug = step.lectureSlug;
    const t = setTimeout(async () => {
      const r = await api(`/api/hc/lectures/${encodeURIComponent(slug)}`).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      setLecture(j?.lecture ?? j ?? null);
    }, 0);
    return () => clearTimeout(t);
  }, [api, step?.kind, step?.lectureSlug]);

  const post = useCallback(async (payload: Record<string, unknown>) => {
    /* The preview answers locally and tells the server nothing. */
    if (preview) return { ok: true, stepIndex: i, done: false };
    const r = await api("/api/hc/onboarding", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    return r?.ok ? await r.json().catch(() => null) : null;
  }, [api, preview, i]);

  const advance = useCallback(async () => {
    if (!flow) return;
    setBusy(true);
    const j = await post({ action: "advance" });
    setBusy(false);
    if (j?.done || i + 1 >= flow.steps.length) { onFinished(); return; }
    setI(typeof j?.stepIndex === "number" ? j.stepIndex : i + 1);
  }, [flow, i, post, onFinished]);

  const back = useCallback(async () => {
    setBusy(true);
    const j = await post({ action: "back" });
    setBusy(false);
    setI(typeof j?.stepIndex === "number" ? j.stepIndex : Math.max(0, i - 1));
  }, [i, post]);

  /* Written as it is given. Batching to the end means a closed tab costs
     everything rather than the current screen. */
  const answer = useCallback(async (key: string, value: string) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    await post({ action: "answer", key, value });
    await advance();
  }, [post, advance]);

  const asStart: StartAnswers = useMemo(() => ({
    goal: answers.goal as StartAnswers["goal"],
    move: answers.move as StartAnswers["move"],
    age: answers.age as StartAnswers["age"],
  }), [answers]);

  if (flow === undefined) {
    return <div className="grid min-h-[50vh] place-items-center text-sm text-hc-ink-2">Hleð…</div>;
  }
  if (flow === null || !step) return null;

  const def = moduleDef(step.kind);
  const total = flow.steps.length;

  return (
    <div className="mx-auto max-w-lg px-5 pb-16">
      <header className="sticky top-0 z-10 -mx-5 mb-5 bg-hc-page/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void back()} disabled={i === 0 || busy}
            aria-label="Til baka" className="rounded-lg p-1.5 text-hc-ink-2 hover:bg-hc-sunken disabled:opacity-30">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hc-sunken-2">
            <div className="h-full rounded-full bg-hc-brand-dark transition-all duration-300"
              style={{ width: `${((i + 1) / total) * 100}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-hc-ink-3">
            {i + 1}/{total}
          </span>
        </div>
      </header>

      {step.kind === "question" && step.questionKey && (() => {
        const q = QUESTIONS[step.questionKey];
        const chosen = answers[step.questionKey];
        return (
          <section>
            <h1 className="text-2xl font-bold leading-tight text-hc-ink">{step.title || q.title}</h1>
            <p className="mt-1.5 text-sm text-hc-ink-2">{q.hint}</p>
            <div className="mt-5 space-y-2.5">
              {q.options.map((o: { key: string; label: string; hint?: string }) => (
                <button key={o.key} type="button" disabled={busy}
                  onClick={() => void answer(step.questionKey!, o.key)} aria-pressed={chosen === o.key}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-hc-surface px-4 py-3 text-left transition ${
                    chosen === o.key ? "border-hc-brand-dark" : "border-transparent hover:border-hc-control"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-hc-ink">{o.label}</span>
                    {o.hint && <span className="mt-0.5 block text-xs text-hc-ink-3">{o.hint}</span>}
                  </span>
                  {chosen === o.key && <Check className="h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />}
                </button>
              ))}
            </div>
          </section>
        );
      })()}

      {step.kind === "pillars" && (() => {
        /* All four on one screen, not four screens. They are the same
           question asked four times and splitting them would quadruple the
           length of the flow for no extra information. */
        const got = PILLARS.filter((x) => answers[`pillar_${x.key}`]).length;
        return (
          <section>
            <h1 className="text-2xl font-bold leading-tight text-hc-ink">{step.title || "Hverju viltu breyta?"}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-hc-ink-2">
              Þitt eigið mat á því hvar skórinn kreppir. Við notum það til að velja hvar við byrjum —
              þetta er ekki heilsufarsmat og ekki einkunn.
            </p>
            <div className="mt-5 space-y-4">
              {PILLARS.map((pl) => (
                <div key={pl.key}>
                  <p className="text-sm font-semibold text-hc-ink">{pl.label}</p>
                  <p className="text-xs text-hc-ink-3">{pl.hint}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    {BANDS.map((bd) => {
                      const on = answers[`pillar_${pl.key}`] === bd.key;
                      return (
                        <button key={bd.key} type="button" disabled={busy}
                          onClick={() => void post({ action: "answer", key: `pillar_${pl.key}`, value: bd.key })
                            .then(() => setAnswers((a) => ({ ...a, [`pillar_${pl.key}`]: bd.key })))}
                          aria-pressed={on}
                          className={`min-h-11 flex-1 rounded-xl border-2 px-2 text-sm font-semibold transition ${
                            on ? "border-hc-brand-dark bg-hc-ok-surface text-hc-ok-ink" : "border-transparent bg-hc-surface text-hc-ink-2"}`}>
                          {bd.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => void advance()} disabled={busy || got < PILLARS.length}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-hc-brand-dark py-3 font-bold text-white disabled:opacity-50">
              Áfram <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            {got < PILLARS.length && (
              <p className="mt-2 text-center text-xs text-hc-ink-3">
                {PILLARS.length - got} eftir af fjórum.
              </p>
            )}
          </section>
        );
      })()}

      {step.kind === "limits" && (() => {
        const chosen = (answers.limits ?? "").split(",").filter(Boolean);
        const toggle = async (k: string) => {
          const next = k === "none" ? ["none"]
            : chosen.filter((x) => x !== "none").includes(k)
              ? chosen.filter((x) => x !== k && x !== "none")
              : [...chosen.filter((x) => x !== "none"), k];
          const v = next.join(",");
          setAnswers((a) => ({ ...a, limits: v }));
          await post({ action: "answer", key: "limits", value: v });
        };
        return (
          <section>
            <h1 className="text-2xl font-bold leading-tight text-hc-ink">{step.title || "Er eitthvað sem þarf að taka tillit til?"}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-hc-ink-2">
              Verkir, meiðsli eða annað sem breytir æfingum. Við sníðum prógrammið að þessu — og þjálfarinn sér það.
            </p>
            <div className="mt-5 space-y-2">
              {LIMITS.map((l) => {
                const on = chosen.includes(l.key);
                return (
                  <button key={l.key} type="button" disabled={busy} onClick={() => void toggle(l.key)} aria-pressed={on}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 bg-hc-surface px-4 text-left font-semibold transition ${
                      on ? "border-hc-brand-dark" : "border-transparent"}`}>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 ${
                      on ? "border-hc-brand-dark bg-hc-brand-dark text-white" : "border-hc-control"}`}>
                      {on && <Check className="h-3 w-3" aria-hidden />}
                    </span>
                    <span className="text-hc-ink">{l.label}</span>
                  </button>
                );
              })}
              {/* An explicit no. A blank answer here is indistinguishable
                  from a screen somebody skipped. */}
              <button type="button" disabled={busy} onClick={() => void toggle("none")} aria-pressed={chosen.includes("none")}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 bg-hc-surface px-4 text-left font-semibold transition ${
                  chosen.includes("none") ? "border-hc-brand-dark" : "border-transparent"}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  chosen.includes("none") ? "border-hc-brand-dark bg-hc-brand-dark text-white" : "border-hc-control"}`}>
                  {chosen.includes("none") && <Check className="h-3 w-3" aria-hidden />}
                </span>
                <span className="text-hc-ink">Nei, ekkert af þessu</span>
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-hc-ink-3">
              Þetta er ekki sjúkraskrá. Ef eitthvað er bráðatilfelli, hringdu í 112.
            </p>
            <button type="button" onClick={() => void advance()} disabled={busy || chosen.length === 0}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-hc-brand-dark py-3 font-bold text-white disabled:opacity-50">
              Áfram <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </section>
        );
      })()}

      {step.kind === "recommend" && (() => {
        const weak = PILLARS.filter((x) => answers[`pillar_${x.key}`] === "low").map((x) => x.dative);
        const lim = (answers.limits ?? "").split(",").filter((x) => x && x !== "none");
        return (
          <section>
            <h1 className="text-2xl font-bold text-hc-ink">{step.title || "Svona leggjum við upp"}</h1>
            <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">
            Gróft snið til að byrja með. Þú stillir það sjálf/ur í appinu og þjálfarinn fer yfir það með þér.
          </p>
            <ul className="mt-5 space-y-2">
              {previewLines(asStart).map((l) => (
                <li key={l} className="flex items-start gap-2.5 rounded-xl bg-hc-surface p-3.5 shadow-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
                  <span className="text-sm text-hc-ink">{l}</span>
                </li>
              ))}
              {weak.length > 0 && (
                <li className="flex items-start gap-2.5 rounded-xl bg-hc-surface p-3.5 shadow-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
                  <span className="text-sm text-hc-ink">Byrjum á {listIs(weak)}</span>
                </li>
              )}
              {lim.length > 0 && (
                <li className="flex items-start gap-2.5 rounded-xl bg-hc-warn-surface p-3.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-warn-ink" aria-hidden />
                  <span className="text-sm text-hc-ink">Æfingar aðlagaðar — þjálfarinn fær upplýsingarnar þínar</span>
                </li>
              )}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-hc-ink-3">
              Lifeline mælir og fylgist með — við greinum ekki sjúkdóma og komum ekki í stað læknis.
            </p>
          </section>
        );
      })()}

      {step.kind === "summary" && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || "Þetta leggjum við til"}</h1>
          <p className="mt-1 text-sm text-hc-ink-2">Byggt á svörunum þínum. Þjálfarinn fínstillir þetta með þér.</p>
          <ul className="mt-5 space-y-2">
            {previewLines(asStart).map((l) => (
              <li key={l} className="flex items-start gap-2.5 rounded-xl bg-hc-surface p-3.5 shadow-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
                <span className="text-sm text-hc-ink">{l}</span>
              </li>
            ))}
          </ul>
          {/* Said wherever a plan is shown, not only at the end. */}
          <p className="mt-4 text-xs leading-relaxed text-hc-ink-3">
            Lifeline mælir og fylgist með — við greinum ekki sjúkdóma og komum ekki í stað læknis.
          </p>
        </section>
      )}

      {step.kind === "track" && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || "Hvernig viltu byrja?"}</h1>
          <p className="mt-1 text-sm text-hc-ink-2">
            {suggestsCheck(asStart)
              ? "Miðað við svörin þín mælum við með að byrja á mælingum."
              : "Miðað við svörin þín kemstu beint af stað í þjálfun."}
          </p>
          <div className="mt-5 space-y-3">
            {([
              { k: "check", icon: <Stethoscope className="h-5 w-5" aria-hidden />, t: "Heilsufarsskoðun",
                b: "Mælingar og blóðprufa, skýrsla sem læknir fer yfir, og áætlun út frá þínum tölum." },
              { k: "coach", icon: <Dumbbell className="h-5 w-5" aria-hidden />, t: "Þjálfun í appinu",
                b: `${daysPerWeek(asStart.move)} æfingar á viku, næring og svefn — án mælinga til að byrja með.` },
            ] as const).map((r) => (
              <button key={r.k} type="button" disabled={busy}
                onClick={() => void (async () => {
                  /* The track is a property of the journey, not of this
                     flow, so it is set where every other screen reads it. */
                  await api("/api/hc/journey", {
                    method: "POST", body: JSON.stringify({ action: "choose_track", track: r.k }),
                  }).catch(() => null);
                  await answer("track", r.k);
                })()}
                aria-pressed={answers.track === r.k}
                className={`w-full rounded-2xl border-2 bg-hc-surface p-4 text-left transition ${
                  answers.track === r.k ? "border-hc-brand-dark" : "border-transparent hover:border-hc-control"}`}>
                <span className="flex items-center gap-2">
                  <span className="text-hc-brand-text">{r.icon}</span>
                  <span className="font-bold text-hc-ink">{r.t}</span>
                  {suggestsCheck(asStart) === (r.k === "check") && (
                    <span className="rounded-full bg-hc-ok-surface px-2 py-0.5 text-[11px] font-bold text-hc-ok-ink">Mælt með</span>
                  )}
                </span>
                <span className="mt-1.5 block text-sm leading-relaxed text-hc-ink-2">{r.b}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step.kind === "consent" && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || "Skilmálar"}</h1>
          <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">
            Áður en við vistum heilsufarsupplýsingar þarftu að samþykkja skilmálana.
          </p>
          <label className="mt-5 flex items-start gap-2.5 rounded-2xl bg-hc-surface p-4 shadow-sm">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-hc-control" />
            <span className="text-sm leading-snug text-hc-ink">
              Ég samþykki{" "}
              <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline">notkunarskilmála</a>{" "}og{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold underline">persónuverndarstefnu</a>{" "}
              Lifeline Health ({PUBLIC_TERMS_VERSION}).
            </span>
          </label>
          <button type="button" disabled={!accept || busy}
            onClick={() => void (async () => {
              /* Written the same way the signup form writes it: the view
                 that encrypts, the person's own session, the same version
                 string. A second path to the same column is a second thing
                 to keep in step. */
              const { data: s } = await supabase.auth.getSession();
              const uid = s.session?.user?.id;
              if (uid) {
                await supabase.from("clients_decrypted").update({
                  terms_accepted_at: new Date().toISOString(),
                  terms_version: `tos-${PUBLIC_TERMS_VERSION}+priv-${PUBLIC_PRIVACY_VERSION}`,
                }).eq("id", uid);
              }
              await answer("consent", "yes");
            })()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-hc-brand-dark py-3 font-bold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Samþykkja
          </button>
        </section>
      )}

      {step.kind === "lecture" && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || lecture?.title || "Fræðsla"}</h1>
          {lecture?.subtitle && <p className="mt-1 text-sm text-hc-ink-2">{lecture.subtitle}</p>}
          {lecture ? (
            <div className="mt-4 rounded-2xl bg-hc-surface p-4 shadow-sm">
              {lecture.video_url && (
                <a href={lecture.video_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-hc-brand-text underline">
                  Horfa á myndbandið <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
              {lecture.article_md && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-hc-ink-2">
                  {lecture.article_md.slice(0, 1200)}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-hc-ink-3">Hleð…</p>
          )}
        </section>
      )}

      {step.kind === "install" && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || "Settu appið á heimaskjáinn"}</h1>
          <div className="mt-4"><InstallGuide /></div>
        </section>
      )}

      {/* Screens that exist elsewhere are linked, never copied: a second
          checkout is a second place for a payment bug to live. */}
      {(step.kind === "package" || step.kind === "measurements" || step.kind === "profile" || step.kind === "notifications" || step.kind === "welcome") && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || def?.label}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-hc-ink-2">{def?.blurb}</p>
          {step.kind === "package" && (
            <Link href="/app?start=1" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-hc-brand-dark px-5 font-semibold text-white">
              Opna pakkana
            </Link>
          )}
          {step.kind === "measurements" && (
            <Link href="/app" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-hc-brand-dark px-5 font-semibold text-white">
              Bóka tíma
            </Link>
          )}
          {step.kind === "profile" && (
            <Link href="/app/adgangur" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-hc-brand-dark px-5 font-semibold text-white">
              Fylla út upplýsingar
            </Link>
          )}
        </section>
      )}

      {/* Advance is always available except on the screens that advance
          themselves when answered. "Má sleppa" is the admin's choice and
          shows as a quieter way past. */}
      {step.kind !== "question" && step.kind !== "track" && step.kind !== "consent"
        && step.kind !== "pillars" && step.kind !== "limits" && (
        <button type="button" onClick={() => void advance()} disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-hc-brand-dark py-3 font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Áfram <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      )}
      {step.skippable && (
        <button type="button" onClick={() => void advance()} disabled={busy}
          className="mt-2 w-full py-2 text-center text-sm font-semibold text-hc-ink-3 underline">
          Sleppa í bili
        </button>
      )}
    </div>
  );
}
