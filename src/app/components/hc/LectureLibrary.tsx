"use client";

// Everything in the fræðsla library, not only what the plan asked for.
//
// Fræðsla showed assigned lectures and nothing else, so the rest of the
// library did not appear to exist — including whichever lecture answers the
// thing someone is actually wondering about today. This is the catalogue,
// behind a button, with search: a plan is a recommendation, not a wall.
//
// Rows that are in the plan say so, and finished ones carry their tick, so
// opening this is not a second, competing list of the same material.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sheet from "./Sheet";
import { CheckCircle2, Library, Search } from "lucide-react";
import { PILLAR_META, type Pillar } from "@/lib/hc/types";
import { hcBtn } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface LibraryLecture {
  slug: string;
  title: string;
  subtitle: string | null;
  duration_min: number | null;
  pillar: string | null;
  completed: boolean;
  inPlan: boolean;
}

const PILLAR_ORDER = ["sleep", "nutrition", "exercise", "mental", "general"] as const;

/** Fold Icelandic accents so "naering" finds "næring". */
const fold = (s: string) =>
  s.toLowerCase()
    .replace(/[áà]/g, "a").replace(/[éè]/g, "e").replace(/[íì]/g, "i")
    .replace(/[óò]/g, "o").replace(/[úù]/g, "u").replace(/ý/g, "y")
    .replace(/æ/g, "ae").replace(/ö/g, "o").replace(/þ/g, "th").replace(/ð/g, "d");

export function LibraryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`${hcBtn.secondary} flex shrink-0 items-center gap-2`}>
      <Library className="h-4 w-4" aria-hidden /> Allt safnið
    </button>
  );
}

export default function LectureLibrary({ api, onClose }: { api: Api; onClose: () => void }) {
  const [all, setAll] = useState<LibraryLecture[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await api("/api/hc/lectures").catch(() => null);
      if (!alive) return;
      if (!r?.ok) { setTimeout(() => setFailed(true), 0); return; }
      const j = await r.json().catch(() => null);
      if (alive) setTimeout(() => setAll((j?.lectures as LibraryLecture[]) ?? []), 0);
    })();
    return () => { alive = false; };
  }, [api]);

  const shown = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle) return all ?? [];
    return (all ?? []).filter((l) =>
      fold(l.title).includes(needle) || fold(l.subtitle ?? "").includes(needle));
  }, [all, q]);

  return (
    <Sheet title="Allt safnið" onClose={onClose} canvas>
      <div className="space-y-3 p-3 sm:p-4">
        <label className="flex items-center gap-2 rounded-hc-element bg-white px-3 ring-1 ring-slate-200 focus-within:ring-hc-brand">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Leita í fræðslunni…" aria-label="Leita í fræðslunni"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>

        {all === null && !failed && (
          <div className="animate-pulse space-y-2" aria-busy="true" aria-label="Hleð safninu">
            <div className="h-20 rounded-hc-card bg-white" />
            <div className="h-20 rounded-hc-card bg-white" />
          </div>
        )}

        {failed && (
          <p className="rounded-hc-card bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            Náði ekki í safnið. Athugaðu netsambandið.
          </p>
        )}

        {all !== null && shown.length === 0 && (
          <p className="rounded-hc-card bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            {q.trim() ? `Ekkert fannst fyrir „${q.trim()}“.` : "Safnið er tómt."}
          </p>
        )}

        {PILLAR_ORDER.map((p) => {
          const rows = shown.filter((l) =>
            (l.pillar && l.pillar in PILLAR_META ? l.pillar : "general") === p);
          if (!rows.length) return null;
          const meta = p === "general" ? null : PILLAR_META[p as Pillar];
          return (
            <section key={p} className="overflow-hidden rounded-hc-card bg-white shadow-hc-card ring-1 ring-slate-200">
              <p className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em]"
                style={meta ? { background: meta.soft, color: meta.ink } : { background: "#F1F5F9", color: "#475569" }}>
                {meta ? meta.label : "Almennt"}
              </p>
              <ul className="divide-y divide-slate-100">
                {rows.map((l) => (
                  <li key={l.slug}>
                    <Link href={`/account/heilsuferd/fraedsla/${l.slug}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                      {l.completed
                        ? <CheckCircle2 className="h-6 w-6 shrink-0 text-hc-brand-dark" aria-label="Lokið" />
                        : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-200" aria-hidden />}
                      <span className="min-w-0 flex-1">
                        <span className={`block font-semibold ${l.completed ? "text-slate-400" : "text-hc-ink"}`}>
                          {l.title}
                        </span>
                        {l.subtitle && <span className="mt-0.5 block truncate text-sm text-slate-500">{l.subtitle}</span>}
                      </span>
                      {/* Says which ones the plan asked for, so the
                          catalogue does not read as a competing list. */}
                      {l.inPlan && (
                        <span className="shrink-0 rounded-full bg-hc-brand/10 px-2 py-0.5 text-[11px] font-bold text-hc-brand-dark">
                          Í áætlun
                        </span>
                      )}
                      {l.duration_min ? (
                        <span className="shrink-0 text-sm tabular-nums text-slate-400">{l.duration_min} mín.</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}
