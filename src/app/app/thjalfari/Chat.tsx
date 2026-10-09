"use client";

// The conversation with your coach.
//
// Bodies are encrypted at rest, so both ends go through messages_decrypted.
// Sending is optimistic and reverted on failure, like the action tick.

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT, useShortDateTime } from "./../useT";
import { appBrand, appCard } from "./../ui";

interface Msg { id: string; mine: boolean; who: string | null; role: string | null; content: string; at: string }

export default function Chat() {
  const api = useApi();
  const t = useT();
  const at = useShortDateTime();
  const [convo, setConvo] = useState<{ id: string; coachName: string | null } | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await api("/api/app/coach");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      setConvo(j?.conversation ?? null);
      setMsgs(j?.messages ?? []);
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    const r = await api("/api/app/coach", { method: "POST", body: JSON.stringify({ content }) });
    if (r.ok) await load();
    else setDraft(content);
    setSending(false);
  };

  if (convo === undefined) return <div className="h-40 animate-pulse rounded-[14px] bg-white" aria-hidden />;
  if (convo === null) {
    return <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("chat.noConvo")}</p>;
  }

  return (
    <div className="space-y-3">
      {msgs.length === 0 ? (
        <p className={`${appCard} p-4 text-sm`} style={{ color: appBrand.ink2 }}>{t("chat.none")}</p>
      ) : (
        <div className="space-y-2">
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%] rounded-2xl px-3.5 py-2.5"
                style={m.mine
                  ? { background: appBrand.primary, color: "#fff" }
                  : { background: "#fff", color: appBrand.ink1, border: "1px solid rgba(0,0,0,0.06)" }}>
                {!m.mine && m.who && (
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>{m.who}</p>
                )}
                <p className="whitespace-pre-wrap text-sm leading-snug">{m.content}</p>
                <p className="mt-0.5 text-[10px]" style={{ color: m.mine ? "rgba(255,255,255,0.75)" : appBrand.ink3 }}>
                  {at(m.at)}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
          placeholder={t("chat.placeholder")} aria-label={t("chat.placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          className="min-h-[46px] flex-1 resize-none rounded-2xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-400" />
        <button type="button" onClick={() => void send()} disabled={!draft.trim() || sending}
          aria-label={t("chat.send")}
          className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full text-white transition disabled:opacity-40"
          style={{ background: appBrand.primary }}>
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
