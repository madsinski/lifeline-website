"use client";

// Virkjunarkóðar — the Medalia code pool.
//
// Medalia generates 100% codes in batches (JSON); they are imported here and
// handed out one per paid order at checkout. This tab shows how many are
// left per package type, imports a new batch (which also gives codes to any
// orders that paid while the pool was empty), and voids an order's code on a
// refund — showing the code once, to send to Medalia for deactivation.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { adminJson, adminErrorText } from "../hc-api";
import { LOW_STOCK_HINT } from "./codes-shared";
import { CODE_POOL_KINDS, KIND_IS as SHOP_KIND_IS } from "@/lib/hc/shop";

interface Stock { kind: string; available: number; issued: number; void: number }
interface Recent { order_id: string | null; kinds: string[] | null; batch: string | null; status: string; issued_at: string | null; voided_at: string | null; void_reason: string | null }

/* Shared with the import endpoint, so the shop's products get pools too. */
const KIND_IS: Record<string, string> = { "*": "Allar tegundir", ...SHOP_KIND_IS };
const KINDS = CODE_POOL_KINDS;

const when = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 16).replace("T", " ") : "—");

export default function CodesTab() {
  const [data, setData] = useState<{ stock: Stock[]; waiting: number; recent: Recent[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"import" | "void" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; json: unknown } | null>(null);
  const [kinds, setKinds] = useState<string[]>(["health_check"]);
  const [batch, setBatch] = useState("");
  const [voidOrder, setVoidOrder] = useState("");
  const [voidReason, setVoidReason] = useState("Endurgreitt");
  const [voided, setVoided] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await adminJson<{ stock: Stock[]; waiting: number; recent: Recent[] }>("/api/admin/hc/activation-codes");
    setTimeout(() => { if (r.ok) { setData(r.data); setErr(null); } else setErr(adminErrorText(r.error, "Ekki tókst að sækja kóðana.")); }, 0);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pick = async (f: File | undefined) => {
    setMsg(null);
    if (!f) { setFile(null); return; }
    try { setFile({ name: f.name, json: JSON.parse(await f.text()) }); }
    catch { setFile(null); setMsg("Skráin er ekki gilt JSON."); }
  };

  const doImport = async () => {
    if (!file || busy) return;
    setBusy("import"); setMsg(null);
    const r = await adminJson<{ inserted: number; duplicates: number; invalid: number; assigned: number; still_waiting: number }>(
      "/api/admin/hc/activation-codes",
      { method: "POST", body: JSON.stringify({ action: "import", codes: file.json, kinds, batch: batch || file.name }) },
    );
    setBusy(null);
    if (!r.ok) { setMsg(adminErrorText(r.error, "Innflutningur mistókst.")); return; }
    const d = r.data;
    setMsg(`${d.inserted} kóðar fluttir inn${d.duplicates ? `, ${d.duplicates} voru þegar til` : ""}${d.invalid ? `, ${d.invalid} ógildir slepptir` : ""}.`
      + (d.assigned ? ` ${d.assigned} pantanir sem biðu fengu kóða.` : ""));
    setFile(null); setBatch("");
    void load();
  };

  const doVoid = async () => {
    if (!voidOrder.trim() || busy) return;
    if (!window.confirm("Ógilda kóða þessarar pöntunar? Ekki er hægt að afturkalla það.")) return;
    setBusy("void"); setMsg(null); setVoided(null);
    const r = await adminJson<{ code: string }>("/api/admin/hc/activation-codes",
      { method: "POST", body: JSON.stringify({ action: "void", order_id: voidOrder.trim(), reason: voidReason }) });
    setBusy(null);
    if (!r.ok) { setMsg(adminErrorText(r.error, "Tókst ekki.")); return; }
    setVoided(r.data.code); setVoidOrder("");
    void load();
  };

  if (err) return <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>;
  if (!data) return <div className="h-32 animate-pulse rounded-2xl bg-white" aria-busy="true" />;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-bold text-slate-900">Birgðir</h2>
        <p className="mt-1 text-sm text-slate-600">{LOW_STOCK_HINT}</p>
        {data.waiting > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
            {data.waiting} greiddar pantanir bíða eftir kóða — flytjið inn nýja lotu.
          </p>
        )}
        {data.stock.length ? (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Tegund</th><th>Lausir</th><th>Útgefnir</th><th>Ógiltir</th></tr></thead>
            <tbody>
              {data.stock.map((s) => (
                <tr key={s.kind} className="border-t border-slate-100">
                  <td className="py-2 font-semibold">{KIND_IS[s.kind] ?? s.kind}</td>
                  <td className={s.available < 100 ? "font-bold text-red-700" : ""}>{s.available}</td>
                  <td>{s.issued}</td><td>{s.void}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="mt-3 text-sm text-slate-600">Engir kóðar enn. Flytjið inn fyrstu lotuna frá Medalia hér að neðan.</p>}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-bold text-slate-900">Flytja inn lotu frá Medalia</h2>
        <p className="mt-1 text-sm text-slate-600">JSON-skrá: listi af kóðum (<code>[&quot;ABC123&quot;, …]</code>) eða af hlutum með <code>code</code>-svæði. Sami kóði er aldrei fluttur inn tvisvar.</p>
        <div className="mt-3 space-y-3">
          <input type="file" accept="application/json,.json" onChange={(e) => void pick(e.target.files?.[0])}
            className="block text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:font-semibold" />
          <fieldset>
            <legend className="text-xs font-semibold text-slate-600">Gildir fyrir (ekkert valið = allar tegundir)</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {KINDS.map((k) => (
                <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[#047857]" checked={kinds.includes(k)}
                    onChange={(e) => setKinds((v) => e.target.checked ? [...v, k] : v.filter((x) => x !== k))} />
                  {KIND_IS[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm">
            <span className="text-xs font-semibold text-slate-600">Heiti lotu (valfrjálst)</span>
            <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder={file?.name ?? "t.d. Medalia okt 2026"}
              className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3" />
          </label>
          <button type="button" disabled={!file || busy !== null} onClick={() => void doImport()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#047857] px-5 font-semibold text-white disabled:opacity-40">
            {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            Flytja inn
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-bold text-slate-900">Ógilda kóða (endurgreiðsla)</h2>
        <p className="mt-1 text-sm text-slate-600">Kóðinn birtist einu sinni eftir ógildingu. Sendið hann Medalia svo hann verði gerður óvirkur.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={voidOrder} onChange={(e) => setVoidOrder(e.target.value)} placeholder="Auðkenni pöntunar (order id)" aria-label="Auðkenni pöntunar"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm" />
          <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} aria-label="Ástæða"
            className="min-h-11 w-40 rounded-xl border border-slate-300 px-3 text-sm" />
          <button type="button" disabled={!voidOrder.trim() || busy !== null} onClick={() => void doVoid()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300 px-4 font-semibold text-red-800 disabled:opacity-40">
            {busy === "void" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Ógilda
          </button>
        </div>
        {voided && <p className="mt-3 rounded-xl bg-slate-100 px-4 py-3 font-mono text-sm">Ógiltur kóði til Medalia: <strong>{voided}</strong></p>}
      </section>

      {msg && <p role="status" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">{msg}</p>}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-bold text-slate-900">Síðustu útgefnu kóðar</h2>
        {data.recent.length ? (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Pöntun</th><th>Staða</th><th>Útgefinn</th><th>Lota</th></tr></thead>
            <tbody>
              {data.recent.map((r, i) => (
                <tr key={`${r.order_id}-${i}`} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs">{r.order_id ?? "—"}</td>
                  <td>{r.status === "void" ? `Ógiltur (${r.void_reason || "—"})` : "Útgefinn"}</td>
                  <td>{when(r.issued_at)}</td><td>{r.batch ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="mt-3 text-sm text-slate-600">Engir kóðar hafa verið gefnir út enn.</p>}
      </section>
    </div>
  );
}
