"use client";

// The first plan, as four small decisions instead of one big editor.
//
// PlanEditor opens on „Hvað viltu breyta?“ with seven categories, which is
// the right question for somebody who already has a plan and wants to
// change one part of it — and a confusing one for somebody who has nothing
// yet. So a first plan is built here:
//
//   1. Hvert er markmiðið?        a goal, from FIRST_PLAN_SCENARIOS (or the
//                                 report's own suggestions, when there is one)
//   2. Hvað viltu hafa með?       the goal's actions, ticked; untick or add
//   3. Hvenær hentar þér?         training days (only with a programme) and a
//                                 reminder time
//   4. Svona lítur áætlunin út    summary → „Vista áætlun“
//
// Library actions only — the server copies each one from hc_plan_modules and
// never takes text from here (/api/hc/my-plan). Training itself is not
// written: hc_training_settings is its source of truth and is filled in by
// the movement and safety answers („Hreyfing og það sem þarf að varast“).
// Until those exist the chosen days wait in the setup progress.
//
// „Fínstilla nánar“ hands the ticked actions to the full editor.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, FileHeart, Loader2 } from "lucide-react";
import PillarIcon from "./PillarIcon";
import { hcBtn, hcCard } from "./ui";
import { useToast } from "./Toast";
import { usePrograms } from "./ProgramPicker";
import * as cache from "@/lib/hc/client-cache";
import { PILLAR_META, PILLARS, type Pillar, type PlanModule } from "@/lib/hc/types";
import type { ResolvedScenario } from "@/lib/hc/first-plan";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Loaded {
  modules: PlanModule[];
  scenarios?: ResolvedScenario[];
  has_report: boolean;
  suggestions: { key: string; pillar: Pillar; why: string }[];
  staff_drafting: boolean;
}

const WD = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
const WD_LONG = ["mánudaga", "þriðjudaga", "miðvikudaga", "fimmtudaga", "föstudaga", "laugardaga", "sunnudaga"];
const HOURS: { hour: number | null; label: string }[] = [
  { hour: 8, label: "Að morgni, kl. 8" },
  { hour: 12, label: "Í hádeginu, kl. 12" },
  { hour: 20, label: "Að kvöldi, kl. 20" },
  { hour: null, label: "Enga áminningu" },
];

const REPORT_KEY = "__skyrsla";

