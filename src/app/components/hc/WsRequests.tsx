"use client";

// Beiðnir — what participants have asked for, in the workstation.
//
// The other half of HelpCard. Oldest first, because the person who has waited
// longest should be next; a reply closes it unless the coach says otherwise.
// Reading one does not claim it — two coaches opening the same request is
// better than one quietly taking it and forgetting.

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { REQUEST_IS, STATUS_IS, requestSummary, type RequestKind } from "@/lib/hc/requests";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Row {
  id: string;
  journey_id: string;
  kind: RequestKind;
  detail: Record<string, unknown>;
  body: string | null;
  status: string;
  reply: string | null;
  replied_by: string | null;
  created_at: string;
  name: string | null;
}

const waited = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "rétt í þessu";
  if (h < 24) return `${h} klst.`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "dagur" : "dagar"}`;
};

export default function WsRequests({ api, onOpen }: { api: Api; onOpen?: (journeyId: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/requests");
    if (!r.ok) return;
    const j = (await r.json().catch(() => ({}))) as { requests?: Row[] };
    setTimeout(() => setRows(j.requests ?? []), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const send = async (id: string, status: string) => {
    setBusy(true);
    const r = await api("/api/vinnustod/requests", { method: "POST", body: JSON.stringify({ id, status, reply: reply.trim() || undefined }) });
    setBusy(false);
    if (!r.ok) return;
    setOpenId(null); setReply("");
    await load();
  };

  if (!rows?.length) return null;

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        Beiðnir <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">{rows.length}</span>
      </h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${REQUEST_IS[r.kind].cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${REQUEST_IS[r.kind].dot}`} aria-hidden />
                {requestSummary(r.kind, r.detail)}
              </span>
              <span className="font-semibold text-slate-900">{r.name ?? "—"}</span>
              <span className="text-xs text-slate-500">beið í {waited(r.created_at)} · {STATUS_IS[r.status]}</span>
              {onOpen && (
                <button type="button" onClick={() => onOpen(r.journey_id)}
                  className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
                  Opna <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
            {r.body && <p className="mt-1 text-sm text-slate-700">{r.body}</p>}

            {openId === r.id ? (
              <div className="mt-2 space-y-2">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={4000}
                  className="w-full rounded-xl border border-slate-300 p-2 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Svar sem skjólstæðingurinn sér í heilsuferðinni sinni…" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void send(r.id, "done")}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                    Svara og loka
                  </button>
                  <button type="button" disabled={busy} onClick={() => void send(r.id, "in_progress")}
                    className="min-h-9 rounded-full border border-slate-300 px-3 text-sm font-semibold text-slate-700">
                    Svara, held áfram
                  </button>
                  <button type="button" onClick={() => { setOpenId(null); setReply(""); }}
                    className="min-h-9 px-2 text-sm text-slate-500">Hætta við</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => { setOpenId(r.id); setReply(r.reply ?? ""); }}
                className="mt-1 text-sm font-semibold text-emerald-700 hover:underline">
                Svara
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
