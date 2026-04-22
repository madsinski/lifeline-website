"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// Admin CSV / paste bulk invite for personal clients. The parsed rows
// are previewed with per-row validation status before the admin fires
// the request. No company context — these people get B2C accounts and
// a Velkomin-email in Icelandic linking to /account/onboard.

type Row = {
  full_name: string;
  email: string;
  phone: string;
  kennitala: string;
  sex: "male" | "female" | "";
};

type ResultRow = {
  email: string;
  status: "invited" | "resent" | "skipped_already_completed" | "failed";
  error?: string;
};

type Counts = {
  invited: number;
  resent: number;
  skipped_already_completed: number;
  failed: number;
};

const SAMPLE = `Jón Jónsson,jon@example.is,+3548991234,0101901234,male
Anna Björnsdóttir,anna@example.is,+3548995678,,female`;

function parseInput(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    // Tab, comma or semicolon delimited. Tab first so names with commas work when pasted from Excel.
    const parts = line.includes("\t") ? line.split("\t")
      : line.includes(";") ? line.split(";")
      : line.split(",");
    const [fullName, email, phone, kennitala, sexRaw] = parts.map((p) => (p || "").trim());
    const sex: Row["sex"] = sexRaw?.toLowerCase() === "male" || sexRaw?.toLowerCase() === "m" || sexRaw?.toLowerCase() === "karl" ? "male"
      : sexRaw?.toLowerCase() === "female" || sexRaw?.toLowerCase() === "f" || sexRaw?.toLowerCase() === "kona" ? "female"
      : "";
    return {
      full_name: fullName || "",
      email: email || "",
      phone: phone || "",
      kennitala: kennitala || "",
      sex,
    };
  });
}

function validateRow(r: Row): string | null {
  if (!r.email) return "Netfang vantar";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) return "Ógilt netfang";
  return null;
}

export default function AdminBulkInvitePage() {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<{ counts: Counts; results: ResultRow[] } | null>(null);
  const [err, setErr] = useState("");

  const rows = useMemo(() => parseInput(input), [input]);
  const valid = rows.filter((r) => !validateRow(r));
  const invalid = rows.filter((r) => !!validateRow(r));

  async function submit() {
    if (valid.length === 0) { setErr("Engin gild netföng í listanum."); return; }
    if (valid.length > 200) { setErr("Hámark er 200 í einu."); return; }
    setSubmitting(true);
    setErr("");
    setSummary(null);
    try {
      const res = await fetch("/api/admin/clients/bulk-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitees: valid }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setErr(j?.detail || j?.error || "Sending mistókst.");
        return;
      }
      setSummary({ counts: j.counts, results: j.results });
    } catch (e) {
      setErr((e as Error).message || "Sending mistókst.");
    } finally {
      setSubmitting(false);
    }
  }

  function onCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      // Strip a header row if the first line looks like headers
      const firstLine = text.split(/\r?\n/)[0].toLowerCase();
      const stripped = firstLine.includes("email") || firstLine.includes("netfang")
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
          <Link href="/admin/clients" className="hover:underline">Viðskiptavinir</Link> · Fjölda-boð
        </div>
        <h1 className="text-2xl font-semibold text-[#1F2937]">Fjölda-boð fyrir einkaaðganga</h1>
        <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
          Stofnar aðganga fyrir einstaklinga og sendir þeim íslenskan velkomin-póst með hlekk til að klára skráninguna. Engin tengsl við fyrirtækjaaðgang — þetta eru B2C-aðgangar.
          Biody-prófíll er ekki stofnaður hér — hann verður virkjaður þegar viðtakandinn klárar skráningu sína og skráir kyn / hæð / hreyfingarstig.
        </p>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">1. Hlaða upp eða líma inn</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Dálkar: <span className="font-mono text-[11px]">Fullt nafn, Netfang, Sími, Kennitala, Kyn</span>.
            Sími, kennitala og kyn eru valkvæð.
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
          placeholder={`Jón Jónsson,jon@example.is,+3548991234,0101901234,male\nAnna Björnsdóttir,anna@example.is,+3548995678,,female`}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
          spellCheck={false}
        />
      </section>

      {rows.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">2. Forskoðun</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {valid.length} gild · {invalid.length} óg gild. Þú sendir aðeins gild netföng.
              </p>
            </div>
            <button
              onClick={submit}
              disabled={submitting || valid.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-emerald-500 disabled:opacity-50"
            >
              {submitting ? "Sendi…" : `Senda boð til ${valid.length}`}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Nafn</th>
                <th className="px-4 py-2 text-left">Netfang</th>
                <th className="px-4 py-2 text-left">Sími</th>
                <th className="px-4 py-2 text-left">Kennitala</th>
                <th className="px-4 py-2 text-left">Kyn</th>
                <th className="px-4 py-2 text-left">Staða</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => {
                const v = validateRow(r);
                return (
                  <tr key={i} className={v ? "bg-red-50/40" : ""}>
                    <td className="px-4 py-2 text-gray-900">{r.full_name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 text-gray-700 font-mono text-[12px]">{r.email || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 text-gray-600">{r.phone || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 text-gray-600 font-mono text-[12px]">{r.kennitala || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2 text-gray-600">{r.sex || <span className="text-gray-400">—</span>}</td>
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

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      {summary && (
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Niðurstaða</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">Send {summary.counts.invited}</span>
              <span className="px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-100">Endursend {summary.counts.resent}</span>
              <span className="px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200">Sleppt {summary.counts.skipped_already_completed}</span>
              <span className="px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-100">Mistókst {summary.counts.failed}</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Netfang</th>
                <th className="px-4 py-2 text-left">Staða</th>
                <th className="px-4 py-2 text-left">Villa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {summary.results.map((r, i) => {
                const label = r.status === "invited" ? "Send"
                  : r.status === "resent" ? "Endursend"
                  : r.status === "skipped_already_completed" ? "Sleppt — þegar kláraður"
                  : "Mistókst";
                const pill = r.status === "invited" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : r.status === "resent" ? "bg-blue-50 text-blue-700 border-blue-100"
                  : r.status === "skipped_already_completed" ? "bg-gray-50 text-gray-700 border-gray-200"
                  : "bg-red-50 text-red-700 border-red-100";
                return (
                  <tr key={i}>
                    <td className="px-4 py-2 text-gray-800 font-mono text-[12px]">{r.email}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pill}`}>{label}</span>
                    </td>
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
