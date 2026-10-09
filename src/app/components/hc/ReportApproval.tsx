"use client";

// "Hjúkrunarfræðingur setti skýrsluna þína inn. Er það rétt?"
//
// Shown when staff entered a report on the person's behalf — typically in
// the first coaching session, with the person sitting there. Until they
// confirm, the report is not rendered anywhere on their own surfaces.
//
// It is confirmation of provenance, not consent to process: the lawful
// basis is care by a health professional, which by this point exists. So
// the wording asks whether this is right, not whether they permit it — and
// it never implies that declining stops their care.
//
// The weight comes from where it happens. This is the person's own
// authenticated session; the same tap on the nurse's tablet would be the
// nurse clicking twice.

import { useCallback, useEffect, useState } from "react";
import { FileCheck2, Loader2 } from "lucide-react";
import { hcBtn, hcCard, hcKicker } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Pending {
  id: string;
  reportDate: string | null;
  requestedBy: string | null;
  requestedAt: string;
}

export default function ReportApproval({ api, onDone }: { api: Api; onDone?: () => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/hc/report/approve");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setPending(j?.pending ?? null), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  if (!pending) return null;

  const decide = async (decision: "approve" | "decline") => {
    setBusy(decision); setErr(null);
    const r = await api("/api/hc/report/approve", {
      method: "POST", body: JSON.stringify({ id: pending.id, decision }),
    });
    if (r.ok) { setPending(null); onDone?.(); }
    else setErr("Tókst ekki að skrá svarið. Reyndu aftur.");
    setBusy(null);
  };

  return (
    <section className={`${hcCard.base} border-l-4 border-l-hc-brand p-5`} role="region"
      aria-label="Staðfesta skýrslu">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50">
          <FileCheck2 className="h-5 w-5 text-hc-brand-dark" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${hcKicker} text-hc-brand-dark`}>Staðfesting</p>
          <p className="mt-0.5 font-semibold text-hc-ink">
            {pending.requestedBy ? `${pending.requestedBy} setti` : "Starfsmaður setti"} Grunnheilsa-skýrsluna þína inn
            {pending.reportDate ? ` frá ${pending.reportDate}` : ""}.
          </p>
          <p className="mt-1 text-sm text-hc-ink-2">
            Staðfestu að skýrslan sé þín og að þú hafir beðið um að hún færi hér inn. Þá birtist hún
            á þínum síðum og áætlunin þín byggir á henni.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Skjalið sjálft er ekki geymt — aðeins niðurstöðurnar, dulkóðaðar. Frumritið er áfram í
            sjúklingagáttinni. Svarið þitt er skráð með tímasetningu.
          </p>

          {err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{err}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={hcBtn.primary} disabled={busy !== null}
              onClick={() => void decide("approve")}>
              {busy === "approve" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Já, skýrslan er mín
            </button>
            <button type="button" className={hcBtn.ghost} disabled={busy !== null}
              onClick={() => void decide("decline")}>
              {busy === "decline" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Nei, taka hana út
            </button>
          </div>
          {/* Nobody should have to wonder whether saying no costs them care. */}
          <p className="mt-2 text-xs text-slate-500">
            Þótt þú takir hana út heldur þjónustan áfram. Hjúkrunarfræðingurinn þinn hefur áfram
            aðgang að niðurstöðunum vegna meðferðarinnar.
          </p>
        </div>
      </div>
    </section>
  );
}
