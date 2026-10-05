"use client";

// Setting up the training week, one practical question at a time.
//
// The programme itself is one core — two whole-body strength days plus Zone 2,
// with HIIT once it has been earned — so nothing here picks a programme. What
// it asks is the stuff that decides whether the week is actually doable:
// where you train, which days you have, whether your body needs an adaptation
// block first, and what to work around. Each answer narrows the next question,
// and the last step shows the week it produced before anything is saved.
//
// The report pre-fills what it can (see training-suggest.ts) and says why, so
// the limitations step is usually a confirmation rather than a form.

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Dumbbell, Home, Users } from "lucide-react";
import {
  CARDIO_IS, PLACE_IS, PLACES, REGION_IS, REGIONS, previewWeek, SCORE_TONE,
  type CardioLimit, type Place, type Region, type TrainingSettings,
} from "@/lib/hc/adaptive-program";
import { trainingHints } from "@/lib/hc/training-suggest";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/hc/personalise";
import type { Signal } from "@/lib/hc/grunnheilsa";
import { hcBtn, hcCard, hcKicker } from "./ui";
import ActivityEditor from "./ActivityEditor";

const STEPS = ["Hvar", "Mitt núna", "Dagar", "Aðlögun", "Takmarkanir", "Vikan"] as const;

const PLACE_ICON: Record<Place, typeof Home> = { gym: Dumbbell, class: Users, home: Home };

