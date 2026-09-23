"use client";

// "Dæmi um dag" — the meals in a nutrition plan. Each line is a slot
// (Morgunmatur, Hádegi…) with a description the nurse can type, or a meal
// picked from the meal library, which brings its picture and macros along.
// Shared by the plan builder and the nutrition-template editor in admin.

import { useState } from "react";
import type { DayExampleItem, LibraryMeal } from "@/lib/hc/types";
import MealPicker from "./MealPicker";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/** Slot name → the library category to preselect in the picker. */
const SLOT_CATEGORY: { match: RegExp; category: string }[] = [
  { match: /morgun/i, category: "breakfast" },
  { match: /hádeg|hadeg/i, category: "lunch" },
  { match: /kvöld|kvold/i, category: "dinner" },
  { match: /milli|snarl|biti/i, category: "snack" },
];

const SLOTS = ["Morgunmatur", "Hádegi", "Millibiti", "Kvöldmatur"];

export default function DayExampleEditor({ value, onChange, api }: {
  value: DayExampleItem[];
  onChange: (v: DayExampleItem[]) => void;
  api: Api;
}) {
  const [picking, setPicking] = useState<number | null>(null);

  const set = (i: number, patch: Partial<DayExampleItem>) =>
    onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const fromLibrary = (i: number, m: LibraryMeal) =>
    set(i, {
      example: m.name,
      meal_id: m.id,
      image: m.illustration_url,
      kcal: m.calories,
      protein: m.protein,
      tags: (m.dietary_tags ?? []).slice(0, 3),
    });

  const add = () => {
    const slot = SLOTS[value.length] ?? "";
    onChange([...value, { meal: slot, example: "", meal_id: null, image: null, kcal: null, protein: null, tags: [] }]);
  };

  return (
    <div className="space-y-2">
      {value.map((d, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl border border-slate-100 p-2">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-lime-50">
            {d.image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={d.image} alt="" className="h-full w-full object-cover" />
              : <span className="flex h-full items-center justify-center text-lg text-lime-300">🍽️</span>}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              <input value={d.meal} onChange={(e) => set(i, { meal: e.target.value })} placeholder="Máltíð" aria-label="Máltíð"
                className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold" />
              <input value={d.example} onChange={(e) => set(i, { example: e.target.value, meal_id: null })} placeholder="Dæmi" aria-label="Dæmi"
                className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {d.meal_id
                ? <span className="font-semibold text-lime-700">✓ Úr safni{d.protein != null ? ` · ${d.protein} g prótein` : ""}{d.kcal != null ? ` · ${d.kcal} kcal` : ""}</span>
                : <span className="text-slate-400">Frjáls texti</span>}
              <button type="button" onClick={() => setPicking(i)} className="font-semibold text-lime-700 hover:underline">
                {d.meal_id ? "Skipta um máltíð" : "Velja úr safni"}
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-red-600 hover:underline">Fjarlægja</button>
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs font-semibold text-lime-700">+ Máltíð</button>

      {picking !== null && (
        <MealPicker
          api={api}
          category={SLOT_CATEGORY.find((s) => s.match.test(value[picking]?.meal ?? ""))?.category ?? null}
          onPick={(m) => fromLibrary(picking, m)}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
