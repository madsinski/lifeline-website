"use client";

// "Þá og nú": markers from the previous health check next to this one, with
// the direction that counts as better. Participant report tab and workstation.

import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import type { Comparison } from "@/lib/hc/compare";
import { fmtNum } from "./format";
import { hcCard, hcKicker } from "./ui";

const MO = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const d = (iso: string | null) => { const m = (iso ?? "").match(/^(\d{4})-(\d{2})/); return m ? `${MO[Number(m[2]) - 1]} ${m[1]}` : "áður"; };
const num = (n: number) => fmtNum(n, 1);
const DOT: Record<string, string> = { red: "bg-hc-signal-red", yellow: "bg-hc-signal-yellow", green: "bg-hc-signal-green" };

export default function BeforeAfter({ c }: { c: Comparison }) {
  const better = c.rows.filter((r) => r.better === true).length;
  const worse = c.rows.filter((r) => r.better === false).length;
  return (
    <section className={`overflow-hidden ${hcCard.base}`} aria-label="Þá og nú">
      <div className="bg-gradient-to-br from-hc-hero-from to-hc-hero-to p-5 text-white">
        <p className={`${hcKicker} text-emerald-200`}>Þá og nú</p>
        <p className="mt-1 flex items-center gap-2 text-lg font-bold">{d(c.beforeDate)} <ArrowRight className="h-4 w-4 opacity-80" aria-hidden /><span className="sr-only">til</span> {d(c.afterDate)}</p>
        <p className="mt-1 text-sm text-emerald-50/90">
          {better} {better === 1 ? "gildi" : "gildi"} í rétta átt{worse ? ` · ${worse} í ranga átt` : ""} · {c.rows.length} borin saman
        </p>
      </div>
      <ul className="divide-y divide-hc-hairline">
        {c.rows.map((r) => {
          const Icon = r.better === true ? (r.after > r.before ? ArrowUpRight : ArrowDownRight) : r.better === false ? (r.after > r.before ? ArrowUpRight : ArrowDownRight) : Minus;
          const tone = r.better === true ? "text-hc-ok-ink bg-hc-ok-surface" : r.better === false ? "text-hc-bad-ink bg-hc-bad-surface" : "text-hc-ink-2 bg-hc-sunken-2";
          return (
            <li key={r.marker} className="flex items-center gap-3 px-4 py-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 font-medium text-hc-ink-2">{r.title}</span>
              <span className="flex items-center gap-1.5 text-sm tabular-nums text-hc-ink-2">
                {r.signalBefore && <span className={`h-2 w-2 rounded-full ${DOT[r.signalBefore]}`} aria-hidden />}{num(r.before)}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-hc-ink-3" aria-hidden />
              <span className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-hc-ink">
                {r.signalAfter && <span className={`h-2 w-2 rounded-full ${DOT[r.signalAfter]}`} aria-hidden />}{num(r.after)}
                {r.unit && <span className="font-normal text-hc-ink-3">{r.unit}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="px-4 pb-4 pt-2 text-xs text-hc-ink-2">Litirnir sýna hvar gildið lenti miðað við viðmið Lifeline. Læknir og hjúkrunarfræðingur fara yfir breytingarnar með þér.</p>
    </section>
  );
}