export default function TrainingWizard({ settings, planStart, signals, titles, gym, onSave, onCancel, saving }: {
  settings: TrainingSettings;
  planStart: string | null;
  signals: Record<string, Signal | null>;
  titles?: Record<string, string>;
  gym?: { name: string | null; url: string | null; info: string | null } | null;
  onSave: (s: TrainingSettings) => void;
  onCancel?: () => void;
  saving?: boolean;
}) {
  const hints = trainingHints(signals, titles ?? {});
  const [step, setStep] = useState(0);
  // The report's reading is the starting point, not an answer: it is in the
  // draft from the first render so the person can see and change it.
  const [s, setS] = useState<TrainingSettings>({
    ...settings,
    cardio: settings.cardio === "full" ? hints.cardio : settings.cardio,
  });
  const set = (patch: Partial<TrainingSettings>) => setS((x) => ({ ...x, ...patch }));

  const toggleDay = (d: number) =>
    set({ days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort((a, b) => a - b) });
  const toggleRegion = (r: Region) =>
    set({ injuries: s.injuries.includes(r) ? s.injuries.filter((x) => x !== r) : [...s.injuries, r] });

  const canNext = step !== 2 || s.days.length >= 2;
  const last = step === STEPS.length - 1;

  const card = (on: boolean) =>
    `w-full rounded-2xl p-4 text-left transition ring-1 ${on ? "bg-emerald-50 ring-2 ring-hc-brand" : "bg-white ring-slate-200 hover:ring-slate-300"}`;

  return (
    <section className={`${hcCard.base} p-5 sm:p-6`} aria-label="Uppsetning æfingaáætlunar">
      {/* Where you are in the questions */}
      <ol className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className={`flex h-6 items-center gap-1.5 rounded-full px-2.5 ${
              i === step ? "bg-hc-ink text-white" : i < step ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-500"}`}>
              {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}{label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-3 bg-slate-200" aria-hidden />}
          </li>
        ))}
      </ol>

      {/* 1 ─ where */}
      {step === 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-hc-ink">Hvar æfirðu?</h3>
          <p className="text-sm text-hc-ink-2">
            Veldu allt sem á við — flestir gera fleira en eitt. Áætlunin miðar við best búna staðinn
            sem þú hefur, því þú getur alltaf tekið heimaútgáfuna en ekki öfugt.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PLACES.map((pl) => {
              const Icon = PLACE_ICON[pl];
              return (
                <button key={pl} type="button" aria-pressed={s.places.includes(pl)} className={card(s.places.includes(pl))}
                  onClick={() => set({
                    places: s.places.includes(pl)
                      ? (s.places.length > 1 ? s.places.filter((x) => x !== pl) : s.places)
                      : [...s.places, pl],
                  })}>
                  <Icon className="h-5 w-5 text-hc-brand-dark" aria-hidden />
                  <span className="mt-1.5 block font-semibold text-hc-ink">{PLACE_IS[pl].label}</span>
                  <span className="mt-0.5 block text-xs text-hc-ink-2">{PLACE_IS[pl].hint}</span>
                </button>
              );
            })}
          </div>
          {s.places.includes("class") && (
            <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200">
              <p className="text-sm font-semibold text-sky-900">{gym?.name ? `Hóptímar hjá ${gym.name}` : "Hóptímar"}</p>
              <p className="mt-1 text-sm text-sky-900/80">
                Áætlunin segir þér hvers konar tíma þú átt að sækja hverja viku og hvað þú átt að segja þjálfaranum.
                Tímarnir sjálfir breytast milli vikna, svo við geymum ekki stundaskrána — opnaðu hana hjá stöðinni.
              </p>
              {gym?.info && <p className="mt-1 text-sm text-sky-900/80">{gym.info}</p>}
              {gym?.url && (
                <a href={gym.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-sky-800 underline">
                  Opna stundaskrána →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2 ─ what the week already holds */}
      {step === 1 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-hc-ink">Hvað ertu nú þegar að gera?</h3>
          <p className="text-sm text-hc-ink-2">
            Skráðu það sem er fast í vikunni þinni. Áætlunin fyllir þá bara upp í það sem vantar
            í stað þess að bæta ofan á það sem þú gerir nú þegar.
          </p>
          <ActivityEditor activities={s.activities} onChange={(a) => set({ activities: a })} />
        </div>
      )}

      {/* 3 ─ which days */}
      {step === 2 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-hc-ink">Hvaða daga kemstu?</h3>
          <p className="text-sm text-hc-ink-2">Veldu að minnsta kosti tvo. Styrktaræfingarnar tvær raðast sjálfkrafa með sem mestu millibili og þolið fer á hina dagana.</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((w, i) => (
              <button key={w} type="button" onClick={() => toggleDay(i)} aria-pressed={s.days.includes(i)}
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition ${
                  s.days.includes(i) ? "bg-hc-ink text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span><span className="hidden sm:inline">{w}</span>
              </button>
            ))}
          </div>
          <p className={`text-sm ${s.days.length >= 2 ? "text-hc-ink-2" : "text-amber-800"}`}>
            {s.days.length >= 2 ? `${s.days.length} dagar valdir.` : "Veldu að minnsta kosti tvo daga."}
          </p>
        </div>
      )}

      {/* 4 ─ adaptation block */}
      {step === 3 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-hc-ink">Þarftu aðlögun fyrst?</h3>
          <p className="text-sm text-hc-ink-2">Sinar og liðbönd aðlagast hægar en vöðvarnir. Fjórar vikur af léttu álagi fyrst eru það sem heldur fólki frá meiðslum.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => set({ level: "beginner" })} aria-pressed={s.level === "beginner"} className={card(s.level === "beginner")}>
              <span className="font-semibold text-hc-ink">Já — byrja á aðlögun</span>
              <span className="mt-0.5 block text-xs text-hc-ink-2">Fjórar vikur, létt og tæknin í forgangi. Veldu þetta ef þú hefur ekki lyft reglulega síðustu mánuði.</span>
            </button>
            <button type="button" onClick={() => set({ level: "active" })} aria-pressed={s.level === "active"} className={card(s.level === "active")}>
              <span className="font-semibold text-hc-ink">Nei — ég æfi nú þegar</span>
              <span className="mt-0.5 block text-xs text-hc-ink-2">Byrjar beint á Stigi 1. Veldu þetta ef þú hefur lyft reglulega undanfarið.</span>
            </button>
          </div>
        </div>
      )}

      {/* 5 ─ limitations */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-hc-ink">Er eitthvað sem við þurfum að taka tillit til?</h3>
            {hints.cardioWhy || hints.askWhy
              ? <p className="mt-1 text-sm text-hc-ink-2">{hints.cardioWhy ?? hints.askWhy}</p>
              : <p className="mt-1 text-sm text-hc-ink-2">Skýrslan þín segir ekkert um þetta, svo við spyrjum beint.</p>}
          </div>

          <div>
            <p className={`${hcKicker} mb-2 text-slate-500`}>Þol og hjarta</p>
            <div className="space-y-2">
              {(["full", "easy", "limited"] as CardioLimit[]).map((c) => (
                <button key={c} type="button" onClick={() => set({ cardio: c })} aria-pressed={s.cardio === c} className={card(s.cardio === c)}>
                  <span className="font-semibold text-hc-ink">{CARDIO_IS[c].label}</span>
                  <span className="mt-0.5 block text-xs text-hc-ink-2">{CARDIO_IS[c].hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={`${hcKicker} mb-2 text-slate-500`}>Stoðkerfi</p>
            <p className="mb-2 text-sm text-hc-ink-2">Veldu það sem er viðkvæmt. Hver æfing sem reynir á það skiptist út fyrir mildari útgáfu.</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button key={r} type="button" onClick={() => toggleRegion(r)} aria-pressed={s.injuries.includes(r)}
                  className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition ${
                    s.injuries.includes(r) ? "bg-hc-ink text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  {REGION_IS[r].label}
                </button>
              ))}
              {s.injuries.length === 0 && <span className="self-center text-sm text-slate-500">Ekkert valið — ekkert skipt út.</span>}
            </div>
          </div>
        </div>
      )}

      {/* 5 ─ the week this produced */}
      {step === 5 && <WeekPreview s={s} planStart={planStart} />}

      {/* Moving through */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className={hcBtn.ghost}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
          </button>
        )}
        <span className="flex-1" />
        {onCancel && <button type="button" onClick={onCancel} className={hcBtn.ghost}>Hætta við</button>}
        {last
          ? <button type="button" onClick={() => onSave(s)} disabled={saving} className={hcBtn.primary}>{saving ? "Vista…" : "Vista áætlunina"}</button>
          : <button type="button" onClick={() => setStep(step + 1)} disabled={!canNext} className={hcBtn.primary}>
              Næsta: {STEPS[step + 1]} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>}
      </div>
    </section>
  );
}

