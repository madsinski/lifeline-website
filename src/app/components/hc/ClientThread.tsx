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

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Msg {
  id: string;
  author_kind: "client" | "coach";
  author_name: string | null;
  kind: "message" | "nudge";
  body: string | null;
  created_at: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("is-IS", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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
    return <div className="h-24 rounded-2xl hc-shimmer" aria-busy="true" aria-label="Hleð samtali" />;
  }

  return (
    <div className="space-y-2">
      {msgs.length === 0 ? (
        <p className="rounded-2xl bg-white p-3 text-sm text-slate-500 ring-1 ring-hc-hairline">
          Ekkert samtal enn. Það sem þú skrifar hér birtist í appinu hjá skjólstæðingnum.
        </p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl bg-white p-3 ring-1 ring-hc-hairline">
          {msgs.map((m) => {
            const mine = m.author_kind === "coach";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  /* A nudge is something the system sent on the coach's
                     behalf, not something they typed, so it does not get to
                     look like their own words. */
                  m.kind === "nudge" ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                    : mine ? "bg-hc-ink text-white" : "bg-slate-100 text-slate-900"}`}>
                  {m.body}
                  <span className={`mt-1 block text-[10px] ${mine && m.kind !== "nudge" ? "text-white/60" : "text-slate-500"}`}>
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
          className="min-w-0 flex-1 rounded-2xl border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-hc-brand" />
        <button type="button" onClick={() => void send()} disabled={!draft.trim() || busy}
          aria-label="Senda skilaboð"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hc-ink text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </div>
  );
}
