"use client";

// "Senda staðfestingarpóst aftur" for the B2B contact person. Same look and
// cooldown as the B2C one in /byrja/CheckEmail, but it goes through our own
// /api/business/signup (resend: true), which mails the link via Resend and
// lands it on /auth/business-confirm — Supabase's built-in resend would send
// a link that never signs the person in.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { authSecondary } from "@/app/components/AuthShell";

const COOLDOWN_S = 60;

export default function ResendB2BConfirmation({ email, className = "" }: { email: string; className?: string }) {
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const send = async () => {
    if (busy || left > 0) return;
    if (!email.trim()) { setMsg({ ok: false, text: "Sláðu fyrst inn netfangið þitt." }); return; }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/business/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), resend: true }),
    }).catch(() => null);
    setBusy(false);
    if (!res) { setMsg({ ok: false, text: "Engin tenging. Athugaðu netið og reyndu aftur." }); return; }
    if (res.status === 409) {
      setMsg({ ok: true, text: "Netfangið er þegar staðfest. Skráðu þig inn til að halda áfram." });
      return;
    }
    if (!res.ok) { setMsg({ ok: false, text: "Ekki tókst að senda póstinn. Reyndu aftur eftir smástund." }); return; }
    setLeft(COOLDOWN_S);
    setMsg({ ok: true, text: "Nýr staðfestingarpóstur er á leiðinni." });
  };

  return (
    <div className={className}>
      <button type="button" onClick={() => void send()} disabled={busy || left > 0} aria-busy={busy} className={authSecondary}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {busy ? "Sendi…" : left > 0 ? `Senda aftur (${left} s)` : "Senda staðfestingarpóst aftur"}
      </button>
      {msg && (
        <p role="status" className={`mt-2 text-center text-sm ${msg.ok ? "text-hc-ok-ink" : "text-hc-bad-ink"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
