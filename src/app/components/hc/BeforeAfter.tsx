"use client";

// "Þá og nú": markers from the previous health check next to this one, with
// the direction that counts as better. Participant report tab and workstation.

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Comparison } from "@/lib/hc/compare";

const MO = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const d = (iso: string | null) => { const m = (iso ?? "").match(/^(\d{4})-(\d{2})/); return m ? `${MO[Number(m[2]) - 1]} ${m[1]}` : "áður"; };
const num = (n: number) => n.toLocaleString("is-IS", { maximumFractionDigits: 1 });
const DOT: Record<string, string> = { red: "bg-red-500", yellow: "bg-amber-400", green: "bg-emerald-500" };

export default function BeforeAfter({ c }: { c: Comparison }) {
  const better = c.rows.filter((r) => r.better === true).length;
  const worse = c.rows.filter((r) => r.better === false).length;
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100" aria-label="Þá og nú">
      <div className="bg-gradient-to-br from-[#0F2A23] to-[#065F46] p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-300">Þá og nú</p>
        <p className="mt-1 text-lg font-bold">{d(c.beforeDate)} → {d(c.afterDate)}</p>
        <p className="mt-1 text-sm text-emerald-100">
          {better} {better === 1 ? "gildi" : "gildi"} í rétta átt{worse ? ` · ${worse} í ranga átt` : ""} · {c.rows.length} borin saman
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {c.rows.map((r) => {
          const Icon = r.better === true ? (r.after > r.before ? ArrowUpRight : ArrowDownRight) : r.better === false ? (r.after > r.before ? ArrowUpRight : ArrowDownRight) : Minus;
          const tone = r.better === true ? "text-emerald-700 bg-emerald-50" : r.better === false ? "text-red-700 bg-red-50" : "text-slate-500 bg-slate-100";
          return (
            <li key={r.marker} className="flex items-center gap-3 px-4 py-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 font-medium text-slate-800">{r.title}</span>
              <span className="flex items-center gap-1.5 text-sm tabular-nums text-slate-500">
                {r.signalBefore && <span className={`h-2 w-2 rounded-full ${DOT[r.signalBefore]}`} aria-hidden />}{num(r.before)}
              </span>
              <span className="text-slate-300" aria-hidden>→</span>
              <span className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-900">
                {r.signalAfter && <span className={`h-2 w-2 rounded-full ${DOT[r.signalAfter]}`} aria-hidden />}{num(r.after)}
                {r.unit && <span className="font-normal text-slate-400">{r.unit}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="px-4 pb-4 pt-2 text-xs text-slate-500">Litirnir sýna hvar gildið lenti miðað við viðmið Lifeline. Læknir og hjúkrunarfræðingur fara yfir breytingarnar með þér.</p>
    </section>
  );
}
