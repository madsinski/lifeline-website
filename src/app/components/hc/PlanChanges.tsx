"use client";

/*
 * What has changed in the plan since you last looked, and who changed it.
 *
 * Built for the question a coach has walking into an encounter: not "what
 * is in the plan" — that is the plan tab — but "what moved since we spoke".
 * A participant who quietly dropped two actions and added one is the whole
 * subject of the next conversation, and until now that was invisible unless
 * somebody remembered the plan's previous shape.
 *
 * The distinction that matters is who: hc_plan_versions records by_kind, so
 * "they changed it themselves" and "we changed it for them" are separable
 * facts, and they mean opposite things. A client dropping an action is
 * information about the plan fitting their life. A coach dropping one is a
 * decision. They are coloured differently for that reason.
 */

import { useCallback, useEffect, useState } from "react";
import { Plus, Minus, PenLine, ChevronDown } from "lucide-react";
import { fmtDateTime } from "@/app/components/account/ui/dates";
import { hcBtn, hcCard } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Change {
  version: number;
  at: string;
  byKind: "staff" | "self" | string;
  by: string | null;
  created?: boolean;
  added: string[];
  removed: string[];
  edited: { title: string; what: string }[];
}

/** 12. okt. kl. 14:30 — hand-formatted, as everywhere else in Icelandic. */
function when(iso: string) {
  return fmtDateTime(iso, { month: "short" });
}

export default function PlanChanges({ api, journeyId }: { api: Api; journeyId: string }) {
  const [rows, setRows] = useState<Change[] | null>(null);
  const [all, setAll] = useState(false);
  /* A failed read is not "no changes". */
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const r = await api(`/api/vinnustod/journeys/${journeyId}/changes`).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    const next = Array.isArray(j?.changes) ? (j.changes as Change[]) : [];
    // Deferred: an effect calls this, and the compiler objects to setting
    // state synchronously there. Same pattern as the unread poller.
    setTimeout(() => { setFailed(!j); setRows(next); }, 0);
  }, [api, journeyId]);
  useEffect(() => { void load(); }, [load]);

  if (rows === null) return null;
  /* Nothing to say is said plainly rather than with an empty card. */
  if (rows.length === 0) {
    return (
      <section className={`${hcCard.base} p-4`}>
        <h3 className="text-xs font-bold uppercase tracking-wide text-hc-ink-2">Breytingar á áætlun</h3>
        {failed ? (
          <p role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-sm text-hc-bad-ink">
            Náði ekki í breytingarnar.
            <button type="button" onClick={() => void load()} className="font-semibold underline">Reyna aftur</button>
          </p>
        ) : <p className="mt-1 text-sm text-hc-ink-2">Engar breytingar skráðar.</p>}
      </section>
    );
  }

  const shown = all ? rows : rows.slice(0, 4);

  return (
    <section className={`${hcCard.base} p-4`}>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
        Breytingar á áætlun
      </h3>
      <ol className="space-y-3">
        {shown.map((c) => {
          const mine = c.byKind === "staff";
          return (
            <li key={c.version} className="flex gap-3">
              {/* The colour carries the who, so the eye can sort the list
                  without reading every line: amber is the client acting on
                  their own plan, slate is us. */}
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${mine ? "bg-hc-ink-3" : "bg-hc-signal-yellow"}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-hc-ink-2">
                  <span className={`font-semibold ${mine ? "text-hc-ink-2" : "text-hc-warn-ink"}`}>
                    {mine ? (c.by ?? "Starfsmaður") : "Skjólstæðingurinn"}
                  </span>
                  {" · "}{when(c.at)}
                </p>
                {c.created ? (
                  <p className="text-sm text-hc-ink-2">Áætlun sett upp.</p>
                ) : (
                  <ul className="mt-0.5 space-y-0.5 text-sm text-hc-ink-2">
                    {c.added.map((t, i) => (
                      <li key={`a${i}`} className="flex items-start gap-1.5">
                        <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hc-ok-ink" aria-hidden />
                        <span className="min-w-0">{t}</span>
                      </li>
                    ))}
                    {c.removed.map((t, i) => (
                      <li key={`r${i}`} className="flex items-start gap-1.5">
                        <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hc-bad-ink" aria-hidden />
                        <span className="min-w-0 line-through decoration-hc-ink-3">{t}</span>
                      </li>
                    ))}
                    {c.edited.map((e, i) => (
                      <li key={`e${i}`} className="flex items-start gap-1.5">
                        <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hc-ink-3" aria-hidden />
                        <span className="min-w-0">{e.title} <span className="text-hc-ink-2">— {e.what}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {!all && rows.length > shown.length && (
        <button type="button" onClick={() => setAll(true)}
          className={`${hcBtn.ghost} mt-3 w-full justify-center text-xs`}>
          <ChevronDown className="h-3.5 w-3.5" aria-hidden /> Eldri breytingar ({rows.length - shown.length})
        </button>
      )}
    </section>
  );
}