/**
 * How well their own week covers each quality, before the plan adds anything.
 *
 * Scored per quality, not as one number: four games of football a week is
 * not "80% trained", it is full marks on intervals and nothing on strength
 * or the easy aerobic base — and that is the sentence worth reading.
 */
function ScoreBars({ s, planStart }: { s: TrainingSettings; planStart: string | null }) {
  const { score } = previewWeek(s, planStart);
  if (s.activities.length === 0) return null;
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-hc-ink">Vikan þín í dag</p>
        <p className="text-sm text-hc-ink-2">{score.overall}/10 · {score.summary}</p>
      </div>
      <dl className="mt-3 space-y-2.5">
        {score.per.map((m) => {
          const tone = SCORE_TONE(m.score);
          return (
            <div key={m.key}>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm font-medium text-slate-700">{m.label}</dt>
                <dd className="text-xs font-semibold tabular-nums text-slate-600">
                  {m.target === 0 ? "ekki á dagskrá enn" : `${m.have} af ${m.target}`}
                </dd>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(4, (m.score / 10) * 100)}%` }} />
              </div>
              {m.gap && <p className="mt-0.5 text-[11px] text-amber-800">{m.gap}</p>}
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** The week the answers produced, before anything is saved. */
function WeekPreview({ s, planStart }: { s: TrainingSettings; planStart: string | null }) {
  const { sessions, stage, hiit } = previewWeek(s, planStart);
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-hc-ink">Vikan þín</h3>
      <p className="text-sm text-hc-ink-2">
        {s.places.map((pl) => PLACE_IS[pl].label).join(" + ")} · {s.days.length} dagar · byrjar á {stage.title.toLowerCase()}
      </p>
      <ScoreBars s={s} planStart={planStart} />

      {sessions.length === 0
        ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">Vikan þín þekur nú þegar allt sem þarf — áætlunin bætir engu ofan á.</p>
        : <p className="text-sm text-hc-ink-2">Áætlunin bætir þessu við:</p>}
      <ol className="space-y-2">
        {sessions.map((x, i) => (
          <li key={i} className="flex items-baseline gap-3 rounded-xl bg-slate-50 p-3">
            <span className="w-24 shrink-0 text-sm font-semibold text-hc-ink">{x.day}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-hc-ink">{x.title}</span>
              <span className="block text-xs text-hc-ink-2">{x.focus}{x.minutes ? ` · um ${x.minutes} mín.` : ""}</span>
            </span>
          </li>
        ))}
      </ol>
      {!hiit.on && hiit.why && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{hiit.why}</p>
      )}
      <p className="text-xs text-slate-500">Þú getur fært æfingarnar á aðra daga og skipt út einstökum æfingum eftir á.</p>
    </div>
  );
}
