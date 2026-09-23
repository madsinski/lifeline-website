"use client";

// Pick a meal from the meal library (/admin/content) for the day example in a
// nutrition plan. Protein-first ordering, because that is the change that
// carries most of the benefit for our clients.

import { useEffect, useState } from "react";
import type { LibraryMeal } from "@/lib/hc/types";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const CATEGORY_IS: Record<string, string> = {
  breakfast: "Morgunmatur", lunch: "Hádegi", dinner: "Kvöldmatur", snack: "Millibiti", dessert: "Eftirréttur",
};
const CATS = ["", "breakfast", "lunch", "dinner", "snack"];
const TAGS = ["", "high-protein", "vegetarian", "vegan", "low-carb", "no-cook", "gluten-free"];

export default function MealPicker({ api, category, onPick, onClose }: {
  api: Api;
  /** Preselect the meal slot's category, e.g. "breakfast". */
  category?: string | null;
  onPick: (meal: LibraryMeal) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(category ?? "");
  const [tag, setTag] = useState("");
  const [rows, setRows] = useState<LibraryMeal[] | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ limit: "36" });
      if (q.trim()) sp.set("q", q.trim());
      if (cat) sp.set("category", cat);
      if (tag) sp.set("tag", tag);
      const r = await api(`/api/hc/meals?${sp}`);
      const j = await r.json().catch(() => ({}));
      setRows(r.ok ? j.meals : []);
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [api, q, cat, tag]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Máltíðasafn" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-[#0F172A]">Máltíðasafn</h2>
              <p className="text-xs text-slate-500">Sama safn og í /admin/content. Raðað eftir próteini.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Loka</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita (enska: chicken, oats…)"
              aria-label="Leita í máltíðasafni" className="min-w-[180px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Flokkur" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {CATS.map((c) => <option key={c} value={c}>{c ? CATEGORY_IS[c] : "Allir flokkar"}</option>)}
            </select>
            <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Merki" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {TAGS.map((t) => <option key={t} value={t}>{t || "Öll merki"}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-5">
          {rows === null && <p className="text-sm text-slate-500">Hleð…</p>}
          {rows?.length === 0 && <p className="text-sm text-slate-500">Ekkert fannst.</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows?.map((m) => (
              <button key={m.id} type="button" onClick={() => { onPick(m); onClose(); }}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left hover:border-lime-400">
                <span className="block aspect-[4/3] bg-slate-100">
                  {m.illustration_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.illustration_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <span className="flex h-full items-center justify-center text-3xl text-slate-300">🍽️</span>}
                </span>
                <span className="flex flex-1 flex-col p-2.5">
                  <span className="text-sm font-semibold leading-tight text-slate-900">{m.name}</span>
                  <span className="mt-0.5 text-[11px] text-slate-500">
                    {[m.category && CATEGORY_IS[m.category], m.prep_time_min ? `${m.prep_time_min} mín` : null].filter(Boolean).join(" · ")}
                  </span>
                  <span className="flex-1" />
                  <span className="mt-1.5 flex flex-wrap gap-1 text-[11px] font-semibold">
                    {m.protein != null && <span className="rounded-full bg-lime-50 px-2 py-0.5 text-lime-800">{m.protein} g prótein</span>}
                    {m.calories != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{m.calories} kcal</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
