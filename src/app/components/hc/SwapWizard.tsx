"use client";

// Swapping one exercise for another, asked the way people actually think
// about it.
//
// The old answer was a library of 976 exercises in a sidebar, open at all
// times, with a search box. But nobody browsing a plan wants to shop: they
// want this squat replaced, because it is too hard, or too easy, or their
// knee hurts, or they are bored of it. So the wizard asks which of those it
// is and then shows a handful of exercises that hit the same muscles and
// answer that particular reason.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import { REGION_IS, REGIONS, type Region } from "@/lib/hc/adaptive-program";
import { EQUIPMENT_IS, muscleIs } from "@/lib/hc/exercise-labels";
import type { ExerciseItem } from "@/lib/hc/types";
import { hcBtn } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface LibEx {
  id: string; name: string; name_is: string | null; category: string | null; equipment: string | null;
  illustration_url: string | null; video_url: string | null; primary_muscles: string[] | null;
  bang_for_buck: boolean | null; difficulty?: string | null; level?: string | null;
}

type Why = "lighter" | "harder" | "different" | "limitation";

const WHY: { key: Why; label: string; hint: string }[] = [
  { key: "lighter", label: "Of erfið — ég vil léttari", hint: "Sama hreyfing, minni þyngd eða styttri hreyfiferill." },
  { key: "harder", label: "Of létt — ég vil þyngri", hint: "Sömu vöðvar, meira álag." },
  { key: "different", label: "Ég vil bara aðra æfingu", hint: "Sömu vöðvar, önnur hreyfing. Gott þegar maður er orðinn leiður." },
  { key: "limitation", label: "Ég kemst ekki í hana", hint: "Verkur, meiðsli eða tækið er upptekið." },
];

/** beginner · easy < intermediate < advanced · expert */
const RANK: Record<string, number> = { easy: 0, beginner: 0, intermediate: 1, advanced: 2, expert: 2 };
const rankOf = (e: LibEx) => RANK[(e.difficulty ?? e.level ?? "").toLowerCase()] ?? 1;

/** Equipment that spares a joint, as a rough second sort for limitations. */
const GENTLE = new Set(["bodyweight", "none", "bands", "machine", "cables"]);

/**
 * Jumping movements, which the library rates "beginner" because they need no
 * equipment and no technique to start.
 *
 * That rating is about the barrier to entry, not the load on the body: a
 * squat jump puts several times bodyweight through the knee on landing. So
 * they are not an answer to "this is too hard" and are plainly wrong for
 * "my knee hurts", even though both filters would otherwise rank them first.
 */
const PLYO = /hopp|stökk|sipp|jump|plyo|burpee|skokk á staðnum/i;
const isPlyo = (e: LibEx) => PLYO.test(`${e.name_is ?? ""} ${e.name}`);

