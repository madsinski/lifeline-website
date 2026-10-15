"use client";

/*
 * "Þjálfarinn stingur upp á…" — a programme offered, with a real no.
 *
 * The coach could already change somebody's programme directly, and still
 * can. This is the other move, for when the change is a suggestion rather
 * than a decision: the person reads what it is, why it was suggested, and
 * answers. Declining is recorded, not swallowed — a coach who hears nothing
 * cannot tell refusal from an unread message.
 *
 * Shown on Í dag, because that is the page somebody opens anyway; a
 * suggestion behind a tab is a suggestion nobody sees.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { SAVE_FAILED, useToast } from "./Toast";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Suggestion {
  id: string;
  kind: "exercise" | "nutrition";
  name: string;
  description: string | null;
  goal: string | null;
  note: string | null;
  suggestedBy: string;
}

const KIND_IS: Record<string, string> = { exercise: "æfingaprógrammi", nutrition: "næringarprógrammi" };

export default function SuggestedProgram({ api, onAccepted }: { api: Api; onAccepted?: () => void }) {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState("");
  const toast = useToast();

  const load = useCallback(async () => {
    const r = await api("/api/hc/suggestions").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setRows(Array.isArray(j?.suggestions) ? j.suggestions : []), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const answer = async (id: string, a: "accept" | "decline") => {
    if (busy) return;
    setBusy(id);
    const r = await api("/api/hc/suggestions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, answer: a }),
    }).catch(() => null);
    setBusy("");
    /* A failed answer used to leave both buttons sitting there as if
       nothing had been pressed. The server's own reason is shown when it
       wrote one in Icelandic ("Prógrammið fannst ekki lengur."); an
       already-answered card is reloaded away. */
    if (!r?.ok) {
      const j = await r?.json().catch(() => null);
      const why = typeof j?.error === "string" && /[áéíóúýþæöð]/i.test(j.error) ? j.error : SAVE_FAILED;
      toast.show(r?.status === 409 && j?.error === "already_answered" ? "Þessu var þegar svarað." : why, { tone: "bad" });
      if (r?.status === 409) await load();
      return;
    }
    const msg = a === "accept" ? "Prógrammið er komið í áætlunina þína." : "Takk — við látum þjálfarann vita.";
    setDone(msg);
    /* The page reloads after an accept, which can take this card (and its
       inline confirmation) with it; the toast outlives that. */
    toast.show(msg, { tone: "ok" });
    await load();
    if (a === "accept") onAccepted?.();
  };

  if (!rows.length) {
    /* The confirmation outlives the card it belonged to: answering makes
       the suggestion disappear, and a card that vanishes with no word for
       it reads as a misclick. */
    return done ? <p className="px-1 text-sm text-hc-ink-2">{done}</p> : null;
  }

  return (
    <div className="space-y-2">
      {rows.map((s) => (
        <section key={s.id} className="rounded-2xl bg-hc-info-surface p-4 ring-1 ring-hc-info-ink/25">
          <p className="text-xs font-bold uppercase tracking-wide text-hc-info-ink">
            {s.suggestedBy} stingur upp á {KIND_IS[s.kind] ?? "prógrammi"}
          </p>
          <h3 className="mt-0.5 font-bold text-hc-ink">{s.name}</h3>
          {s.goal && <p className="text-sm text-hc-ink-2">{s.goal}</p>}
          {s.note && (
            <p className="mt-2 rounded-xl bg-hc-surface/70 px-3 py-2 text-sm text-hc-ink">„{s.note}“</p>
          )}
          {s.description && <p className="mt-2 text-sm text-hc-ink-2">{s.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void answer(s.id, "accept")} disabled={!!busy}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-hc-brand-dark px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-40">
              {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              Já, taka þetta upp
            </button>
            {/* Not a quiet dismissal: the answer goes back. */}
            <button type="button" onClick={() => void answer(s.id, "decline")} disabled={!!busy}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-hc-ink-2 transition hover:bg-hc-surface disabled:opacity-40">
              <X className="h-4 w-4" aria-hidden /> Ekki núna
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