export default function FirstPlanWizard({ api, onSaved, onAdvanced, trainingSaved, initialDays }: {
  api: Api;
  onSaved: () => void;
  /** The full editor, with these library actions already in. */
  onAdvanced?: (keys: string[]) => void;
  /** hc_training_settings exists, so chosen days can be written there now. */
  trainingSaved?: boolean;
  initialDays?: number[];
}) {
  const [d, setD] = useState<Loaded | null>(null);
  const [err, setErr] = useState("");
  const [part, setPart] = useState(0);
  const [scenario, setScenario] = useState<string | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [days, setDays] = useState<number[]>(initialDays?.length ? initialDays : [0, 2, 4]);
  const [hour, setHour] = useState<number | null | undefined>(undefined);
  const [more, setMore] = useState<Pillar | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedFetched, setSaved] = useState<boolean | null>(null);
  const hasTraining = trainingSaved ?? savedFetched ?? false;
  const initKey = initialDays?.join(",") ?? "";
  const programs = usePrograms(api);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [r, s] = await Promise.all([
        api("/api/hc/my-plan").catch(() => null),
        /* Whether training settings exist and which days were chosen, when
           the caller did not say (the plan page opens this directly). */
        trainingSaved === undefined ? api("/api/hc/setup").catch(() => null) : Promise.resolve(null),
      ]);
      const j = r?.ok ? ((await r.json().catch(() => null)) as Loaded | null) : null;
      const sj = s?.ok ? await s.json().catch(() => null) : null;
      if (!alive) return;
      if (!j) { setErr("Tókst ekki að sækja safnið. Athugaðu nettenginguna og reyndu aftur."); return; }
      if (sj?.context) setSaved(!!sj.context.training_saved);
      if (sj?.progress?.data?.days?.length >= 2 && !initKey) setDays(sj.progress.data.days);
      setD(j);
    })();
    return () => { alive = false; };
  }, [api, trainingSaved, initKey]);

  const byKey = useMemo(() => new Map((d?.modules ?? []).map((m) => [m.key, m])), [d]);
  const options = useMemo<ResolvedScenario[]>(() => {
    if (!d) return [];
    const list = d.scenarios ?? [];
    const fromReport = d.has_report ? d.suggestions.map((s) => s.key).filter((k) => byKey.has(k)) : [];
    return fromReport.length
      ? [{ key: REPORT_KEY, title: "Tillögur úr skýrslunni þinni", line: "Venjur sem tengjast því sem skýrslan bendir á.", module_keys: fromReport.slice(0, 8), exercise_key: null, nutrition_key: null, lecture_slugs: [] }, ...list]
      : list;
  }, [d, byKey]);
  const chosen = options.find((o) => o.key === scenario) ?? null;

  if (err) return <p role="alert" className="text-sm text-hc-bad-ink">{err}</p>;
  if (!d) return <div className="h-64 rounded-hc-card hc-shimmer" aria-busy="true" aria-label="Hleð" />;
  if (d.staff_drafting) {
    return (
      <div className={`${hcCard.base} p-5`}>
        <p className="font-semibold text-hc-ink">Hjúkrunarfræðingur er að ganga frá áætluninni þinni.</p>
        <p className="mt-1 text-sm text-hc-ink-2">Þú getur breytt henni um leið og hún er birt.</p>
      </div>
    );
  }

  const pick = (o: ResolvedScenario) => {
    setScenario(o.key);
    setKeys(o.module_keys);
    setMore(o.key === "safn" ? "exercise" : null);
    setPart(1);
  };
  const toggle = (k: string) => setKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : cur.length >= 12 ? cur : [...cur, k]));
  const exName = chosen?.exercise_key ? programs?.exercise.find((p) => p.key === chosen.exercise_key)?.name ?? null : null;
  const nuName = chosen?.nutrition_key ? programs?.nutrition.find((p) => p.key === chosen.nutrition_key)?.name ?? null : null;
  const pillarsIn = PILLARS.filter((p) => keys.some((k) => byKey.get(k)?.pillar === p));

  const save = async () => {
    if (busy || !chosen || !keys.length) return;
    setBusy(true); setErr("");
    const r = await api("/api/hc/my-plan", {
      method: "POST",
      body: JSON.stringify({
        items: keys.map((k) => ({ key: k })),
        goals: [],
        lecture_slugs: chosen.lecture_slugs,
        ...(chosen.exercise_key ? { exercise_key: chosen.exercise_key } : {}),
        ...(chosen.nutrition_key ? { nutrition_key: chosen.nutrition_key } : {}),
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) {
      setBusy(false);
      const why = typeof j.error === "string" && /[áéíóúýþæöð]/i.test(j.error) ? j.error : "Tókst ekki að vista. Reyndu aftur.";
      setErr(why);
      toast.show(why, { tone: "bad" });
      return;
    }
    /* The days: into the training settings if they exist; otherwise kept
       with the setup until the movement and safety answers create them,
       so a choice of days never stands in for those answers. */
    if (chosen.exercise_key) {
      if (hasTraining) await api("/api/hc/training", { method: "POST", body: JSON.stringify({ training_days: days }) }).catch(() => null);
      else await api("/api/hc/setup", { method: "POST", body: JSON.stringify({ data: { days } }) }).catch(() => null);
    }
    /* The time only. Which channel (push, email, SMS) stays the person's
       own choice under Áminningar, so nothing is switched on here. */
    if (hour !== undefined && hour !== null) {
      const n = await api("/api/hc/nudges").then((x) => (x.ok ? x.json() : null)).catch(() => null);
      const prefs = n?.prefs ?? { channels: [], mode: "daily" };
      await api("/api/hc/nudges", { method: "POST", body: JSON.stringify({ channels: prefs.channels ?? [], mode: prefs.mode ?? "daily", hour }) }).catch(() => null);
    }
    await api("/api/hc/setup", { method: "POST", body: JSON.stringify({ data: { scenario: chosen.key, hour: hour ?? null } }) }).catch(() => null);
    cache.invalidate("/api/hc/");
    setBusy(false);
    toast.show("Áætlunin er vistuð", { tone: "ok" });
    onSaved();
  };

  const nav = (canNext: boolean, nextLabel = "Áfram") => (
    <div className="mt-5 flex items-center justify-between gap-3">
      <button type="button" onClick={() => setPart((p) => Math.max(0, p - 1))}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-hc-ink-2 hover:text-hc-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
      </button>
      <button type="button" disabled={!canNext} onClick={() => setPart((p) => p + 1)} className={hcBtn.cta}>
        {nextLabel} <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );

  return (
    <div>
      <p className="text-xs font-semibold text-hc-ink-3" aria-live="polite">Hluti {part + 1} af 4</p>

      {part === 0 && (
        <section>
          <h3 className="mt-1 text-lg font-bold text-hc-ink">Hvert er markmiðið?</h3>
          <p className="mt-1 text-sm text-hc-ink-2">Veldu það sem skiptir mestu núna. Þú getur bætt við og breytt síðar.</p>
          <ul className="mt-4 space-y-2">
            {options.map((o) => (
              <li key={o.key}>
                <button type="button" onClick={() => pick(o)} aria-pressed={scenario === o.key}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-hc-element border-2 px-4 py-3 text-left transition ${
                    scenario === o.key ? "border-hc-brand-dark bg-hc-brand-surface" : "border-hc-border bg-hc-surface hover:border-hc-control"}`}>
                  {o.key === REPORT_KEY && <FileHeart className="h-5 w-5 shrink-0 text-hc-brand-text" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-hc-ink">{o.title}</span>
                    <span className="mt-0.5 block text-sm text-hc-ink-2">{o.line}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-hc-ink-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {part === 1 && chosen && (
        <section>
          <h3 className="mt-1 text-lg font-bold text-hc-ink">Hvað viltu hafa með?</h3>
          <p className="mt-1 text-sm text-hc-ink-2">
            {chosen.key === "safn" ? "Hakaðu við það sem þú vilt byrja á. Færri venjur eru oft betri byrjun." : "Þetta fylgir markmiðinu. Taktu út það sem hentar ekki og bættu við ef þú vilt."}
          </p>
          {keys.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {keys.map((k) => {
                const m = byKey.get(k);
                if (!m) return null;
                return (
                  <li key={k}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-hc-element bg-hc-surface px-3 py-2 ring-1 ring-hc-hairline">
                      <input type="checkbox" checked onChange={() => toggle(k)} className="h-5 w-5 shrink-0 accent-[#047857]" />
                      <PillarIcon pillar={m.pillar} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-hc-ink">{m.title}</span>
                        {m.frequency && <span className="block text-xs text-hc-ink-3">{m.frequency}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4">
            <p className="text-sm font-semibold text-hc-ink">Bæta við úr safninu</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PILLARS.map((p) => (
                <button key={p} type="button" onClick={() => setMore(more === p ? null : p)} aria-expanded={more === p}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${
                    more === p ? "border-hc-brand-dark bg-hc-brand-surface text-hc-ink" : "border-hc-control bg-hc-surface text-hc-ink-2"}`}>
                  {PILLAR_META[p].label}
                  <ChevronDown className={`h-4 w-4 transition ${more === p ? "rotate-180" : ""}`} aria-hidden />
                </button>
              ))}
            </div>
            {more && (
              <ul className="mt-2 space-y-1.5">
                {d.modules.filter((m) => m.pillar === more && !keys.includes(m.key)).map((m) => (
                  <li key={m.key}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-hc-element px-3 py-2 ring-1 ring-hc-hairline hover:bg-hc-sunken">
                      <input type="checkbox" checked={false} onChange={() => toggle(m.key)} className="h-5 w-5 shrink-0 accent-[#047857]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-hc-ink">{m.title}</span>
                        <span className="block text-xs text-hc-ink-3">{m.summary}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!keys.length && <p className="mt-3 text-sm text-hc-ink-3">Veldu minnst eina venju til að halda áfram.</p>}
          {nav(keys.length > 0)}
        </section>
      )}

      {part === 2 && chosen && (
        <section>
          <h3 className="mt-1 text-lg font-bold text-hc-ink">Hvenær hentar þér?</h3>
          {chosen.exercise_key && (
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-hc-ink">Æfingadagar</legend>
              <p className="text-xs text-hc-ink-3">Veldu minnst tvo daga. Æfingarnar raðast á þá.</p>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {WD.map((w, i) => {
                  const on = days.includes(i);
                  return (
                    <button key={w} type="button" aria-pressed={on} aria-label={WD_LONG[i]}
                      onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== i) : [...cur, i].sort()))}
                      className={`min-h-11 rounded-hc-element border-2 text-sm font-semibold ${
                        on ? "border-hc-brand-dark bg-hc-brand-surface text-hc-ink" : "border-hc-border bg-hc-surface text-hc-ink-2"}`}>
                      {w}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-hc-ink">Hvenær viltu fá áminningu?</legend>
            <p className="text-xs text-hc-ink-3">Hvort hún berst með tölvupósti, SMS eða tilkynningu velur þú í skrefinu Áminningar.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {HOURS.map((h) => (
                <button key={h.label} type="button" aria-pressed={hour === h.hour} onClick={() => setHour(h.hour)}
                  className={`min-h-11 rounded-hc-element border-2 px-3 text-left text-sm font-semibold ${
                    hour === h.hour ? "border-hc-brand-dark bg-hc-brand-surface text-hc-ink" : "border-hc-border bg-hc-surface text-hc-ink-2"}`}>
                  {h.label}
                </button>
              ))}
            </div>
          </fieldset>
          {nav(!chosen.exercise_key || days.length >= 2)}
        </section>
      )}

      {part === 3 && chosen && (
        <section>
          <h3 className="mt-1 text-lg font-bold text-hc-ink">Svona lítur áætlunin þín út</h3>
          <div className="mt-4 space-y-3">
            {pillarsIn.map((p) => (
              <div key={p} className="rounded-hc-element bg-hc-surface p-3 ring-1 ring-hc-hairline">
                <p className="flex items-center gap-2 text-sm font-bold text-hc-ink"><PillarIcon pillar={p} size="sm" /> {PILLAR_META[p].label}</p>
                <ul className="mt-2 space-y-1">
                  {keys.filter((k) => byKey.get(k)?.pillar === p).map((k) => (
                    <li key={k} className="flex items-start gap-2 text-sm text-hc-ink-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />
                      <span>{byKey.get(k)?.title}{byKey.get(k)?.frequency ? <span className="text-hc-ink-3"> · {byKey.get(k)?.frequency}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {(chosen.exercise_key || chosen.nutrition_key || (hour !== undefined && hour !== null)) && (
              <dl className="rounded-hc-element bg-hc-sunken p-3 text-sm">
                {chosen.exercise_key && (
                  <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-hc-ink">Æfingaáætlun:</dt>
                    <dd className="text-hc-ink-2">{exName ?? "fylgir"}, {days.map((x) => WD[x].toLowerCase()).join(", ")}</dd></div>
                )}
                {chosen.nutrition_key && (
                  <div className="mt-1 flex flex-wrap gap-x-2"><dt className="font-semibold text-hc-ink">Næring:</dt><dd className="text-hc-ink-2">{nuName ?? "fylgir"}</dd></div>
                )}
                {hour !== undefined && hour !== null && (
                  <div className="mt-1 flex flex-wrap gap-x-2"><dt className="font-semibold text-hc-ink">Áminning:</dt><dd className="text-hc-ink-2">kl. {hour}</dd></div>
                )}
              </dl>
            )}
            {chosen.exercise_key && !hasTraining && (
              <p className="text-xs leading-relaxed text-hc-ink-3">
                Áður en fyrsta æfingin hefst spyrjum við hvað þú hreyfir þig mikið og hvort eitthvað þurfi að varast, svo æfingarnar henti þér.
              </p>
            )}
          </div>
          {err && <p role="alert" className="mt-3 text-sm text-hc-bad-ink">{err}</p>}
          <button type="button" onClick={() => void save()} disabled={busy} className={`${hcBtn.cta} mt-5 w-full`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Vista áætlun
          </button>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setPart(2)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-hc-ink-2 hover:text-hc-ink">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
            </button>
            {onAdvanced && (
              <button type="button" onClick={() => onAdvanced(keys)} className="min-h-11 text-sm font-semibold text-hc-brand-text underline">
                Fínstilla nánar
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
