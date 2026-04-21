"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "commercial" | "platform";

interface AgreementRow {
  id: string;
  company_id: string;
  agreement_version: string;
  signatory_name: string;
  signatory_role: string;
  signatory_email: string;
  signatory_ip: string | null;
  signed_at: string;
  terms_hash: string;
  pdf_storage_path: string | null;
  pdf_sha256: string | null;
  company_name: string;
  po_number: string | null;
  total_isk: number | null;
  currency: string | null;
}

interface PlatformAcceptanceRow {
  id: string;
  user_id: string;
  document_key: string;
  document_version: string;
  text_hash: string;
  ip: string | null;
  user_agent: string | null;
  accepted_at: string;
  user_email: string | null;
}

export default function AdminLegalPage() {
  const [tab, setTab] = useState<Tab>("commercial");
  const [rows, setRows] = useState<AgreementRow[]>([]);
  const [platformRows, setPlatformRows] = useState<PlatformAcceptanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Pull agreements, companies, POs, and platform acceptances in parallel.
    const [{ data: agreements, error: aErr }, { data: companies }, { data: pos }, { data: platformAcc }] = await Promise.all([
      supabase
        .from("b2b_agreements")
        .select("id, company_id, agreement_version, signatory_name, signatory_role, signatory_email, signatory_ip, signed_at, terms_hash, pdf_storage_path, pdf_sha256")
        .order("signed_at", { ascending: false }),
      supabase.from("companies").select("id, name"),
      supabase.from("b2b_purchase_orders").select("agreement_id, po_number, total_isk, currency"),
      supabase
        .from("platform_agreement_acceptances")
        .select("id, user_id, document_key, document_version, text_hash, ip, user_agent, accepted_at")
        .order("accepted_at", { ascending: false }),
    ]);

    // Resolve user emails for platform acceptances via clients table (best effort)
    const platformUserIds = Array.from(new Set((platformAcc ?? []).map((r: { user_id: string }) => r.user_id)));
    const userEmailMap = new Map<string, string>();
    if (platformUserIds.length > 0) {
      const { data: clientRows } = await supabase.from("clients").select("id, email").in("id", platformUserIds);
      for (const c of (clientRows ?? []) as { id: string; email: string }[]) {
        if (c.email) userEmailMap.set(c.id, c.email);
      }
    }
    setPlatformRows(((platformAcc ?? []) as Omit<PlatformAcceptanceRow, "user_email">[]).map((r) => ({
      ...r,
      user_email: userEmailMap.get(r.user_id) ?? null,
    })));
    if (aErr) {
      setError(aErr.message);
      setLoading(false);
      return;
    }
    const companyMap = new Map<string, string>((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const poMap = new Map<string, { po_number: string; total_isk: number; currency: string }>();
    for (const po of (pos ?? []) as { agreement_id: string; po_number: string; total_isk: number; currency: string }[]) {
      poMap.set(po.agreement_id, po);
    }
    const joined: AgreementRow[] = (agreements ?? []).map((a) => {
      const row = a as unknown as Omit<AgreementRow, "company_name" | "po_number" | "total_isk" | "currency">;
      const po = poMap.get(row.id);
      return {
        ...row,
        company_name: companyMap.get(row.company_id) ?? "(unknown)",
        po_number: po?.po_number ?? null,
        total_isk: po?.total_isk ?? null,
        currency: po?.currency ?? null,
      };
    });
    setRows(joined);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.company_name.toLowerCase().includes(q)
      || r.signatory_name.toLowerCase().includes(q)
      || r.signatory_email.toLowerCase().includes(q)
      || (r.po_number || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const filteredPlatform = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return platformRows;
    return platformRows.filter((r) =>
      (r.user_email || "").toLowerCase().includes(q)
      || r.document_key.toLowerCase().includes(q)
      || r.document_version.toLowerCase().includes(q),
    );
  }, [platformRows, search]);

  const download = async (row: AgreementRow) => {
    if (!row.pdf_storage_path) {
      alert("PDF is missing — the upload may have failed. Contact engineering to regenerate.");
      return;
    }
    setDownloadingId(row.id);
    try {
      const { data, error: sErr } = await supabase.storage
        .from("b2b-signed-documents")
        .createSignedUrl(row.pdf_storage_path, 300);
      if (sErr || !data?.signedUrl) {
        alert(`Failed to generate download URL: ${sErr?.message || "unknown"}`);
        return;
      }
      window.open(data.signedUrl, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  const fmtIsk = (n: number | null) => n == null ? "—" : n.toLocaleString("is-IS") + " kr";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Legal</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tab === "commercial"
              ? "Commercial B2B service agreements + purchase orders signed by contact persons."
              : "Platform-level acceptances: Terms of Service + Data Processing Agreement, one per user."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={tab === "commercial" ? "Search company, signatory, PO…" : "Search user email, doc key…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-72 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none text-gray-900"
          />
          <button onClick={load} disabled={loading} className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("commercial")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "commercial" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Commercial agreements ({rows.length})
        </button>
        <button
          onClick={() => setTab("platform")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "platform" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Platform acceptances ({platformRows.length})
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}

      {/* ── COMMERCIAL TAB ─────────────────────────────────────── */}
      {tab === "commercial" && !loading && filtered.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-12 text-center text-sm text-gray-400">
          No signed agreements yet.
        </div>
      )}

      {tab === "commercial" && filtered.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Signatory</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Signed</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">IP</th>
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.company_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-700">{r.po_number || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium">{r.signatory_name}</div>
                      <div className="text-xs text-gray-400">{r.signatory_role} · {r.signatory_email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.signed_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{fmtIsk(r.total_isk)}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-gray-500">{r.agreement_version}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-gray-400">{r.signatory_ip || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => download(r)}
                        disabled={downloadingId === r.id || !r.pdf_storage_path}
                        title={!r.pdf_storage_path ? "PDF not available" : "Download signed PDF"}
                        className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 disabled:opacity-40"
                      >
                        {downloadingId === r.id ? "…" : r.pdf_storage_path ? "Download PDF" : "Missing"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PLATFORM TAB ───────────────────────────────────────── */}
      {tab === "platform" && !loading && filteredPlatform.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-12 text-center text-sm text-gray-400">
          No platform acceptances yet.
        </div>
      )}

      {tab === "platform" && filteredPlatform.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Accepted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Text hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlatform.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">{r.user_email || "—"}</div>
                      <div className="text-[10px] font-mono text-gray-400 truncate max-w-[220px]" title={r.user_id}>{r.user_id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{r.document_key}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.document_version}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.accepted_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-gray-400">{r.ip || "—"}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-gray-400 truncate max-w-[180px]" title={r.text_hash}>{r.text_hash.slice(0, 16)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
