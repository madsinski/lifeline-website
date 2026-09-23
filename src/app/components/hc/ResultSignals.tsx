"use client";

// The client's own measurements, traffic-lit against Lifeline's reference
// bands. Plain language, no interpretation beyond the band the value sits in
// — the report from the doctor is the place where results are explained, and
// this page says so.

import { PILLAR_META } from "@/lib/hc/types";

export type Signal = "green" | "yellow" | "red";

export interface FlaggedValue {
  slug: string;
  title: string;
  value: number;
  unit: string | null;
  band: string | null;
  signal: Signal;
}

const GROUPS: { signal: Signal; title: string; hint: string; ring: string; dot: string }[] = [
  { signal: "red", title: "Utan viðmiða", hint: "Þessi gildi eru utan þeirra marka sem við miðum við.", ring: "ring-red-200 bg-red-50", dot: "bg-red-500" },
  { signal: "yellow", title: "Fylgjast með", hint: "Innan marka en í efri eða neðri kantinum.", ring: "ring-amber-200 bg-amber-50", dot: "bg-amber-400" },
  { signal: "green", title: "Í lagi", hint: "Á kjörsviði.", ring: "ring-emerald-200 bg-emerald-50", dot: "bg-emerald-500" },
];

export default function ResultSignals({ flagged }: { flagged: FlaggedValue[] }) {
  if (!flagged.length) return null;
  const counts = GROUPS.map((g) => ({ ...g, items: flagged.filter((f) => f.signal === g.signal) }));

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-[#0F172A]">Mælingarnar þínar</h2>
        <p className="mt-1 text-sm text-slate-600">
          Borið saman við viðmið Lifeline. Læknirinn fer yfir niðurstöðurnar í heild og skýrslan þín er í sjúklingagáttinni.
        </p>
        <div className="mt-4 flex gap-2">
          {counts.map((g) => (
            <div key={g.signal} className={`flex-1 rounded-2xl px-3 py-2 text-center ring-1 ${g.ring}`}>
              <p className="text-2xl font-bold text-slate-900">{g.items.length}</p>
              <p className="text-xs font-semibold text-slate-600">{g.title}</p>
            </div>
          ))}
        </div>
      </div>

      {counts.filter((g) => g.items.length).map((g) => (
        <div key={g.signal} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} aria-hidden />
            <p className="font-bold text-slate-900">{g.title}</p>
            <span className="text-xs text-slate-500">{g.hint}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {g.items.map((f) => (
              <li key={f.slug} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{f.title}</span>
                  {f.band && <span className="block text-xs text-slate-500">{f.band}</span>}
                </span>
                <span className="rounded-lg bg-slate-50 px-3 py-1 text-sm font-bold tabular-nums text-slate-800 ring-1 ring-slate-200">
                  {String(f.value).replace(".", ",")}{f.unit ? ` ${f.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        Mælingar eru ekki greining. Ef eitthvað er utan viðmiða fer læknir yfir það með þér — hafðu samband við
        <span style={{ color: PILLAR_META.mental.color }}> hjúkrunarfræðinginn þinn</span> ef þú vilt ræða niðurstöðurnar.
      </p>
    </section>
  );
}
