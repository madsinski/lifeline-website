"use client";

// The coach's inbox: who is waiting, and a reply box.
//
// hc_chat had a participant writing into it and nobody reading. Everything
// on the Þjálfari page worked except the half that makes it a conversation,
// so a message sent from there sat in the database unseen. This is the other
// end.
//
// Unanswered first, then newest. A nurse opening this wants the queue, not a
// chronology — the person who asked something three days ago and got nothing
// matters more than the one who said "takk" an hour ago.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { hcBtn, hcCard } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Thread {
  journeyId: string; clientId: string; name: string;
  last: string | null; lastAt: string; lastFrom: "client" | "coach"; unread: number;
}
interface Msg {
  id: string; author_kind: "client" | "coach"; author_name: string | null;
  kind: "message" | "nudge"; body: string | null; created_at: string;
  /** Shown dimmed: typed, sent, not yet acknowledged by the server. */
  pending?: boolean;
}

const MO = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
/** Hand-formatted: no Icelandic locale data in the Vercel runtime. */
function ago(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `fyrir ${Math.max(1, mins)} mín.`;
  if (mins < 60 * 20) return `kl. ${hhmm(d)}`;
  return `${d.getDate()}. ${MO[d.getMonth()]}`;
}

/** Ready-made replies for the things coaches answer most often. */
const NUDGES = [
  "Hæ, ég sé að vikan hefur verið róleg. Er eitthvað sem stendur í vegi sem við getum lagað?",
  "Flott gengi í vikunni — haltu þessu áfram.",
  "Þú hefur ekki merkt við í nokkra daga. Viltu að við léttum áætlunina aðeins?",
];

