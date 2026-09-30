"use client";

// The participant puts their own Grunnheilsa PDF into the heilsuferð
// (POST /api/hc/report). Read on our server only; the file is not kept.

import { useRef, useState } from "react";
import { FileUp, Loader2, ShieldCheck } from "lucide-react";
import { hcBtn, hcCard } from "./ui";
import * as cache from "@/lib/hc/client-cache";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export default function ReportUpload({ api, onDone, compact }: { api: Api; onDone: () => void; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = async (files: FileList) => {
    setBusy(true); setMsg(null);
    const fd = new FormData();
    for (const f of Array.from(files).slice(0, 3)) fd.append("files", f);
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
          <p className="font-semibold text-hc-ink">Ertu með skýrsluna þína?</p>
          <p className="mt-1 text-sm text-hc-ink-2">
            Sæktu PDF-skýrsluna „Grunnheilsa“ í sjúklingagáttina og settu hana hér inn. Þá sérðu niðurstöðurnar strax og getur
            búið til áætlunina þína sjálf(ur), eða beðið eftir viðtalinu.
          </p>
        </>
      )}
      <input ref={ref} type="file" accept="application/pdf" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className={`${hcBtn.dark} ${compact ? "" : "mt-3"}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
        {busy ? "Les skýrsluna…" : "Hlaða upp skýrslu (PDF)"}
      </button>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
        Lesin á okkar eigin netþjóni, ekki send áfram. Skjalið sjálft er ekki geymt, aðeins niðurstöðurnar, dulkóðaðar.
        Kennitalan á skýrslunni þarf að vera þín.
      </p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
