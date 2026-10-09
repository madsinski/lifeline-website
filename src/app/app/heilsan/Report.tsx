"use client";

// Skýrslan — upload your own Grunnheilsa PDF, and read what it said.
//
// The upload posts to the existing /api/hc/report, which reads the PDF on
// our own server with allowAi:false, never keeps the file, stores only the
// parsed result encrypted, and refuses a report whose kennitala is not
// yours. None of that is re-implemented here.
//
// The traffic light is Lifeline's own, from hc_knowledge — not the word the
// report printed, because Medalia's wording and cut-offs vary. The report's
// own phrasing is shown beside it rather than replaced.

import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Loader2, ShieldCheck } from "lucide-react";
import { useApi } from "@/lib/hc/use-api";
import { useT } from "./../useT";
import { appBrand, appCard, appHeaderBar, greenHeader } from "./../ui";
import MetricRow, { type Metric } from "./MetricRow";

interface Payload {
  canUpload: boolean; reason?: string;
  report: { date: string | null; source: string | null; uploadedAt: string | null;
    method: string; flagged: number; items: Metric[] } | null;
}


export default function Report() {
  const api = useApi();
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [d, setD] = useState<Payload | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/app/report");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setD(j), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const upload = async (files: FileList) => {
    setBusy(true); setMsg(null);
    const fd = new FormData();
    for (const f of Array.from(files).slice(0, 3)) fd.append("files", f);
    const r = await api("/api/hc/report", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    // The endpoint's own messages are specific and in Icelandic (wrong
    // kennitala, missing kennitala, unreadable) — better than a generic one.
    if (!r.ok) { setMsg({ ok: false, text: j.error || t("rp.failed") }); return; }
    setMsg({ ok: true, text: t("rp.done") });
    await load();
  };

  if (d === undefined) return <div className="h-40 animate-pulse rounded-[14px] bg-white" aria-hidden />;
  if (d === null) return <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("home.failed")}</p>;

  if (!d.canUpload) {
    return <p className={`${appCard} p-5 text-sm`} style={{ color: appBrand.ink2 }}>{t("rp.noJourney")}</p>;
  }

  return (
    <div className="space-y-3">
      <section className={`${appCard} p-4`}>
        <p className="text-sm" style={{ color: appBrand.ink2 }}>{t("rp.intro")}</p>
        <input ref={ref} type="file" accept="application/pdf" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-bold text-white transition disabled:opacity-50"
          style={{ background: appBrand.primary }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
          {busy ? t("rp.reading") : t("rp.upload")}
        </button>
        <p className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: appBrand.ink3 }}>
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: appBrand.primary }} aria-hidden />
          {t("rp.privacy")}
        </p>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className="mt-2 text-sm font-semibold"
            style={{ color: msg.ok ? appBrand.primaryDark : appBrand.error }}>{msg.text}</p>
        )}
      </section>

      {!d.report ? (
        <p className={`${appCard} p-4 text-sm`} style={{ color: appBrand.ink2 }}>{t("rp.none")}</p>
      ) : (
        <>
          <div className={appHeaderBar} style={greenHeader}>
            <span className="flex-1 text-[15px] font-bold">
              {d.report.flagged > 0 ? `${d.report.flagged} ${t("rp.flagged")}` : t("rp.allGreen")}
            </span>
            {d.report.date && <span className="text-xs font-semibold opacity-90">{d.report.date}</span>}
          </div>

          {d.report.items.map((it) => <MetricRow key={it.key} m={it} />)}
        </>
      )}
    </div>
  );
}
