"use client";

// Employer health-check codes. One personal code per employee: they create
// their own free Lifeline account, pick the health check and tick „Fyrirtækið
// mitt greiðir“ at checkout. The company is invoiced; it never sees results.
// API: /api/business/companies/[companyId]/hc-codes

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Code { id: string; member_id: string | null; code: string; redeemed_at: string | null; revoked_at: string | null; emailed_at: string | null; expires_at: string | null }
interface MemberLite { id: string; full_name: string; email: string }

async function call(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}) } });
}

export default function HcCodesCard({ companyId, members }: { companyId: string; members: MemberLite[] }) {
  const [codes, setCodes] = useState<Code[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const r = await call(`/api/business/companies/${companyId}/hc-codes`);
    if (r.ok) setCodes((await r.json()).codes);
  }, [companyId]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const active = useMemo(() => codes.filter((c) => !c.revoked_at), [codes]);
  const byMember = useMemo(() => new Map(active.map((c) => [c.member_id, c])), [active]);
  const without = members.filter((m) => !byMember.has(m.id));
  const redeemed = active.filter((c) => c.redeemed_at).length;

  const issue = async (email: boolean) => {
    setBusy(true); setMsg("");
    const r = await call(`/api/business/companies/${companyId}/hc-codes`, { method: "POST", body: JSON.stringify({ all: true, email }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? `${j.created} kóðar búnir til${email ? `, ${j.emailed} sendir í tölvupósti` : ""}.` : j.error || "Tókst ekki.");
    await load();
  };
  const revoke = async (id: string) => {
    if (!confirm("Ógilda kóðann?")) return;
    const r = await call(`/api/business/companies/${companyId}/hc-codes?code_id=${id}`, { method: "DELETE" });
    if (!r.ok) setMsg((await r.json().catch(() => ({}))).error || "Tókst ekki.");
    await load();
  };

  const list = showAll ? members : members.slice(0, 8);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Heilsufarsskoðun</p>
          <h2 className="mt-1 text-lg font-bold text-[#0F172A]">Kóðar starfsmanna</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Hver starfsmaður fær persónulegan kóða. Hann stofnar sinn eigin aðgang hjá Lifeline og slær kóðann inn í greiðsluskrefinu. Fyrirtækið fær reikning en sér aldrei heilsufarsupplýsingar.
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-2xl font-bold tabular-nums text-[#0F172A]">{redeemed}<span className="text-base font-medium text-slate-400"> / {active.length}</span></p>
          <p className="text-xs text-slate-500">kóðar notaðir</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => issue(true)} disabled={busy || without.length === 0} className="rounded-full bg-[#10B981] px-4 py-2 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-40">
          {busy ? "Augnablik…" : `Búa til og senda kóða (${without.length})`}
        </button>
        <button onClick={() => issue(false)} disabled={busy || without.length === 0} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">
          Búa til án tölvupósts
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}

      {members.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <tbody>
              {list.map((m) => {
                const c = byMember.get(m.id);
                return (
                  <tr key={m.id} className="border-t border-slate-100 first:border-t-0">
                    <td className="px-3 py-2"><p className="font-medium text-slate-800">{m.full_name}</p><p className="text-xs text-slate-500">{m.email}</p></td>
                    <td className="px-3 py-2 font-mono text-xs">{c?.code ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {!c ? "Enginn kóði" : c.redeemed_at ? <span className="font-semibold text-emerald-700">Notaður</span> : c.emailed_at ? "Sendur" : "Ósendur"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c && !c.redeemed_at && <button onClick={() => revoke(c.id)} className="text-xs text-red-600">Ógilda</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {members.length > 8 && (
            <button onClick={() => setShowAll(!showAll)} className="w-full border-t border-slate-100 py-2 text-xs font-semibold text-slate-500">
              {showAll ? "Sýna færri" : `Sýna alla (${members.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
