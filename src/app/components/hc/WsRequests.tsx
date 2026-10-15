"use client";

// Beiðnir — what participants have asked for, in the workstation.
//
// The other half of HelpCard. Oldest first, because the person who has waited
// longest should be next; a reply closes it unless the coach says otherwise.
// Reading one does not claim it — two coaches opening the same request is
// better than one quietly taking it and forgetting.
//
// The workstation's Í dag list mounts RequestRow inside its single "Bíður
// þín" list, so a request sits beside the journey tasks and the unanswered
// messages instead of in a section of its own. The default export is the
// same rows as a standalone list, for anywhere that wants just these.

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { REQUEST_IS, STATUS_IS, requestSummary, type RequestKind } from "@/lib/hc/requests";
import { hcBtn } from "./ui";
import { useToast } from "./Toast";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface WsRequest {
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

/** "3 klst." / "2 dagar" — how long somebody has been waiting. */
export const waited = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "rétt í þessu";
  if (h < 24) return `${h} klst.`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "dagur" : "dagar"}`;
};

const tall = (c: string) => c.replace("min-h-10", "min-h-11");
const input = "w-full rounded-hc-element border border-hc-control bg-hc-surface px-3 py-2 text-sm text-hc-ink outline-none placeholder:text-hc-ink-3 focus:border-hc-brand-dark focus:ring-2 focus:ring-hc-brand/25";

/**
 * One request, as a list row: who, what, and "Svara" — the one action,
 * which opens the reply in place. The name opens the client.
 */
export function RequestRow({ api, r, onOpen, onDone, dot }: {
  api: Api;
  r: WsRequest;
  onOpen?: (journeyId: string) => void;
  /** After a reply is saved, so the caller can reload its list. */
  onDone: () => void;
  /** A leading dot, so the row lines up with the rows around it. */
  dot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const toast = useToast();

  const send = async (status: string) => {
    if (busy) return;
    setBusy(true); setSending(status); setErr("");
    const res = await api("/api/vinnustod/requests", { method: "POST", body: JSON.stringify({ id: r.id, status, reply: reply.trim() || undefined }) }).catch(() => null);
    setBusy(false); setSending(null);
    if (!res) { setErr("Engin tenging. Athugaðu netið og reyndu aftur."); return; }
    if (!res.ok) { setErr("Svarið vistaðist ekki. Reyndu aftur."); return; }
    /* The row leaves the list on reload, which on its own reads as the
       request vanishing. Say what happened to it. */
    toast.show(status === "done"
      ? (reply.trim() ? "Svarið er sent og beiðninni lokað." : "Beiðninni er lokað.")
      : "Svarið er sent. Beiðnin er áfram opin í vinnslu.");
    setOpen(false); setReply("");
    onDone();
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {dot}
        <button type="button" disabled={!onOpen} onClick={() => onOpen?.(r.journey_id)}
          className="min-w-0 flex-1 rounded-lg text-left enabled:hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
          <span className="block font-semibold text-hc-ink">{r.name ?? "—"}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-hc-ink-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${REQUEST_IS[r.kind].cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${REQUEST_IS[r.kind].dot}`} aria-hidden />
              {requestSummary(r.kind, r.detail)}
            </span>
            <span>beið í {waited(r.created_at)} · {STATUS_IS[r.status]}</span>
          </span>
        </button>
        {!open && (
          <button type="button" onClick={() => { setOpen(true); setReply(r.reply ?? ""); }}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-hc-brand/40 bg-hc-surface px-4 text-sm font-semibold text-hc-brand-text transition hover:bg-hc-brand-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
            Svara
          </button>
        )}
      </div>
      {r.body && <p className="mt-1 text-sm text-hc-ink-2">{r.body}</p>}

      {open && (
        <div className="mt-2 space-y-2">
          <label className="sr-only" htmlFor={`req-${r.id}`}>Svar til {r.name ?? "skjólstæðings"}</label>
          <textarea id={`req-${r.id}`} value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={4000} autoFocus
            className={input} placeholder="Svar sem skjólstæðingurinn sér í heilsuferðinni sinni…" />
          {err && <p role="alert" className="text-sm font-semibold text-hc-bad-ink">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void send("done")} className={tall(hcBtn.primary)}>
              {sending === "done" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {reply.trim() ? "Svara og loka" : "Loka án svars"}
            </button>
            {/* Keeping it open only means something with an answer in it. */}
            <button type="button" disabled={busy || !reply.trim()} onClick={() => void send("in_progress")} className={tall(hcBtn.secondary)}>
              {sending === "in_progress" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Svara, held áfram
            </button>
            <button type="button" onClick={() => { setOpen(false); setReply(""); setErr(""); }} className={tall(hcBtn.ghost)}>Hætta við</button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function WsRequests({ api, onOpen }: { api: Api; onOpen?: (journeyId: string) => void }) {
  const [rows, setRows] = useState<WsRequest[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/requests").catch(() => null);
    if (!r?.ok) { setTimeout(() => setFailed(true), 0); return; }
    const j = (await r.json().catch(() => ({}))) as { requests?: WsRequest[] };
    setTimeout(() => { setFailed(false); setRows(j.requests ?? []); }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  if (failed && rows === null) {
    return (
      <p role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl bg-hc-bad-surface px-4 py-3 text-sm text-hc-bad-ink">
        Náði ekki í beiðnir.
        <button type="button" onClick={() => void load()} className={tall(hcBtn.secondary)}>Reyna aftur</button>
      </p>
    );
  }
  if (rows === null) return <div className="h-16 rounded-2xl hc-shimmer" aria-busy="true" aria-label="Hleð beiðnum" />;
  if (!rows.length) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-hc-ink-2">Beiðnir · {rows.length}</h2>
      <ul className="divide-y divide-hc-hairline overflow-hidden rounded-2xl border border-hc-hairline bg-hc-surface">
        {rows.map((r) => (
          <RequestRow key={r.id} api={api} r={r} onDone={() => void load()}
            onOpen={onOpen}
            dot={onOpen ? undefined : <ChevronRight className="h-4 w-4 text-hc-ink-3" aria-hidden />} />
        ))}
      </ul>
    </section>
  );
}
