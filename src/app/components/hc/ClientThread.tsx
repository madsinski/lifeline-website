"use client";

// The thread with one client, inside their workspace.
//
// CoachInbox already does this across every client, but it holds its own
// thread state and list state together, so scoping it to one journey would
// have meant pulling it apart. This is the small version against the same
// endpoint: the conversation, and a reply.
//
// Marking read is the coach's side of hc_chat.read_by_coach_at, and it
// happens on open rather than on reply — opening the thread IS reading it,
// and a coach who reads and decides to answer later has still read it.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { fmtDateTime } from "@/app/components/account/ui/dates";
import { hcCard, hcInput } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Msg {
  id: string;
  author_kind: "client" | "coach";
  author_name: string | null;
  kind: "message" | "nudge";
  body: string | null;
  created_at: string;
}

/* "15. okt. kl. 14:30", by hand — the browser's "is" locale data is patchy. */
const when = (iso: string) => fmtDateTime(iso, { month: "short" });

export default function ClientThread({ api, journeyId, onRead }: {
  api: Api;
  journeyId: string;
  /** So the workspace can clear its unread badge without waiting for a poll. */
  onRead?: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await api(`/api/vinnustod/chat?journey=${encodeURIComponent(journeyId)}`).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setMsgs(j?.messages ?? []), 0);
    /* Reading it is reading it, whether or not a reply follows. */
    if (r?.ok) {
      await api("/api/vinnustod/chat", { method: "POST", body: JSON.stringify({ journey: journeyId, seen: true }) }).catch(() => {});
      onRead?.();
    }
  }, [api, journeyId, onRead]);

  useEffect(() => { void load(); }, [load]);

  /* Newest message in view when the thread opens or grows. */
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true); setErr("");
    const r = await api("/api/vinnustod/chat", {
      method: "POST", body: JSON.stringify({ journey: journeyId, send: text }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setErr("Skilaboðin fóru ekki. Reyndu aftur."); return; }
    setDraft("");
    await load();
  };

  if (msgs === null) {
    return <div className="h-24 rounded-hc-card hc-shimmer" aria-busy="true" aria-label="Hleð samtali" />;
  }

  return (
    <div className="space-y-2">
      {msgs.length === 0 ? (
        <p className={`${hcCard.base} p-3 text-sm text-hc-ink-2`}>
          Ekkert samtal enn. Það sem þú skrifar hér birtist í appinu hjá skjólstæðingnum.
        </p>
      ) : (
        <div className={`max-h-80 space-y-2 overflow-y-auto p-3 ${hcCard.base}`}>
          {msgs.map((m) => {
            const mine = m.author_kind === "coach";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  /* A nudge is something the system sent on the coach's
                     behalf, not something they typed, so it does not get to
                     look like their own words. */
                  m.kind === "nudge" ? "bg-hc-warn-surface text-hc-warn-ink ring-1 ring-hc-warn-ink/30"
                    : mine ? "bg-hc-brand-dark text-white" : "bg-hc-sunken-2 text-hc-ink"}`}>
                  {m.body}
                  <span className={`mt-1 block text-[11px] ${mine && m.kind !== "nudge" ? "text-white/85" : "text-hc-ink-2"}`}>
                    {m.kind === "nudge" ? "Hvatning · " : ""}{when(m.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
          placeholder="Skrifaðu til skjólstæðingsins…"
          className={`${hcInput} min-w-0 flex-1`} />
        <button type="button" onClick={() => void send()} disabled={!draft.trim() || busy}
          aria-label="Senda skilaboð"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-hc-brand-dark text-white hover:bg-emerald-800 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {err && <p className="text-sm text-hc-bad-ink">{err}</p>}
    </div>
  );
}
