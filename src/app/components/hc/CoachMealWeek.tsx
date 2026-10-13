"use client";

// What the participant is actually eating this week — for the coach.
//
// ── The gap this closes ─────────────────────────────────────────────────
//
// A coach could pick a nutrition template and write its principles, and
// then had no way to see what came out the other end. The template says
// "high protein, three meals"; the participant's week says "Thursday is
// skyr again". Those are different questions and only the first one was
// answerable from this screen.
//
// Nothing new had to be fetched. meal_picks has been coming back from
// GET /api/vinnustod/journeys/:id/training all along — the same endpoint
// this builder already calls for training settings — and POST already
// writes it through sanitizePersonal. The data was arriving in the coach's
// browser and being dropped on the floor.
//
// ── Why the coach can change it ────────────────────────────────────────
//
// Same reason they can change the training load: the person in front of
// them says "I can't eat that on Tuesdays" and the fix should not require
// talking them through four taps on their own phone. A pick written here
// is the same per-day pick the participant writes, read by the same
// dayFor, so there is one arrangement rather than a coach's copy and a
// real one.
//
// What this is not: a food diary. It shows the plan, not what was eaten.
// Whether somebody actually ate it is in the logs, and conflating the two
// would let a coach believe a week went well because it was well planned.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { alternativesFor, dayFor, mealName, pickKey, SLOT_IS, SLOTS, weekFor, type Meal, type MealSlot } from "@/lib/hc/meals";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/hc/personalise";
import { proteinTarget } from "@/lib/hc/nutrition-log";
import type { NutritionPrefs } from "@/lib/hc/nutrition";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export default function CoachMealWeek({ api, journeyId, programKey, weightKg }: {
  api: Api;
  journeyId: string;
  /** The nutrition template in the draft — the week is built from it. */
  programKey: string | null;
  /** From the report, for the protein band the week is judged against. */
  weightKg?: number | null;
}) {
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [picks, setPicks] = useState<Record<string, string> | null>(null);
  const [prefs, setPrefs] = useState<NutritionPrefs | undefined>(undefined);
  const [open, setOpen] = useState<{ day: number; slot: MealSlot } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [lib, tr] = await Promise.all([
        api("/api/hc/library?kind=meals").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        api(`/api/vinnustod/journeys/${journeyId}/training`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!alive) return;
      setMeals(lib?.meals ?? []);
      setPicks(tr?.personal?.meal_picks ?? {});
      setPrefs(tr?.nutrition ?? undefined);
    })();
    return () => { alive = false; };
  }, [api, journeyId]);

  const band = proteinTarget(weightKg);
  const targetG = band ? Math.round((band.min + band.max) / 2) : null;

  const week = useMemo(
    () => (meals && picks && programKey ? weekFor(meals, programKey, picks, prefs, targetG) : null),
    [meals, picks, prefs, programKey, targetG],
  );

  /** One pick, saved the way the participant's own save does it. */
  const setPick = async (day: number, slot: MealSlot, mealId: string | null) => {
    if (!picks) return;
    const next = { ...picks };
    const k = pickKey(day, slot);
    if (mealId) next[k] = mealId; else delete next[k];
    setBusy(true);
    const r = await api(`/api/vinnustod/journeys/${journeyId}/training`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal_picks: next }),
    }).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      const j = await r.json().catch(() => null);
      setPicks(j?.personal?.meal_picks ?? next);
      setOpen(null);
    }
  };

  if (!programKey) {
    return (
      <p className="text-xs text-hc-ink-2">
        Veldu næringarsniðmát til að sjá vikuna sem þátttakandinn fær.
      </p>
    );
  }
  if (!week) return <p className="flex items-center gap-1.5 text-xs text-hc-ink-2"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Hleð vikunni…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold text-hc-ink-2">Vikan sem þátttakandinn sér</p>
        {band && <p className="text-xs text-hc-ink-2">Próteinmarkmið {band.min}–{band.max} g á dag</p>}
      </div>
      <p className="mb-2 mt-0.5 text-xs text-hc-ink-2">
        Breyting hér er sama valið og þátttakandinn gerir sjálfur í appinu — ekki dagbók um það sem var borðað.
      </p>

      <ul className="overflow-hidden rounded-xl ring-1 ring-hc-hairline">
        {week.map((d, i) => {
          const protein = SLOTS.reduce((t, sl) => t + (d[sl]?.protein ?? 0), 0);
          const low = band && protein < band.min;
          return (
            <li key={i} className="flex items-center gap-2 border-b border-hc-hairline px-2 py-1.5 last:border-b-0">
              <span className="w-9 shrink-0 text-[11px] font-bold uppercase text-hc-ink-3">{WEEKDAYS_SHORT[i]}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-hc-ink-2">
                {d.dinner ? mealName(d.dinner) : "—"}
              </span>
              {/* Flagged, not corrected: a day under the band may be the
                  right call for a reason the coach knows and this does not. */}
              <span className={`shrink-0 text-xs font-semibold tabular-nums ${low ? "text-hc-warn-ink" : "text-hc-ink-2"}`}>
                {protein} g
              </span>
              <button type="button" onClick={() => setOpen({ day: i, slot: "dinner" })}
                className="shrink-0 rounded-full border border-lime-200 px-2 py-0.5 text-[11px] font-semibold text-lime-800 hover:bg-lime-50"
                aria-label={`Skipta um kvöldmat ${WEEKDAYS[i].toLowerCase()}`}>
                <ArrowLeftRight className="h-3 w-3" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      {open && meals && picks && (
        <div className="mt-2 rounded-xl border border-hc-hairline bg-hc-sunken p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-hc-ink-2">
              {SLOT_IS[open.slot]} · {WEEKDAYS[open.day].toLowerCase()}
            </p>
            <button type="button" onClick={() => setOpen(null)} className="text-xs font-semibold text-hc-ink-2 hover:text-hc-ink-2">Loka</button>
          </div>
          {(() => {
            const current = dayFor(meals, programKey, picks, prefs, open.day, targetG)?.[open.slot] ?? null;
            const alts = alternativesFor(current, meals, programKey, open.slot, prefs, targetG, open.day);
            const list = [...alts.near, ...alts.rest].slice(0, 12);
            if (!list.length) return <p className="text-xs text-hc-ink-2">Engar aðrar máltíðir passa við skilyrðin.</p>;
            return (
              <ul className="grid gap-1 sm:grid-cols-2">
                {list.map((m, idx) => (
                  <li key={m.id}>
                    <button type="button" disabled={busy} onClick={() => void setPick(open.day, open.slot, m.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-hc-hairline bg-hc-surface px-2 py-1.5 text-left text-xs transition hover:border-lime-400 disabled:opacity-50">
                      <span className="min-w-0 truncate font-semibold text-hc-ink-2">{mealName(m)}</span>
                      <span className="shrink-0 tabular-nums text-hc-ink-2">
                        {idx < alts.near.length ? "≈ " : ""}{m.protein ?? 0} g
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            );
          })()}
          {picks[pickKey(open.day, open.slot)] && (
            <button type="button" disabled={busy} onClick={() => void setPick(open.day, open.slot, null)}
              className="mt-1.5 text-[11px] font-semibold text-hc-ink-2 hover:text-hc-ink-2 disabled:opacity-50">
              Til baka í tillögu áætlunarinnar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