export default function SwapWizard({ api, item, onPick, onClose }: {
  api: Api;
  item: ExerciseItem;
  onPick: (ex: LibEx) => void;
  onClose: () => void;
}) {
  const [why, setWhy] = useState<Why | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [all, setAll] = useState<LibEx[] | null>(null);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const muscleKey = (item.muscles ?? []).map((m) => m.toLowerCase()).join(",");
  const muscles = useMemo(() => (muscleKey ? muscleKey.split(",") : []), [muscleKey]);

  // Ask the server for the same muscles rather than pulling the whole library
  // down and filtering here; `showAll` is the only case that wants everything.
  const load = useCallback(async () => {
    const qs = muscleKey && !showAll ? `&muscles=${encodeURIComponent(muscleKey)}` : "";
    const r = await api(`/api/hc/exercises?limit=80${qs}`);
    const j = await r.json().catch(() => ({}));
    // Out of the effect's own tick (react-hooks/set-state-in-effect).
    const rows = (j.exercises as LibEx[]) ?? [];
    setTimeout(() => setAll(rows), 0);
  }, [api, muscleKey, showAll]);
  useEffect(() => { void load(); }, [load]);

  // Same muscles first; that is what makes a swap a swap rather than a
  // different workout.
  const sameMuscle = (e: LibEx) =>
    !muscles.length || (e.primary_muscles ?? []).some((m) => muscles.includes(m.toLowerCase()));

  const mine = 1;
  const suggestions = (() => {
    if (!all) return [];
    let pool = all.filter(sameMuscle);
    if (!pool.length) pool = all;
    if (why === "lighter") pool = pool.filter((e) => rankOf(e) <= mine && !isPlyo(e)).sort((a, b) => rankOf(a) - rankOf(b));
    else if (why === "harder") pool = pool.filter((e) => rankOf(e) >= mine).sort((a, b) => rankOf(b) - rankOf(a));
    else if (why === "limitation") {
      pool = pool.filter((e) => !isPlyo(e) && (GENTLE.has((e.equipment ?? "").toLowerCase()) || rankOf(e) === 0))
        .sort((a, b) => rankOf(a) - rankOf(b));
    } else pool = [...pool].sort((a, b) => Number(!!b.bang_for_buck) - Number(!!a.bang_for_buck));
    const needle = q.trim().toLowerCase();
    if (needle) pool = pool.filter((e) => `${e.name_is ?? ""} ${e.name}`.toLowerCase().includes(needle));
    return pool.slice(0, showAll ? 60 : 8);
  })();

  const title = item.name;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        role="dialog" aria-modal="true" aria-label={`Skipta út: ${title}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Skipta út</p>
            <p className="truncate font-bold text-slate-900">{title}</p>
            {!!muscles.length && <p className="mt-0.5 truncate text-xs text-slate-500">{muscles.map(muscleIs).join(", ")}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Loka" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {/* 1 ─ why */}
        {!why && (
          <div className="space-y-2 overflow-y-auto p-4">
            <p className="font-semibold text-slate-900">Af hverju viltu skipta?</p>
            {WHY.map((w) => (
              <button key={w.key} type="button" onClick={() => setWhy(w.key)}
                className="w-full rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-200 transition hover:ring-2 hover:ring-orange-400">
                <span className="block font-semibold text-slate-900">{w.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{w.hint}</span>
              </button>
            ))}
          </div>
        )}

        {/* 2 ─ which limitation */}
        {why === "limitation" && !region && (
          <div className="space-y-2 overflow-y-auto p-4">
            <button type="button" onClick={() => setWhy(null)} className={`${hcBtn.ghost} mb-1`}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
            </button>
            <p className="font-semibold text-slate-900">Hvað er að?</p>
            <div className="grid gap-2">
              {REGIONS.map((r) => (
                <button key={r} type="button" onClick={() => setRegion(r)}
                  className="rounded-2xl bg-white p-3 text-left font-semibold text-slate-900 ring-1 ring-slate-200 hover:ring-2 hover:ring-orange-400">
                  {REGION_IS[r].label}
                </button>
              ))}
              <button type="button" onClick={() => setRegion("back")}
                className="rounded-2xl bg-white p-3 text-left text-slate-700 ring-1 ring-slate-200 hover:ring-2 hover:ring-orange-400">
                Annað — sýndu mér mildari æfingar
              </button>
            </div>
          </div>
        )}

        {/* 3 ─ the suggestions */}
        {why && (why !== "limitation" || region) && (
          <>
            <div className="border-b border-slate-100 px-4 pb-3">
              <button type="button" onClick={() => { setWhy(null); setRegion(null); setShowAll(false); setQ(""); }} className={hcBtn.ghost}>
                <ArrowLeft className="h-4 w-4" aria-hidden /> Velja aðra ástæðu
              </button>
              <p className="mt-1 text-sm text-slate-600">
                {why === "lighter" ? "Léttari æfingar á sömu vöðva."
                  : why === "harder" ? "Þyngri æfingar á sömu vöðva."
                  : why === "limitation" ? `Mildari æfingar sem hlífa ${region ? REGION_IS[region].gen : "svæðinu"}.`
                  : "Aðrar æfingar á sömu vöðva."}
              </p>
              {showAll && (
                <label className="mt-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita í safninu"
                    className="w-full bg-transparent text-sm outline-none" />
                </label>
              )}
            </div>
            <ul className="divide-y divide-slate-100 overflow-y-auto">
              {all === null && <li className="p-4 text-sm text-slate-500">Hleð æfingum…</li>}
              {all !== null && suggestions.length === 0 && <li className="p-4 text-sm text-slate-500">Engin æfing fannst.</li>}
              {suggestions.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onPick(e)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-orange-50">
                    {e.illustration_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={e.illustration_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      : <span className="h-12 w-12 shrink-0 rounded-lg bg-slate-100" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{e.name_is || e.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {[(e.primary_muscles ?? []).slice(0, 2).map(muscleIs).join(", "), e.equipment ? EQUIPMENT_IS[e.equipment] ?? e.equipment : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {e.bang_for_buck && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Mest fyrir minnst</span>}
                  </button>
                </li>
              ))}
            </ul>
            {!showAll && all !== null && (
              <button type="button" onClick={() => setShowAll(true)}
                className="border-t border-slate-100 p-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <ChevronDown className="mr-1 inline h-4 w-4" aria-hidden /> Sjá allt safnið og leita
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
