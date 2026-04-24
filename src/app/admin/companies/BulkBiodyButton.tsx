"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// Scoped version of /admin/biody/bulk-create — a modal on the companies
// tab that is pre-bound to the row's company. Same parse + validate +
// submit flow; company selector is replaced with a locked banner so
// the admin can't accidentally attach patients to the wrong entity.

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
    const sx = (sexRaw || "").toLowerCase();
    const sex: Row["sex"] =
      sx === "female" || sx === "f" || sx === "kona" ? "female"
      : sx === "male" || sx === "m" || sx === "karl" ? "male"
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

export default function BulkBiodyButton({
  companyId,
  companyName,
  parentName,
  hasChildren,
}: {
  companyId: string;
  companyName: string;
  parentName?: string | null;
  hasChildren?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState<{ counts: Counts; results: ResultRow[] } | null>(null);

  const rows = useMemo(() => parseInput(input), [input]);
  const valid = rows.filter((r) => !rowErrors(r));
  const invalid = rows.filter((r) => !!rowErrors(r));

  const reset = () => { setInput(""); setErr(""); setSummary(null); };

  async function submit() {
    if (valid.length === 0) { setErr("Engar gildar línur í listanum."); return; }
    if (valid.length > 200) { setErr("Hámark er 200 í einu."); return; }
    if (!confirm(
      `Þetta mun stofna ${valid.length} Biody-sjúklinga undir ${companyName} með bráðabirgðagildum ` +
      `(hæð 170 cm, hreyfingarstig moderate, kyn karlkyn nema annað sé tilgreint). Halda áfram?`,
    )) return;
    setSubmitting(true);
    setErr("");
    setSummary(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/admin/biody/bulk-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ company_id: companyId, invitees: valid }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(j?.detail || j?.error || "Stofnun mistókst.");
        return;
      }
      setSummary({ counts: j.counts, results: j.results });
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
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
        title="Hlaða upp lista af starfsmönnum og stofna Biody-snið með bráðabirgðagildum"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Biody fjölda-stofnun
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => { setOpen(false); reset(); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Biody fjölda-stofnun</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Stofnar Biody-sjúklinga fyrir hóp starfsmanna með bráðabirgðagildum (hæð 170 cm, hreyfingarstig moderate, kyn karlkyn sjálfgefið).
                </p>
              </div>
              <button onClick={() => { setOpen(false); reset(); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Target banner — replaces the company dropdown */}
              <div className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${parentName ? "bg-emerald-50 border-emerald-100 text-emerald-900" : hasChildren ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-blue-50 border-blue-100 text-blue-900"}`}>
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="min-w-0">
                  <div>Markmið: <strong>{companyName}</strong>{parentName ? <> · undir <strong>{parentName}</strong></> : null}</div>
                  {parentName
                    ? <div className="mt-0.5 opacity-80">Sjúklingarnir lenda í Biody-hópi {companyName} (aðskilið frá öðrum undireiningum). Reikningur gengur upp á {parentName}.</div>
                    : hasChildren
                      ? <div className="mt-0.5 opacity-80">Þetta er móðurfyrirtækið sjálft. Ef þessir starfsmenn tilheyra undireiningu, opnaðu hana í staðinn og keyrðu þaðan.</div>
                      : <div className="mt-0.5 opacity-80">Einfalt fyrirtæki án undireininga.</div>
                  }
                </div>
              </div>

              {/* Placeholder warning */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Bráðabirgðagildi.</strong> Sjúklingarnir eru merktir með <span className="font-mono">biody_placeholder_data=true</span>.
                Mælingar á þessum sniðum eru marktækar en hlutföll geta skeikað (hæð 170 cm) þar til starfsmaður staðfestir raunveruleg gildi.
              </div>

              {/* Paste / upload */}
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Hlaða upp eða líma inn</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Dálkar: <span className="font-mono">Fullt nafn, Kennitala, Netfang, Sími, Kyn</span>. Kyn valkvætt.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 4v12m0 0l-4-4m4 4l4-4" />
                      </svg>
                      CSV
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
                      className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                    >
                      Sýnidæmi
                    </button>
                    {input && (
                      <button
                        onClick={reset}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      >
                        Hreinsa
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setSummary(null); }}
                  rows={7}
                  placeholder={SAMPLE}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                  spellCheck={false}
                />
              </div>

              {/* Preview */}
              {rows.length > 0 && !summary && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700">
                      Forskoðun · <span className="text-emerald-700">{valid.length} gild</span> · <span className="text-red-700">{invalid.length} ógild</span>
                    </p>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5 text-left">Nafn</th>
                          <th className="px-3 py-1.5 text-left">Kennitala</th>
                          <th className="px-3 py-1.5 text-left">Netfang</th>
                          <th className="px-3 py-1.5 text-left">Staða</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((r, i) => {
                          const v = rowErrors(r);
                          return (
                            <tr key={i} className={v ? "bg-red-50/40" : ""}>
                              <td className="px-3 py-1.5 text-gray-900 truncate max-w-[160px]">{r.full_name || <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-1.5 text-gray-600 font-mono text-[11px]">{r.kennitala || <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-1.5 text-gray-700 font-mono text-[11px] truncate max-w-[180px]">{r.email || <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-1.5">
                                {v
                                  ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-100">{v}</span>
                                  : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">Tilbúið</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

              {/* Result */}
              {summary && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm font-semibold text-gray-900">Niðurstaða — {companyName}</p>
                    <div className="flex items-center gap-1.5 text-xs flex-wrap">
                      <span className="px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">Stofnað {summary.counts.created}</span>
                      <span className="px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-100">Uppfært {summary.counts.updated}</span>
                      <span className="px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200">Þegar til {summary.counts.biody_existed}</span>
                      <span className="px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-100">Mistókst {summary.counts.failed}</span>
                    </div>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5 text-left">Netfang</th>
                          <th className="px-3 py-1.5 text-left">Staða</th>
                          <th className="px-3 py-1.5 text-left">Biody ID</th>
                          <th className="px-3 py-1.5 text-left">Villa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.results.map((r, i) => {
                          const label = r.status === "created" ? "Stofnað"
                            : r.status === "updated" ? "Uppfært"
                            : r.status === "biody_existed" ? "Þegar til"
                            : "Mistókst";
                          const pill = r.status === "created" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : r.status === "updated" ? "bg-blue-50 text-blue-700 border-blue-100"
                            : r.status === "biody_existed" ? "bg-gray-50 text-gray-700 border-gray-200"
                            : "bg-red-50 text-red-700 border-red-100";
                          return (
                            <tr key={i}>
                              <td className="px-3 py-1.5 text-gray-800 font-mono text-[11px] truncate max-w-[180px]">{r.email}</td>
                              <td className="px-3 py-1.5">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${pill}`}>{label}</span>
                              </td>
                              <td className="px-3 py-1.5 text-[11px] text-gray-600 font-mono">{r.biody_patient_id ?? ""}</td>
                              <td className="px-3 py-1.5 text-[11px] text-gray-600">{r.error || ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              {summary ? (
                <>
                  <button
                    onClick={reset}
                    className="text-xs font-medium px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-50"
                  >
                    Stofna fleiri
                  </button>
                  <button
                    onClick={() => { setOpen(false); reset(); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-800 text-white hover:bg-gray-900"
                  >
                    Loka
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setOpen(false); reset(); }}
                    className="text-xs font-medium px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-50"
                  >
                    Hætta við
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting || valid.length === 0}
                    className="text-xs font-semibold px-3 py-1.5 rounded-md text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50"
                  >
                    {submitting ? "Stofnar…" : `Stofna ${valid.length || 0} Biody-snið`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
