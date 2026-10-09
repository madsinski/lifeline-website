"use client";

// "Viltu halda skýrslunni þinni?"
//
// Asked about once a year, and only when nothing has been done with the
// report for six months — somebody actively using it has already answered
// by using it.
//
// The card says the original is still in Medalia, because that is what makes
// the question honest. Without it people click "keep" out of fear of losing
// their results, and a review that always returns "keep" limits nothing.

import { useCallback, useEffect, useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { hcBtn, hcCard, hcKicker } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Review {
  id: string;
  reportDate: string | null;
  heldSince: string;
  state: "asked" | "reminded" | "due-removal";
}

export default function RetentionReview({ api, onDone }: { api: Api; onDone?: () => void }) {
  const [r, setR] = useState<Review | null>(null);
  const [busy, setBusy] = useState<"keep" | "remove" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api("/api/hc/report/retention");
    const j = res.ok ? await res.json().catch(() => null) : null;
    setTimeout(() => setR(j?.review ?? null), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  if (!r) return null;

  const decide = async (decision: "keep" | "remove") => {
    setBusy(decision); setErr(null);
    const res = await api("/api/hc/report/retention", {
      method: "POST", body: JSON.stringify({ id: r.id, decision }),
    });
    if (res.ok) { setR(null); onDone?.(); }
    else setErr("Tókst ekki að skrá svarið. Reyndu aftur.");
    setBusy(null);
  };

  return (
    <section className={`${hcCard.base} p-5`} role="region" aria-label="Geymsla skýrslu">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100">
          <Archive className="h-5 w-5 text-slate-600" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${hcKicker} text-slate-500`}>Geymsla</p>
          <p className="mt-0.5 font-semibold text-hc-ink">
            Viltu halda skýrslunni þinni{r.reportDate ? ` frá ${r.reportDate}` : ""}?
          </p>
          <p className="mt-1 text-sm text-hc-ink-2">
            Við geymum heilsugögn ekki lengur en þörf er á. Ekkert hefur verið gert við þessa
            skýrslu í nokkurn tíma og því spyrjum við frekar en að ákveða fyrir þig.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Frumritið er áfram í sjúklingagáttinni. Þótt þú takir hana út hér geturðu sótt hana
            aftur hvenær sem er — þú tapar engu.
            {r.state === "reminded" && " Við spurðum fyrir mánuði."}
          </p>

          {err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{err}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={hcBtn.primary} disabled={busy !== null}
              onClick={() => void decide("keep")}>
              {busy === "keep" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Halda henni
            </button>
            <button type="button" className={hcBtn.ghost} disabled={busy !== null}
              onClick={() => void decide("remove")}>
              {busy === "remove" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Taka hana út
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