export default function CoachInbox({ api, onRead }: {
  api: Api;
  /** Tell the page the badge is stale, so it clears without a poll wait. */
  onRead?: () => void;
}) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [open, setOpen] = useState<Thread | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /** The list never arrived. Distinct from "no threads", which is fine. */
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  /** Ids for optimistic bubbles. A counter, not a clock: Date.now() counts
   *  as impure and the compiler is right that it does not belong here. */
  const seq = useRef(0);

  const loadList = useCallback(async () => {
    const r = await api("/api/vinnustod/chat").catch(() => null);
    // Say so rather than pulsing a grey box for ever. An inbox that cannot
    // load looks exactly like an inbox that is loading, and the coach has
    // no way to tell which they are waiting for.
    if (!r?.ok) { setTimeout(() => setFailed(true), 0); return; }
    const j = await r.json();
    // Deferred, like the rest of this file: setting state on the path an
    // effect calls synchronously is what the compiler objects to.
    setTimeout(() => { setFailed(false); setThreads(j.threads ?? []); }, 0);
  }, [api]);

  /*
   * Keep the inbox live while it is on screen. The page badge polls for the
   * count; this is the list and the open conversation, so a coach watching
   * a thread sees the next message land instead of refreshing to find it.
   */
  useEffect(() => {
    void loadList();
    const tick = () => { if (document.visibilityState === "visible") void loadList(); };
    const id = window.setInterval(tick, 15_000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(id); window.removeEventListener("focus", tick); };
  }, [loadList]);

  const loadThread = useCallback(async (t: Thread) => {
    const r = await api(`/api/vinnustod/chat?journey=${encodeURIComponent(t.journeyId)}`).catch(() => null);
    if (!r?.ok) return;
    const j = await r.json();
    setMsgs(j.messages ?? []);
    // Opening it is reading it, so the count stops arguing with a nurse who
    // has read the question and is thinking about the answer.
    await api("/api/vinnustod/chat", { method: "POST", body: JSON.stringify({ journey: t.journeyId, seen: true }) }).catch(() => {});
    onRead?.();
    void loadList();
  }, [api, loadList, onRead]);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  const send = async (text: string, nudge = false) => {
    const body = text.trim();
    if (!open || !body) return;
    setErr("");
    setBusy(true);

    /*
     * Show it immediately, dimmed, then reconcile.
     *
     * The same defect the participant side had, and the same complaint:
     * press send, nothing visibly happens, so you cannot tell whether it
     * went. The round trip is a write plus a reload of two lists.
     */
    const temp: Msg = {
      id: `pending-${(seq.current += 1)}`, author_kind: "coach", author_name: null,
      kind: nudge ? "nudge" : "message", body, created_at: new Date().toISOString(),
      pending: true,
    };
    setMsgs((m) => [...m, temp]);
    const had = draft;
    setDraft("");

    const r = await api("/api/vinnustod/chat", { method: "POST",
      body: JSON.stringify({ journey: open.journeyId, send: body, nudge }) }).catch(() => null);
    setBusy(false);

    if (!r?.ok) {
      // Take the bubble back and hand the words back to the composer, so a
      // failed send does not quietly eat what was typed.
      setMsgs((m) => m.filter((x) => x.id !== temp.id));
      if (!nudge) setDraft(had || body);
      const j = r ? await r.json().catch(() => ({})) : {};
      setErr((j as { error?: string }).error || "Skilaboðin fóru ekki. Prófaðu aftur.");
      return;
    }
    await loadThread(open);
  };

  if (threads === null) {
    return failed ? (
      <div className={`${hcCard.base} px-4 py-8 text-center`}>
        <p className="text-sm font-semibold text-hc-ink">Náði ekki í skilaboðin.</p>
        <p className="mt-1 text-xs text-slate-500">Athugaðu netsambandið.</p>
        <button type="button" onClick={() => { setFailed(false); void loadList(); }}
          className={`${hcBtn.secondary} mt-3`}>Reyna aftur</button>
      </div>
    ) : <div className="h-40 animate-pulse rounded-hc-card bg-white" aria-hidden />;
  }

  // ── One conversation ──────────────────────────────────────────────────
  if (open) {
    return (
      <section className={`${hcCard.base} flex flex-col overflow-hidden`}>
        <div className="flex items-center gap-3 border-b border-slate-100 p-3">
          <button type="button" onClick={() => { setOpen(null); setMsgs([]); }}
            aria-label="Til baka" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate font-bold text-hc-ink">{open.name}</p>
        </div>

        {/* No overscroll-contain here. It belongs inside a sheet, where
            scrolling past the end should not drift the page behind it. On a
            page this list is 52vh of the screen, so containing the
            scroll stranded the page: a thumb over the conversation could not
            move it at all. Reaching the end now hands the scroll onward. */}
        <div className="max-h-[52vh] min-h-32 flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-4">
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.author_kind === "coach" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${m.pending ? "opacity-60" : ""} ${
                m.author_kind === "coach"
                  ? m.kind === "nudge" ? "bg-amber-100 text-amber-950" : "bg-hc-brand text-white"
                  : "bg-white text-slate-900 ring-1 ring-slate-200"}`}>
                {m.author_kind === "coach" && m.author_name && (
                  <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide opacity-60">
                    {m.kind === "nudge" && <Sparkles className="h-3 w-3" aria-hidden />}{m.author_name}
                  </p>
                )}
                <p className="whitespace-pre-wrap leading-snug">{m.body}</p>
                <p className={`mt-1 text-[10px] ${m.author_kind === "coach" && m.kind !== "nudge" ? "text-white/70" : "text-slate-400"}`}>
                  {m.pending ? "Sendi…" : ago(m.created_at)}
                </p>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>

        {/* The nudges. Sent as kind=nudge so the person's page shows them
            apart from answers — a coach reaching out unprompted is not a
            reply to anything they asked. */}
        {!draft && (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 pt-3">
            {NUDGES.map((n, i) => (
              <button key={i} type="button" disabled={busy} onClick={() => void send(n, true)}
                className="rounded-full bg-amber-50 px-3 py-1.5 text-left text-xs font-semibold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100 disabled:opacity-40">
                <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />{n.slice(0, 38)}…
              </button>
            ))}
          </div>
        )}
        {err && (
          <p role="status" className="mx-3 mt-2 rounded-hc-element bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 ring-1 ring-red-200">
            {err}
          </p>
        )}
        <div className="flex items-end gap-2 p-3">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
            placeholder="Svaraðu…" aria-label={`Svar til ${open.name}`}
            className="max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-hc-element border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hc-brand" />
          <button type="button" onClick={() => void send(draft)} disabled={busy || !draft.trim()}
            aria-label="Senda" className={`${hcBtn.primary} shrink-0 disabled:opacity-40`}>
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </section>
    );
  }

  // ── The list ──────────────────────────────────────────────────────────
  if (!threads.length) {
    return (
      <p className={`${hcCard.base} px-4 py-8 text-center text-sm text-slate-500`}>
        Engin skilaboð enn. Þegar einhver skrifar úr heilsuferðinni birtist það hér.
      </p>
    );
  }
  return (
    <ul className={`${hcCard.base} divide-y divide-slate-100 overflow-hidden`}>
      {threads.map((t) => (
        <li key={t.journeyId}>
          <button type="button" onClick={() => { setOpen(t); void loadThread(t); }}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${t.unread ? "bg-red-500" : "bg-transparent"}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className={`min-w-0 flex-1 truncate ${t.unread ? "font-bold text-hc-ink" : "font-semibold text-slate-700"}`}>{t.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{ago(t.lastAt)}</span>
              </span>
              <span className={`mt-0.5 block truncate text-sm ${t.unread ? "text-slate-700" : "text-slate-500"}`}>
                {t.lastFrom === "coach" ? "Þú: " : ""}{t.last}
              </span>
            </span>
            {t.unread > 0 && (
              <span className="mt-0.5 grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{t.unread}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
