"use client";

// Beiðnir on the client page — what this person has asked for, answerable
// right here.
//
// Í dag lists every open request, but the name on a request opens the client,
// and the client page had nowhere to show it: the request seemed to vanish.
// Now it sits at the top of Staða with its ready-made pathway — the action
// that resolves it (book the measurement, send to a doctor, change the plan)
// and the reply templates — and a booking made from it writes the reply for
// the coach to send.

import { useCallback, useEffect, useState } from "react";
import { RequestRow, type WsRequest } from "@/app/components/hc/WsRequests";
import type { RequestAction } from "@/lib/hc/requests";
import { useWsApi } from "@/app/components/hc/ws-api";

export type BookStart = { kind: "video" | "measurement"; items?: string[]; key: number };

export function ClientRequests({ journeyId, onAction, prefill, onChanged }: {
  journeyId: string;
  /** Book / refer / open the plan for one request; the page knows how. */
  onAction: (r: WsRequest, action: RequestAction) => void;
  /** A reply composed after the action (the booking), for one request. */
  prefill: { id: string; text: string; key: number } | null;
  /** So the home queue drops the request once it is answered. */
  onChanged: () => void;
}) {
  const api = useWsApi();
  const [rows, setRows] = useState<WsRequest[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/requests").catch(() => null);
    const body = r?.ok ? await r.json().catch(() => null) : null;
    const mine = ((body?.requests ?? []) as WsRequest[]).filter((q) => q.journey_id === journeyId);
    setTimeout(() => { setFailed(!body); setRows(mine); }, 0);
  }, [api, journeyId]);

  useEffect(() => { void load(); }, [load]);

  if (failed) {
    return (
      <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4">
        <p role="alert" className="text-sm font-semibold text-hc-bad-ink">
          Ekki tókst að sækja beiðnir.{" "}
          <button type="button" onClick={() => void load()} className="underline">Reyna aftur</button>
        </p>
      </section>
    );
  }
  if (!rows?.length) return null;

  return (
    <section id="ws-requests" className="scroll-mt-24 rounded-2xl border border-hc-hairline bg-hc-surface shadow-hc-card">
      <h2 className="px-4 pt-4 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
        Beiðnir <span className="ml-1 rounded-full bg-hc-bad-ink px-2 py-0.5 text-white">{rows.length}</span>
      </h2>
      <ul className="divide-y divide-hc-hairline">
        {rows.map((q) => (
          <RequestRow key={q.id} api={api} r={q} onAction={onAction}
            prefill={prefill?.id === q.id ? prefill : null}
            onDone={() => { void load(); onChanged(); }} />
        ))}
      </ul>
    </section>
  );
}
