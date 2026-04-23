"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Admin CSV bulk-create for Biody placeholder profiles. Attaches
// patients to the chosen company's Biody group and fills HR-gap
// fields (height, activity level, sometimes sex) with sensible
// defaults. Flags each client row with biody_placeholder_data so a
// later B2B onboarding sweep can collect the real data.

type Company = { id: string; name: string; status?: string | null; parent_company_id?: string | null };
type Row = {
  full_name: string;
  kennitala: string;
  email: string;
  phone: string;
  sex: "male" | "female" | "";
};
type ResultRow = {
  email: string;
  status: "created" | "updated" | "biody_existed" | "failed";
  biody_patient_id?: number | string | null;
  error?: string;
};
type Counts = { created: number; updated: number; biody_existed: number; failed: number };

const SAMPLE = `Jón Jónsson,0101901234,jon@example.is,+3548991234
Anna Björnsdóttir,0203852345,anna@example.is,+3548995678,female`;

function parseInput(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const parts = line.includes("\t") ? line.split("\t")
      : line.includes(";") ? line.split(";")
      : line.split(",");
    const [fullName, kennitala, email, phone, sexRaw] = parts.map((p) => (p || "").trim());
    const sex: Row["sex"] = sexRaw?.toLowerCase() === "female" || sexRaw?.toLowerCase() === "f" || sexRaw?.toLowerCase() === "kona" ? "female"
      : sexRaw?.toLowerCase() === "male" || sexRaw?.toLowerCase() === "m" || sexRaw?.toLowerCase() === "karl" ? "male"
      : "";
    return {
      full_name: fullName || "",
      kennitala: (kennitala || "").replace(/\D/g, ""),
      email: email || "",
      phone: phone || "",
      sex,
    };
  });
}

function rowErrors(r: Row): string | null {
  if (!r.full_name) return "Nafn vantar";
  if (!r.email) return "Netfang vantar";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) return "Ógilt netfang";
  if (r.kennitala.length !== 10) return "Kennitala verður að vera 10 tölustafir";
  const c = r.kennitala[9];
  if (c !== "0" && c !== "8" && c !== "9") return "Óþekktur aldamótastafur";
  return null;
}

