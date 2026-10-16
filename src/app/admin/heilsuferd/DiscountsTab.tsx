"use client";

// Making and managing discount codes.
//
// The validating, redeeming and price-reducing all shipped with the
// subscription work; this is the part that was missing, which meant the
// feature existed and could not be used. A code could only have been made
// by hand in SQL.
//
// Codes are never edited in place beyond their value, dates and note — the
// code itself is the primary key and somebody has it in an inbox, so it has
// to keep meaning what it meant. To change what a code is, turn it off and
// make another.

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { adminJson, adminErrorText } from "../hc-api";
import { useToast } from "@/app/components/hc/Toast";

interface Code {
  code: string;
  kind: "percent" | "amount" | "free_months";
  value: number;
  applies_to: "subscription" | "health_check" | "both";
  max_uses: number | null;
  max_per_client: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
  redemptions: number;
  last_used_at: string | null;
  usable: boolean;
}

const KIND_IS: Record<Code["kind"], string> = {
  percent: "Prósenta", amount: "Krónur af", free_months: "Fríir mánuðir",
};
const APPLIES_IS: Record<Code["applies_to"], string> = {
  subscription: "Áskrift", health_check: "Heilsufarsskoðun", both: "Bæði",
};

const worth = (c: Pick<Code, "kind" | "value">) =>
  c.kind === "percent" ? `${c.value}%`
    : c.kind === "amount" ? `${Math.round(c.value).toLocaleString("is-IS")} kr.`
    : `${c.value} ${c.value === 1 ? "mánuður" : "mánuðir"}`;

