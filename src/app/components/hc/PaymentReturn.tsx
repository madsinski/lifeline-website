"use client";

/*
 * Back from Straumur's payment page.
 *
 * Every Straumur session returns (and is abandoned) to the page it started
 * on with ?greidsla=<our reference>. usePaymentStatus asks
 * /api/hc/payment-status — which checks with Straumur server-to-server and
 * settles a paid session — and this says where things stand. Nothing here
 * marks anything paid; the page reloads once the server has done it.
 *
 * Mounted once in /app (layout) and on /account. /app/askrift shows the
 * same answer inline, as its own last screen, so this stays out of its way.
 */

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PAY_STATE_COPY, usePaymentStatus } from "./subscription-parts";

export default function PaymentReturn() {
  const path = usePathname();
  if (path?.startsWith("/app/askrift")) return null;
  return <PaymentReturnToast />;
}

function PaymentReturnToast() {
  const { state, clear } = usePaymentStatus(() => { setTimeout(() => window.location.reload(), 1200); });
  if (!state) return null;
  const tone = state === "paid" ? "bg-hc-ok-surface text-hc-ok-ink" : state === "checking" ? "bg-hc-surface text-hc-ink-2" : "bg-hc-warn-surface text-hc-warn-ink";
  return (
    <div role="status" aria-live="polite"
      className={`fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl p-4 text-sm shadow-lg ring-1 ring-hc-hairline ${tone}`}
      style={{ marginTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-start gap-3">
        {state === "checking" && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />}
        <p className="flex-1">{PAY_STATE_COPY[state]}</p>
        {state !== "checking" && state !== "paid" && (
          <button type="button" onClick={clear} className="-my-2 min-h-11 rounded-full px-3 text-sm font-semibold underline">Loka</button>
        )}
      </div>
    </div>
  );
}
