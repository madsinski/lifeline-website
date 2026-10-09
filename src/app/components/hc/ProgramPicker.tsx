"use client";

// Choose an exercise or nutrition programme from the library
// (/api/hc/library?kind=programs). Used on the Æfingar and Næring tabs and in
// the plan editor.

import { useEffect, useState } from "react";
import { useScrollLock } from "@/lib/hc/use-scroll-lock";
import { Check, X } from "lucide-react";
import * as cache from "@/lib/hc/client-cache";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
export interface ProgramRow { key: string; name: string; goal: string | null; description: string | null; level?: string | null; days_per_week?: number | null; session_minutes?: number | null }

const LEVEL: Record<string, string> = { beginner: "Byrjendur", intermediate: "Miðlungs", advanced: "Lengra komnir" };

export function usePrograms(api: Api) {
  const url = "/api/hc/library?kind=programs";
  const [p, setP] = useState<{ exercise: ProgramRow[]; nutrition: ProgramRow[] } | null>(() => cache.peek<{ exercise: ProgramRow[]; nutrition: ProgramRow[] }>(url)?.body ?? null);
  useEffect(() => {
    (async () => {
      const r = await cache.load(api, url);
      if (r.status < 400) setP(r.body as { exercise: ProgramRow[]; nutrition: ProgramRow[] });
    })();
  }, [api]);
  return p;
}

export function ProgramList({ rows, current, onPick, tone }: { rows: ProgramRow[]; current: string | null; onPick: (key: string) => void; tone: "exercise" | "nutrition" }) {
  const ring = tone === "exercise" ? "ring-orange-500" : "ring-lime-600";
  const badge = tone === "exercise" ? "bg-orange-600" : "bg-lime-600";
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map((r) => {
        const on = r.key === current;
        return (
          <li key={r.key}>
            <button type="button" onClick={() => onPick(r.key)} aria-pressed={on}
              className={`relative h-full w-full rounded-2xl bg-white p-3 text-left ring-1 transition hover:ring-slate-400 ${on ? `ring-2 ${ring}` : "ring-slate-200"}`}>
              {on && <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-white ${badge}`}><Check className="h-4 w-4" /></span>}
              <span className="block pr-7 font-semibold text-slate-900">{r.name}</span>
              {r.goal && <span className="mt-0.5 block text-sm text-slate-600">{r.goal}</span>}
              <span className="mt-1 block text-xs text-slate-500">
                {[r.days_per_week && r.key !== "hiit-styrkur" ? `${r.days_per_week} dagar` : r.key === "hiit-styrkur" ? "3 dagar, aðlagast þér" : null, r.session_minutes ? `um ${r.session_minutes} mín.` : null, r.level ? LEVEL[r.level] ?? r.level : null].filter(Boolean).join(" · ")}
              </span>
              {r.description && <span className="mt-1 line-clamp-2 block text-xs text-slate-500">{r.description}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function ProgramPicker({ api, kind, current, onPick, onClose }: {
  api: Api; kind: "exercise" | "nutrition"; current: string | null; onPick: (key: string) => void; onClose: () => void;
}) {
  // The page behind a sheet must not scroll with it.
  useScrollLock();
  const programs = usePrograms(api);
  const rows = programs?.[kind] ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/40 sm:items-center" onClick={onClose} role="dialog" aria-modal="true">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-slate-50 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
          <p className="min-w-0 flex-1 font-semibold text-slate-900">{kind === "exercise" ? "Veldu æfingaáætlun" : "Veldu næringaráætlun"}</p>
          <button type="button" onClick={onClose} aria-label="Loka" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-4">
          {!programs && <p className="text-sm text-slate-500">Hleð…</p>}
          <ProgramList rows={rows} current={current} onPick={(k) => { onPick(k); onClose(); }} tone={kind} />
          {kind === "exercise" && <p className="mt-3 text-xs text-slate-500">Ný áætlun byrjar á upphaflegu dögunum og æfingunum; þú getur svo raðað henni að þér.</p>}
        </div>
      </div>
    </div>
  );
}
