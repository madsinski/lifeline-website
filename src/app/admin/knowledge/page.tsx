"use client";

// Uppflettirit — the reference book the nurses search in /vinnustod ("Fletta
// upp"). One row per topic: the one-line answer, the value bands, and the
// longer explanation. Everything here is visible to workstation staff, so it
// is written as guidance we stand behind — never a diagnosis.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useStaffGuard } from "@/lib/useStaffGuard";
import AdminTabs from "../components/AdminTabs";
import { adminJson } from "../hc-api";
import { CATEGORY_IS, TONE_IS, type KnowledgeBand, type KnowledgeCategory, type KnowledgeEntry } from "@/lib/hc/knowledge";

type Row = KnowledgeEntry & { active: boolean; updated_at?: string; updated_by?: string | null };

const CATS = Object.keys(CATEGORY_IS) as KnowledgeCategory[];
const TONES = Object.keys(TONE_IS) as KnowledgeBand["tone"][];
const input = "w-full rounded-lg border border-slate-300 px-2 py-2 text-sm";

export default function KnowledgeAdmin() {
  const { authorized, loading } = useStaffGuard();
  const [rows, setRows] = useState<Row[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await adminJson<{ rows: Row[] }>("/api/admin/hc/knowledge");
    if (r.ok) setRows(r.data.rows);
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  if (loading) return <div className="p-8 text-slate-500">Hleð…</div>;
  if (!authorized) return <div className="p-8 text-slate-500">Aðgangur ekki leyfður.</div>;

  const shown = rows.filter((r) => cat === "all" || r.category === cat);
  const bands = edit?.bands ?? [];
  const setBands = (b: KnowledgeBand[]) => setEdit({ ...edit!, bands: b });

  const save = async () => {
    const r = await adminJson<{ row: Row }>("/api/admin/hc/knowledge", { method: "POST", body: JSON.stringify(edit) });
    setMsg(r.ok ? "Vistað" : r.error || "Villa");
    if (r.ok) await load();
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/admin/coach" className="text-sm text-slate-500 hover:text-slate-800">← Coach</Link>
        <h1 className="mt-1 text-2xl font-bold text-[#0F172A]">Uppflettirit</h1>
        <p className="text-sm text-slate-500">
          Það sem hjúkrunarfræðingar fletta upp í vinnustöðinni: viðmiðunargildi, ráðleggingar og aðferðafræði Lifeline.
          Skrifað sem leiðbeiningar — ekki greining eða meðferð.
        </p>
      </div>

      <AdminTabs
        tabs={[{ key: "all", label: "Allt" }, ...CATS.map((c) => ({ key: c, label: CATEGORY_IS[c] }))]}
        active={cat} onChange={setCat}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {shown.map((r) => (
            <button key={r.slug} onClick={() => { setEdit(r); setMsg(""); }}
              className={`w-full rounded-xl border bg-white p-3 text-left ${r.active ? "" : "opacity-40"} ${edit?.slug === r.slug ? "border-[#10B981]" : "border-slate-200"}`}>
              <p className="font-semibold text-slate-900">{r.title}</p>
              <p className="line-clamp-1 text-xs text-slate-500">{r.summary}</p>
            </button>
          ))}
          <button onClick={() => { setEdit({ category: "method", bands: [], aliases: [], tags: [], sources: [], sort: 100, active: true }); setMsg(""); }}
            className="w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500">+ Ný færsla</button>
        </div>

        {edit && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-4">
              <input value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Heiti" className={`${input} font-semibold sm:col-span-2`} />
              <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as KnowledgeCategory })} className={input}>
                {CATS.map((c) => <option key={c} value={c}>{CATEGORY_IS[c]}</option>)}
              </select>
              <input value={edit.unit ?? ""} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="Eining (t.d. mmol/L)" className={input} />
              <input value={(edit.aliases ?? []).join(", ")} onChange={(e) => setEdit({ ...edit, aliases: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
                placeholder="Leitarorð, aðskilin með kommu (líka ensk)" className={`${input} sm:col-span-4`} />
              <textarea value={edit.summary ?? ""} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} rows={2}
                placeholder="Stutta svarið — ein til tvær setningar" className={`${input} sm:col-span-4`} />
              <textarea value={edit.body_md ?? ""} onChange={(e) => setEdit({ ...edit, body_md: e.target.value })} rows={8}
                placeholder="Nánar: hvað mælingin segir, hvað hefur áhrif, hvað á að ráðleggja. Tóm lína byrjar nýja málsgrein, **feitletrað** virkar."
                className={`${input} sm:col-span-4`} />
            </div>

            <div>
              <p className="mb-1 font-semibold text-slate-700">Viðmiðunarbil</p>
              <p className="mb-2 text-xs text-slate-500">Frá og með lægra gildinu, upp að því hærra. Skildu eftir autt fyrir opið bil. Kyn aðeins ef viðmiðin eru ólík.</p>
              <div className="space-y-1.5">
                {bands.map((b, i) => {
                  const set = (patch: Partial<KnowledgeBand>) => setBands(bands.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <div key={i} className="grid grid-cols-[1fr_90px_90px_110px_100px_auto] gap-1.5">
                      <input value={b.label} onChange={(e) => set({ label: e.target.value })} placeholder="Heiti bils" className="rounded border border-slate-200 px-2 py-1" />
                      <input value={b.min ?? ""} onChange={(e) => set({ min: e.target.value === "" ? null : Number(e.target.value) })} placeholder="frá" className="rounded border border-slate-200 px-2 py-1" />
                      <input value={b.max ?? ""} onChange={(e) => set({ max: e.target.value === "" ? null : Number(e.target.value) })} placeholder="að" className="rounded border border-slate-200 px-2 py-1" />
                      <select value={b.tone} onChange={(e) => set({ tone: e.target.value as KnowledgeBand["tone"] })} className="rounded border border-slate-200 px-1 py-1">
                        {TONES.map((t) => <option key={t} value={t}>{TONE_IS[t]}</option>)}
                      </select>
                      <select value={b.sex ?? ""} onChange={(e) => set({ sex: (e.target.value || null) as KnowledgeBand["sex"] })} className="rounded border border-slate-200 px-1 py-1">
                        <option value="">Bæði kyn</option><option value="m">Karlar</option><option value="f">Konur</option>
                      </select>
                      <button onClick={() => setBands(bands.filter((_, j) => j !== i))} className="px-1 text-red-500" aria-label="Eyða bili">×</button>
                      <input value={b.note ?? ""} onChange={(e) => set({ note: e.target.value })} placeholder="Athugasemd (valfrjálst)" className="col-span-6 rounded border border-slate-200 px-2 py-1 text-xs" />
                    </div>
                  );
                })}
                <button onClick={() => setBands([...bands, { label: "", tone: "good", min: null, max: null, sex: null, note: null }])} className="text-xs font-semibold text-emerald-700">+ Bil</button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <input value={(edit.tags ?? []).join(", ")} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Merki" className={input} />
              <input value={(edit.sources ?? []).join(", ")} onChange={(e) => setEdit({ ...edit, sources: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Heimildir" className={input} />
              <input type="number" value={edit.sort ?? 100} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} placeholder="Röð" className={input} />
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
              <button onClick={save} className="rounded-lg bg-[#10B981] px-4 py-2 font-semibold text-white">Vista</button>
              {edit.slug && edit.active !== false && (
                <button onClick={async () => {
                  if (!confirm("Taka færsluna úr notkun?")) return;
                  await adminJson(`/api/admin/hc/knowledge?slug=${encodeURIComponent(edit.slug!)}`, { method: "DELETE" });
                  setEdit(null); await load();
                }} className="text-red-600">Taka úr notkun</button>
              )}
              {edit.slug && edit.active === false && (
                <button onClick={() => setEdit({ ...edit, active: true })} className="text-emerald-700">Virkja aftur</button>
              )}
              <span className="text-xs text-slate-500">{msg}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
