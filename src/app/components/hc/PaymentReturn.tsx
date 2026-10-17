"use client";

/*
 * Back from Straumur's payment page.
 *
 * Every Straumur session returns (and is abandoned) to the page it started
 * on with ?greidsla=<our reference>. This asks /api/hc/payment-status —
 * which checks with Straumur server-to-server and settles a paid session —
 * and says where things stand. Nothing here marks anything paid; the page
 * reloads once the server has done it.
 *
 * Mounted once in /app (layout) and on /account.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type State = "checking" | "paid" | "waiting" | "expired" | "failed" | null;

const POLL_MS = 2500;
const PATIENCE_MS = 25_000;

export default function PaymentReturn() {
  const [ref, setRef] = useState<string | null>(null);
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("greidsla");
    if (!r) return;
    const t = setTimeout(() => { setRef(r); setState("checking"); }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ref) return;
    let alive = true;
    const started = Date.now();
    const dropParam = () => {
      const u = new URL(window.location.href);
      u.searchParams.delete("greidsla");
      window.history.replaceState(null, "", u.toString());
    };
    const tick = async () => {
      if (!alive) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch(`/api/hc/payment-status?ref=${encodeURIComponent(ref)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) as { status?: string; fulfilled?: boolean } | null : null;
      if (!alive) return;
      if (j?.status === "paid" && j.fulfilled) {
        setState("paid");
        dropParam();
        setTimeout(() => window.location.reload(), 1200);
        return;
      }
      if (j?.status === "expired" || j?.status === "failed") { setState(j.status); dropParam(); return; }
      if (Date.now() - started > PATIENCE_MS) { setState("waiting"); return; }
      setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => { alive = false; };
  }, [ref]);

  if (!state) return null;
  const close = () => {
    setState(null);
    const u = new URL(window.location.href);
    u.searchParams.delete("greidsla");
    window.history.replaceState(null, "", u.toString());
  };
  const tone = state === "paid" ? "bg-hc-ok-surface text-hc-ok-ink" : state === "checking" ? "bg-hc-surface text-hc-ink-2" : "bg-hc-warn-surface text-hc-warn-ink";
  return (
    <div role="status" aria-live="polite"
      className={`fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl p-4 text-sm shadow-lg ring-1 ring-hc-hairline ${tone}`}>
      <div className="flex items-start gap-3">
        {state === "checking" && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />}
        <p className="flex-1">
          {state === "checking" && "Augnablik, við staðfestum greiðsluna…"}
          {state === "paid" && "Greiðsla móttekin. Takk fyrir."}
          {state === "waiting" && "Greiðslan hefur ekki borist enn. Ef þú lokaðir greiðslusíðunni geturðu reynt aftur. Annars birtist hún hér innan skamms."}
          {state === "expired" && "Greiðslusíðan rann út án greiðslu. Ekkert var skuldfært. Reyndu aftur þegar þér hentar."}
          {state === "failed" && "Greiðslan tókst ekki. Ekkert var skuldfært. Reyndu aftur."}
        </p>
        {state !== "checking" && state !== "paid" && (
          <button type="button" onClick={close} className="min-h-8 rounded-full px-2 text-xs font-semibold underline">Loka</button>
        )}
      </div>
    </div>
  );
}
