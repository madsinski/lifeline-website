"use client";

// The participant puts their own Grunnheilsa PDF into the heilsuferð
// (POST /api/hc/report). Read on our server only; the file is not kept.

import { useRef, useState } from "react";
import { Check, FileUp, Loader2, ShieldCheck } from "lucide-react";
import { SELF_CONSENT_LABEL, SELF_CONSENT_POINTS, SELF_CONSENT_VERSION } from "@/lib/hc/consent";
import { hcBtn, hcCard } from "./ui";
import * as cache from "@/lib/hc/client-cache";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export default function ReportUpload({ api, onDone, compact, heading, blurb }: {
  api: Api;
  onDone: () => void;
  compact?: boolean;
  /** Overrides for the second home of this card: adding a LATER report. */
  heading?: string;
  blurb?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Unticked, always.
   *
   * A pre-ticked box is not consent — it is an assumption with a checkbox
   * drawn on it, and Art. 4(11) wants an affirmative act. So the upload
   * stays shut until this is true, and the server refuses without it.
   */
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = async (files: FileList) => {
    setBusy(true); setMsg(null);
    const fd = new FormData();
    for (const f of Array.from(files).slice(0, 3)) fd.append("files", f);
    // The version, not a boolean: the row records which wording was agreed.
    if (consent) fd.append("consent", SELF_CONSENT_VERSION);
    const r = await api("/api/hc/report", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: j.error || "Tókst ekki að lesa skýrsluna." }); return; }
    cache.invalidate("/api/hc/");
    setMsg({ ok: true, text: "Skýrslan er komin inn." });
    onDone();
  };

  return (
    <div className={compact ? "" : `${hcCard.base} p-5`}>
      {!compact && (
        <>
          <p className="font-semibold text-hc-ink">{heading ?? "Ertu með skýrsluna þína?"}</p>
          <p className="mt-1 text-sm text-hc-ink-2">
            {blurb ?? "Sæktu PDF-skýrsluna „Grunnheilsa“ í sjúklingagáttina og settu hana hér inn. Þá sérðu niðurstöðurnar strax og getur búið til áætlunina þína sjálf(ur), eða beðið eftir viðtalinu."}
          </p>
        </>
      )}
      <input ref={ref} type="file" accept="application/pdf" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
      {/* What happens to it, before the tick rather than after.
          Four points, each one true of what the code does: the file is read
          in memory and never written, the parse is encrypted at column
          level, the retention review asks after a year, and this is not a
          sjúkraskrá. Said plainly because a person handing over their own
          blood results is entitled to know all four without reading a
          policy page. */}
      <ul className="mt-3 space-y-2.5 rounded-hc-element bg-slate-50 p-4 ring-1 ring-slate-200">
        {SELF_CONSENT_POINTS.map((x) => (
          <li key={x.title} className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-hc-ink">{x.title}</span>
              <span className="block text-sm leading-snug text-hc-ink-2">{x.body}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* The tick itself. Unticked, and the upload stays shut until it is
          not — the server refuses without it either way. */}
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-hc-element p-1">
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${
          consent ? "border-hc-brand bg-hc-brand text-white" : "border-slate-300"}`}>
          {consent && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
        </span>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="sr-only" />
        <span className="text-sm leading-snug text-hc-ink">{SELF_CONSENT_LABEL}</span>
      </label>

      <button type="button" onClick={() => ref.current?.click()} disabled={busy || !consent}
        className={`${hcBtn.dark} mt-3 w-full disabled:opacity-40`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
        {busy ? "Les skýrsluna…" : "Velja PDF og hlaða upp"}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Kennitalan á skýrslunni þarf að vera þín. Þú getur afturkallað samþykkið með því að eyða skýrslunni í Aðgangi.
      </p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
