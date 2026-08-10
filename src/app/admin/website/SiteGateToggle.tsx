"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMyStaffRole } from "@/lib/staff-role";

// Master coming-soon switch. When gated, the public site rewrites to
// /coming-soon for everyone without access; when open, the whole site is live.
export default function SiteGateToggle() {
  const [gated, setGated] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: session?.access_token ? `Bearer ${session.access_token}` : "" };
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setIsAdmin((await getMyStaffRole(user.email)) === "admin");
    const res = await fetch("/api/admin/site-gate", { headers: await authHeaders() });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setGated(j.gated !== false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const setGate = async (next: boolean) => {
    if (!next && !window.confirm("Opna vefinn fyrir öllum? Coming soon-læsingin verður tekin af og allir geta skoðað vefinn.")) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/site-gate", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ gated: next }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && j.ok) {
      setGated(next);
      setMsg({ type: "ok", text: next ? "Vefurinn er nú læstur (coming soon)." : "Vefurinn er nú í beinni — öllum opinn. Getur tekið allt að 30 sek." });
    } else {
      setMsg({ type: "err", text: j.error === "mfa_required" ? "Aðgerð krefst MFA." : j.error || "Aðgerð mistókst." });
    }
  };

  if (gated === null) {
    return <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 mb-8">Hleð…</div>;
  }

  return (
    <div className={`rounded-xl border p-4 mb-8 ${gated ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${gated ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {gated ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            )}
          </span>
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {gated ? "Vefurinn er læstur (coming soon)" : "Vefurinn er í beinni"}
            </div>
            <p className="text-xs text-gray-600 mt-0.5 max-w-xl">
              {gated
                ? "Aðeins stjórnendur og gestir með aðgang sjá vefinn. Aðrir fara á „coming soon“ síðuna."
                : "Allir geta skoðað almenna vefinn. Slökktu á þessu til að setja hann aftur í „coming soon“."}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setGate(!gated)}
            disabled={busy}
            className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${gated ? "bg-[#10B981] hover:bg-[#047857]" : "bg-amber-600 hover:bg-amber-700"}`}
          >
            {busy ? "Uppfæri…" : gated ? "Opna vefinn" : "Læsa vefnum"}
          </button>
        )}
      </div>
      {msg && (
        <div className={`mt-3 rounded-lg border p-2.5 text-xs ${msg.type === "ok" ? "border-emerald-200 bg-white text-emerald-700" : "border-red-200 bg-white text-red-700"}`}>{msg.text}</div>
      )}
      {!isAdmin && <p className="mt-2 text-[11px] text-gray-500">Aðeins stjórnendur geta breytt þessu.</p>}
    </div>
  );
}
