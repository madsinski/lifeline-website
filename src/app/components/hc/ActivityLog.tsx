"use client";

/*
 * The last fortnight as it happened: workouts, meals and habit ticks, day by
 * day. One component, two readers.
 *
 *  - staff (workstation Staða tab): compact, factual. A substitution reads
 *    "í stað „Styrkur A“" so the coach sees which session keeps getting
 *    swapped; a described meal reads "skráð í staðinn".
 *  - participant ("Vikan þín", /app/eg/saga): the same rows, framed as kept
 *    effort — "kom í stað styrktaræfingar".
 *
 * Data: /api/vinnustod/journeys/[id]/activity or /api/hc/activity, both
 * served by src/lib/hc/activity-server.ts.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Dumbbell, Repeat, Utensils } from "lucide-react";
import {
  dayHeading, effortLabel, groupByDay, MODALITY_GEN_IS,
  type ActivityDay, type ActivityEntry,
} from "@/lib/hc/activity";
import { isoDay } from "@/lib/hc/adherence";
import { hcCard } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type Audience = "staff" | "participant";

function workoutMeta(e: ActivityEntry): string {
  return [e.minutes ? `${e.minutes} mín.` : null, effortLabel(e.rpe)].filter(Boolean).join(" · ");
}

function replacedText(e: ActivityEntry, audience: Audience): string {
  const what = e.replaced
    ? `„${e.replaced}“`
    : (e.modality && MODALITY_GEN_IS[e.modality]) || "áætlaðrar æfingar";
  return audience === "staff" ? `í stað ${what}` : `kom í stað ${what}`;
}

function mealMeta(e: ActivityEntry): string {
  const parts: string[] = [];
  if (e.kcal) parts.push(`${e.described ? "u.þ.b. " : ""}${e.kcal} kkal`);
  if (e.protein) parts.push(`${e.protein} g prótein`);
  return parts.join(" · ");
}

function Row({ e, audience }: { e: ActivityEntry; audience: Audience }) {
  if (e.kind === "workout") {
    const meta = workoutMeta(e);
    return (
      <li className="flex items-start gap-3 py-2">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${e.substituted ? "bg-hc-warn-surface text-hc-warn-ink" : "bg-hc-brand-surface text-hc-brand-text"}`}>
          {e.substituted ? <Repeat className="h-4 w-4" aria-hidden /> : <Dumbbell className="h-4 w-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-hc-ink">
            {e.label}{meta && <span className="font-normal text-hc-ink-2"> · {meta}</span>}
          </p>
          {e.substituted && <p className="text-xs text-hc-ink-2">{replacedText(e, audience)}</p>}
        </div>
      </li>
    );
  }
  if (e.kind === "meal") {
    const meta = mealMeta(e);
    return (
      <li className="flex items-start gap-3 py-2">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hc-sunken-2 text-hc-ink-2">
          <Utensils className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-hc-ink">
            {e.slot && <span className="font-semibold">{e.slot}: </span>}{e.label}
          </p>
          {(e.described || meta) && (
            <p className="text-xs text-hc-ink-2">
              {[e.described ? "skráð í staðinn" : null, meta || null].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-3 py-1.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hc-ok-surface text-hc-ok-ink">
        <Check className="h-4 w-4" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 pt-1.5 text-sm text-hc-ink">{e.label}</p>
    </li>
  );
}

export default function ActivityLog({ api, path, audience, title = "Síðustu 14 dagar", intro }: {
  api: Api;
  /** The endpoint, e.g. /api/hc/activity?days=14. */
  path: string;
  audience: Audience;
  title?: string;
  intro?: string;
}) {
  const [days, setDays] = useState<ActivityDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setTimeout(() => setBusy(true), 0);
    const r = await api(path).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    const entries = Array.isArray(j?.entries) ? (j.entries as ActivityEntry[]) : null;
    // Deferred: called from an effect (same pattern as PlanChanges).
    setTimeout(() => {
      setFailed(!entries);
      setDays(entries ? groupByDay(entries) : null);
      setBusy(false);
    }, 0);
  }, [api, path]);
  useEffect(() => { void load(); }, [load]);

  const today = isoDay();
  const swaps = (days ?? []).flatMap((d) => d.entries).filter((e) => e.kind === "workout" && e.substituted).length;

  return (
    <section className={`${hcCard.base} p-4`} aria-busy={busy}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className={audience === "staff" ? "flex-1 text-xs font-bold uppercase tracking-wide text-hc-ink-2" : "flex-1 text-base font-bold text-hc-ink"}>
          {title}
        </h3>
        {audience === "staff" && swaps > 0 && (
          <span className="rounded-full bg-hc-warn-surface px-2 py-0.5 text-xs font-semibold text-hc-warn-ink">
            {swaps} {swaps === 1 ? "æfingu" : "æfingum"} skipt út
          </span>
        )}
      </div>
      {intro && <p className="mt-1 text-sm text-hc-ink-2">{intro}</p>}

      {days === null && !failed && (
        <div className="mt-3 space-y-2" aria-label="Hleður">
          {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-hc-sunken" />)}
        </div>
      )}

      {failed && (
        <p role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-hc-bad-ink">
          Náði ekki í skráningarnar.
          <button type="button" onClick={() => void load()} className="min-h-11 font-semibold underline">Reyna aftur</button>
        </p>
      )}

      {days && days.length === 0 && (
        <p className="mt-2 text-sm text-hc-ink-2">
          {audience === "staff"
            ? "Ekkert skráð síðustu 14 daga."
            : "Ekkert skráð enn. Æfingar, máltíðir og venjur sem þú merkir við birtast hér."}
        </p>
      )}

      {days && days.length > 0 && (
        <ol className="mt-3 space-y-3">
          {days.map((d) => (
            <li key={d.date}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-hc-ink-3">{dayHeading(d.date, today)}</h4>
              <ul className="divide-y divide-hc-hairline">
                {d.entries.map((e, i) => <Row key={`${e.kind}-${i}`} e={e} audience={audience} />)}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
