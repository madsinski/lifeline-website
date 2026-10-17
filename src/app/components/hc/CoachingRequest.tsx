"use client";

// Asking for "Lifeline þjálfun" before paying, on /app/askrift and on the
// Þjálfun tab (CoachingOffer). Four states, from /api/hc/coaching-request:
//
//   none      one line on who it is for, and „Senda beiðni um Lifeline þjálfun“
//   pending   „Beiðnin er í skoðun“, when it was sent, „Afturkalla“
//   declined  the worker's reason, how to reach us, and a new request
//   approved  the parent's own pay button (`payAction`)
//
// The server decides everything (src/lib/hc/coaching-requests.ts); this only
// shows where the person stands and posts the two actions.

import { useState } from "react";
import { CheckCircle2, Clock3, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { hcBtn } from "./ui";
import { fmtDate } from "@/app/components/account/ui/dates";
import { CONTACT_EMAIL, REQUEST_INTRO_COPY, type CoachingRequestView } from "@/lib/hc/coaching-config";

async function call(method: "POST" | "DELETE"): Promise<{ ok: boolean; request?: CoachingRequestView; error?: string }> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  const r = await fetch("/api/hc/coaching-request", {
    method, headers: t ? { Authorization: `Bearer ${t}` } : {},
  }).catch(() => null);
  const j = await r?.json().catch(() => null);
  if (!r) return { ok: false, error: "Engin tenging. Athugaðu netið og reyndu aftur." };
  if (!r.ok) return { ok: false, error: typeof j?.error === "string" ? j.error : "Ekki tókst að senda. Reyndu aftur." };
  return { ok: true, request: j?.request };
}

export default function CoachingRequestPanel({ request, onChange, payAction }: {
  request: CoachingRequestView;
  /** Called with the new state after sending or withdrawing. */
  onChange: (v: CoachingRequestView) => void;
  /** What to show once approved: the button to the payment step. */
  payAction: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (method: "POST" | "DELETE") => {
    if (busy) return;
    setBusy(true); setErr(null);
    const r = await call(method);
    setBusy(false);
    if (!r.ok || !r.request) { setErr(r.error ?? "Ekki tókst að senda. Reyndu aftur."); return; }
    onChange(r.request);
  };

  if (request.state === "approved") {
    return (
      <div className="space-y-3">
        <p className="flex gap-2 text-sm text-hc-ink-2" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />
          <span>
            Beiðnin þín hefur verið samþykkt. Þú getur gengið frá áskriftinni
            {request.expires_at ? ` til ${fmtDate(request.expires_at)}` : ""}.
          </span>
        </p>
        {payAction}
      </div>
    );
  }

  if (request.state === "pending") {
    return (
      <div className="rounded-hc-element border border-hc-hairline bg-hc-sunken p-4" role="status">
        <p className="flex items-center gap-2 font-semibold text-hc-ink">
          <Clock3 className="h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden /> Beiðnin er í skoðun
        </p>
        <p className="mt-1 text-sm text-hc-ink-2">
          {request.created_at ? `Send ${fmtDate(request.created_at)}. ` : ""}
          Við látum þig vita þegar hún hefur verið staðfest, yfirleitt innan sólarhrings. Ekkert er greitt fyrr en þá.
        </p>
        <button type="button" className={`${hcBtn.ghost} mt-2`} disabled={busy} onClick={() => void run("DELETE")}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Afturkalla
        </button>
        {err && <p className="mt-1 text-sm font-semibold text-hc-bad-ink" role="alert">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {request.state === "declined" && (
        <div className="rounded-hc-element border border-hc-hairline bg-hc-sunken p-4">
          <p className="font-semibold text-hc-ink">Við gátum ekki samþykkt beiðnina</p>
          {request.decline_reason && <p className="mt-1 text-sm text-hc-ink-2">{request.decline_reason}</p>}
          <p className="mt-2 text-sm text-hc-ink-2">
            Spurningar? Skrifaðu okkur á{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-hc-ink underline">{CONTACT_EMAIL}</a>.
            Ef eitthvað hefur breyst, til dæmis heimilisfangið, geturðu sent nýja beiðni.
          </p>
        </div>
      )}
      <p className="flex gap-2 text-sm text-hc-ink-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />
        <span>{REQUEST_INTRO_COPY}</span>
      </p>
      <button type="button" className={request.state === "declined" ? hcBtn.secondary : `${hcBtn.cta} w-full sm:w-auto`}
        disabled={busy} onClick={() => void run("POST")}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {request.state === "declined" ? "Senda nýja beiðni" : "Senda beiðni um Lifeline þjálfun"}
      </button>
      {err && <p className="text-sm font-semibold text-hc-bad-ink" role="alert">{err}</p>}
    </div>
  );
}