const day = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("is-IS", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function DiscountsTab() {
  const toast = useToast();
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    code: "", kind: "percent" as Code["kind"], value: "20",
    applies_to: "subscription" as Code["applies_to"],
    max_uses: "", max_per_client: "1", expires_at: "", note: "",
  });

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await adminJson<{ codes: Code[] }>("/api/admin/hc/discounts");
    setTimeout(() => {
      // A failed load is not "no codes": keep what is shown and say so.
      if (r.ok) { setCodes(r.data.codes ?? []); setLoadErr(null); }
      else { setLoadErr(adminErrorText(r.error, "Ekki tókst að sækja afsláttarkóða.")); setCodes((c) => c ?? []); }
    }, 0);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy("new"); setErr(null);
    const r = await adminJson<{ ok?: boolean; error?: string }>("/api/admin/hc/discounts", {
      method: "POST",
      body: JSON.stringify({
        code: f.code, kind: f.kind, value: Number(f.value), applies_to: f.applies_to,
        max_uses: f.max_uses ? Number(f.max_uses) : null,
        max_per_client: Number(f.max_per_client) || 1,
        expires_at: f.expires_at || null,
        note: f.note,
      }),
    });
    const j = r.data ?? {};
    setBusy(null);
    if (!r.ok) {
      setErr(
        j.error === "exists" ? "Þessi kóði er til þegar."
          : j.error === "bad_code" ? "Kóði: 3–24 stafir eða tölur."
          : j.error === "bad_percent" ? "Prósenta má ekki vera yfir 100."
          : j.error === "bad_months" ? "Fríir mánuðir verða að vera heil tala."
          : j.error === "months_need_subscription" ? "Fríir mánuðir gilda aðeins um áskrift."
          : adminErrorText(j.error === "bad_request" ? null : j.error, "Kóðinn varð ekki til. Athugaðu gildin."),
      );
      return;
    }
    setAdding(false);
    setF({ ...f, code: "", note: "" });
    await load();
  };

  const patch = async (code: string, change: Record<string, unknown>) => {
    setBusy(code);
    const r = await adminJson("/api/admin/hc/discounts", { method: "PATCH", body: JSON.stringify({ code, ...change }) });
    setBusy(null);
    if (!r.ok) toast.show(`Kóðanum ${code} var ekki breytt: ${adminErrorText(r.error)}`, { tone: "bad" });
    await load();
  };

  if (codes === null) return <div className="h-32 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />;

  return (
    <div className="space-y-4">
      {loadErr && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadErr} <button onClick={() => void load()} className="font-semibold underline">Reyna aftur</button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Afsláttarkóðar</h2>
          <p className="text-sm text-slate-600">
            {codes.length === 0
              ? "Enginn kóði til. Kóði sem er búinn til hér virkar strax í greiðsluferlinu."
              : `${codes.length} ${codes.length === 1 ? "kóði" : "kóðar"} · ${codes.filter((c) => c.usable).length} virkir núna`}
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => { setAdding(true); setErr(null); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981] px-4 py-2 text-sm font-semibold text-white hover:bg-[#047857]">
            <Plus className="h-4 w-4" aria-hidden /> Nýr kóði
          </button>
        )}
      </div>

      {adding && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Kóði</span>
              <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
                placeholder="HAUST2026" maxLength={24}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase text-slate-900" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Tegund</span>
              <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Code["kind"] })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900">
                {(Object.keys(KIND_IS) as Code["kind"][]).map((k) => <option key={k} value={k}>{KIND_IS[k]}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                {f.kind === "percent" ? "Prósenta" : f.kind === "amount" ? "Krónur" : "Mánuðir"}
              </span>
              <input type="number" min={1} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Gildir um</span>
              <select value={f.applies_to} onChange={(e) => setF({ ...f, applies_to: e.target.value as Code["applies_to"] })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900">
                {(Object.keys(APPLIES_IS) as Code["applies_to"][]).map((k) => <option key={k} value={k}>{APPLIES_IS[k]}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Hámark notkunar</span>
              <input type="number" min={1} value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })}
                placeholder="ótakmarkað"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Gildir til</span>
              <input type="date" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Til hvers er hann? <span className="font-normal text-slate-500">(fyrir þann sem finnur hann seinna)</span></span>
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })}
              placeholder="T.d. haustkynning á Facebook"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void create()} disabled={!f.code || busy === "new"}
              className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy === "new" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Búa til
            </button>
            <button type="button" onClick={() => { setAdding(false); setErr(null); }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Hætta við</button>
          </div>
        </div>
      )}

      {codes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-3">Kóði</th><th className="p-3">Virði</th><th className="p-3">Gildir um</th>
                <th className="p-3">Notkun</th><th className="p-3">Gildir til</th><th className="p-3">Staða</th><th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {codes.map((c) => (
                <tr key={c.code} className={c.usable ? "" : "bg-slate-50/60 text-slate-500"}>
                  <td className="p-3">
                    <span className="font-mono font-bold text-slate-900">{c.code}</span>
                    {c.note && <span className="mt-0.5 block text-xs text-slate-500">{c.note}</span>}
                  </td>
                  <td className="p-3 font-semibold">{worth(c)}</td>
                  <td className="p-3">{APPLIES_IS[c.applies_to]}</td>
                  <td className="p-3 tabular-nums">
                    {c.redemptions}{c.max_uses != null ? ` / ${c.max_uses}` : ""}
                    {c.last_used_at && <span className="mt-0.5 block text-xs text-slate-500">síðast {day(c.last_used_at)}</span>}
                  </td>
                  <td className="p-3">{day(c.expires_at)}</td>
                  <td className="p-3">
                    {/* "Usable now", not just the active flag: a code can be
                        switched on and still be expired or used up, and the
                        person about to paste it into an email needs the real
                        answer. */}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                      c.usable ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                      {c.usable ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
                      {c.usable ? "Virkur" : !c.active ? "Af" : c.expires_at && c.expires_at < new Date().toISOString() ? "Útrunninn" : "Fullnotaður"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => void patch(c.code, { active: !c.active })}
                      disabled={busy === c.code}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                      {busy === c.code ? "…" : c.active ? "Slá af" : "Slá á"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