export default function BiodyBulkCreatePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState<{ company_name: string; counts: Counts; results: ResultRow[] } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, status, parent_company_id")
        .neq("status", "archived")
        .order("name", { ascending: true });
      const all = (data as Company[]) || [];
      // Tree order: parents first (with 'aðalskrá' suffix if they have kids),
      // each followed by its children alphabetically. Sub rows are indented
      // with a leading '└ ' in the label so the dropdown reads as a tree.
      const parents = all.filter((c) => !c.parent_company_id);
      const childrenOf = new Map<string, Company[]>();
      for (const c of all) {
        if (c.parent_company_id) {
          const arr = childrenOf.get(c.parent_company_id) || [];
          arr.push(c);
          childrenOf.set(c.parent_company_id, arr);
        }
      }
      const ordered: Company[] = [];
      for (const p of parents) {
        ordered.push(p);
        const kids = childrenOf.get(p.id) || [];
        ordered.push(...kids);
      }
      const seen = new Set(ordered.map((c) => c.id));
      for (const c of all) if (!seen.has(c.id)) ordered.push(c);
      setCompanies(ordered);
    })();
  }, []);

  const rows = useMemo(() => parseInput(input), [input]);
  const valid = rows.filter((r) => !rowErrors(r));
  const invalid = rows.filter((r) => !!rowErrors(r));

  async function submit() {
    if (!companyId) { setErr("Veldu fyrirtæki."); return; }
    if (valid.length === 0) { setErr("Engar gildar línur í listanum."); return; }
    if (valid.length > 200) { setErr("Hámark er 200 í einu."); return; }
    if (!confirm(
      `Þetta mun stofna ${valid.length} Biody-sjúklinga undir völdu fyrirtæki með bráðabirgðagildum ` +
      `(hæð 170 cm, hreyfingarstig moderate, kyn karlkyn nema annað sé tilgreint). Halda áfram?`,
    )) return;
    setSubmitting(true);
    setErr("");
    setSummary(null);
    try {
      const res = await fetch("/api/admin/biody/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, invitees: valid }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(j?.detail || j?.error || "Stofnun mistókst.");
        return;
      }
      setSummary({ company_name: j.company_name, counts: j.counts, results: j.results });
    } catch (e) {
      setErr((e as Error).message || "Stofnun mistókst.");
    } finally {
      setSubmitting(false);
    }
  }

  function onCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const firstLine = text.split(/\r?\n/)[0].toLowerCase();
      const stripped = firstLine.includes("kennitala") || firstLine.includes("email") || firstLine.includes("netfang")
        ? text.split(/\r?\n/).slice(1).join("\n")
        : text;
      setInput(stripped.trim());
    };
    reader.readAsText(file);
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <div className="text-xs text-gray-500 mb-1">
          <Link href="/admin/clients" className="hover:underline">Viðskiptavinir</Link> · Biody fjölda-stofnun
        </div>
        <h1 className="text-2xl font-semibold text-[#1F2937]">Biody fjölda-stofnun (með bráðabirgðagildum)</h1>
        <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
          Stofnar Biody-sjúklinga fyrir hóp starfsmanna áður en fyrirtækið hefur farið í gegnum fulla B2B-skráningu.
          Sjúklingarnir eru tengdir Biody-hópnum sem er kenndur við fyrirtækið. Hæð / hreyfingarstig /
          (stundum) kyn eru fyllt með föstum gildum og verða uppfærð þegar starfsmenn klára venjulega skráningu.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Bráðabirgðagildi.</strong> Allir sjúklingar merktir með <span className="font-mono">biody_placeholder_data=true</span>.
          Mælingar á þessum sniðum eru marktækar en hlutföll geta skeikað lítillega (hæð 170 cm) þar til starfsmaður
          staðfestir raunveruleg gildi í gegnum <Link href="/account/onboard" className="underline">/account/onboard</Link>.
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">1. Veldu fyrirtæki</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Biody-sjúklingarnir verða tengdir sjúklingahópi þess fyrirtækis sem þú velur.
            Fyrir sveitarfélög með undireiningar — veldu nákvæmlega þá undireiningu sem starfsmennirnir tilheyra
            (t.d. <em>Grunnskóli Hafnarfjarðar</em>, ekki sveitarfélagið sjálft) svo mælingar aðskiljist rétt í Biody.
          </p>
        </div>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">Veldu fyrirtæki…</option>
          {companies.map((c) => {
            const hasChildren = companies.some((o) => o.parent_company_id === c.id);
            const isChild = !!c.parent_company_id;
            const statusSuffix = c.status === "draft" ? " (drög)"
              : c.status === "contact_invited" ? " (boð sent)"
              : "";
            const parentSuffix = hasChildren && !isChild ? " (aðalskrá)" : "";
            const prefix = isChild ? "\u00A0\u00A0└ " : ""; // indent children
            return <option key={c.id} value={c.id}>{prefix}{c.name}{parentSuffix}{statusSuffix}</option>;
          })}
        </select>
        {companyId && (() => {
          const picked = companies.find((c) => c.id === companyId);
          if (!picked) return null;
          const parent = picked.parent_company_id ? companies.find((c) => c.id === picked.parent_company_id) : null;
          const hasChildren = companies.some((o) => o.parent_company_id === picked.id);
          return (
            <div className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${parent ? "bg-emerald-50 border-emerald-100 text-emerald-900" : hasChildren ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-blue-50 border-blue-100 text-blue-900"}`}>
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div>Markmið: <strong>{picked.name}</strong>{parent ? <> · undir <strong>{parent.name}</strong></> : null}</div>
                {parent
                  ? <div className="mt-0.5 opacity-80">Sjúklingarnir lenda í Biody-hópi {picked.name} (aðskilið frá öðrum undireiningum). Reikningur gengur upp á {parent.name}.</div>
                  : hasChildren
                    ? <div className="mt-0.5 opacity-80">Þú ert að hlaða upp í móðurfyrirtækið sjálft. Eru þessir starfsmenn í miðlægri stjórnsýslu? Ef þeir tilheyra undireiningu, veldu hana í staðinn.</div>
                    : <div className="mt-0.5 opacity-80">Einfalt fyrirtæki án undireininga.</div>
                }
              </div>
            </div>
          );
        })()}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">2. Hlaða upp eða líma inn</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Dálkar: <span className="font-mono text-[11px]">Fullt nafn, Kennitala, Netfang, Sími, Kyn</span>.
            Kyn er valkvætt (sjálfgefið karlkyn — Íslensk kennitala kóðar ekki kyn).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            CSV-skrá
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsvFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() => setInput(SAMPLE)}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
          >
            Hlaða sýnidæmi
          </button>
          {input && (
            <button
              onClick={() => { setInput(""); setSummary(null); setErr(""); }}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              Hreinsa
            </button>
          )}
        </div>
        <textarea
          value={input}
          onChange={(e) => { setInput(e.target.value); setSummary(null); }}
          rows={8}
          placeholder={SAMPLE}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
          spellCheck={false}
        />
      </section>

      {rows.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">3. Forskoðun</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {valid.length} gild · {invalid.length} ógild.
              </p>
            </div>
            <button
              onClick={submit}
              disabled={submitting || valid.length === 0 || !companyId}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50"
            >
              {submitting ? "Stofnar…" : `Stofna ${valid.length} Biody-snið`}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Nafn</th>
                <th className="px-4 py-2 text-left">Kennitala</th>
                <th className="px-4 py-2 text-left">Netfang</th>
                <th className="px-4 py-2 text-left">Sími</th>
                <th className="px-4 py-2 text-left">Kyn</th>
                <th className="px-4 py-2 text-left">Staða</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => {
                const v = rowErrors(r);
                return (
                  <tr key={i} className={v ? "bg-red-50/40" : ""}>
                    <td className="px-4 py-2 text-gray-900">{r.full_name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 text-gray-600 font-mono text-[12px]">{r.kennitala || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 text-gray-700 font-mono text-[12px]">{r.email || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 text-gray-600">{r.phone || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 text-gray-600">{r.sex || <span className="text-gray-400">karl (sjálfg.)</span>}</td>
                    <td className="px-4 py-2">
                      {v
                        ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-100">{v}</span>
                        : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">Tilbúið</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {summary && (
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Niðurstaða — {summary.company_name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Allir stofnaðir sjúklingar eru flaggaðir sem bráðabirgðagildi.</p>
            </div>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">Stofnað {summary.counts.created}</span>
              <span className="px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-100">Uppfært {summary.counts.updated}</span>
              <span className="px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200">Þegar til {summary.counts.biody_existed}</span>
              <span className="px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-100">Mistókst {summary.counts.failed}</span>
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 leading-relaxed">
            <strong>Næsta skref.</strong> Þegar fyrirtækið er tilbúið að fara í gegnum fulla skráningu (samþykki + rétt
            kyn / hæð / hreyfingarstig), notaðu <em>Senda B2B-boð</em> fyrir þetta fyrirtæki. Þegar starfsmenn klára
            skráninguna verða bráðabirgðagildi yfirskrifuð með raungildum.
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Netfang</th>
                <th className="px-4 py-2 text-left">Staða</th>
                <th className="px-4 py-2 text-left">Biody ID</th>
                <th className="px-4 py-2 text-left">Villa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {summary.results.map((r, i) => {
                const label = r.status === "created" ? "Stofnað"
                  : r.status === "updated" ? "Uppfært"
                  : r.status === "biody_existed" ? "Þegar til í Biody"
                  : "Mistókst";
                const pill = r.status === "created" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : r.status === "updated" ? "bg-blue-50 text-blue-700 border-blue-100"
                  : r.status === "biody_existed" ? "bg-gray-50 text-gray-700 border-gray-200"
                  : "bg-red-50 text-red-700 border-red-100";
                return (
                  <tr key={i}>
                    <td className="px-4 py-2 text-gray-800 font-mono text-[12px]">{r.email}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pill}`}>{label}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 font-mono">{r.biody_patient_id ?? ""}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{r.error || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
