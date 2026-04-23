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
  pdf_storage_path: string | null;
  user_email: string | null;
  user_full_name: string | null;
}

export default function AdminLegalPage() {
  const [tab, setTab] = useState<Tab>("commercial");
  const [rows, setRows] = useState<AgreementRow[]>([]);
  const [platformRows, setPlatformRows] = useState<PlatformAcceptanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [docKindFilter, setDocKindFilter] = useState<"all" | "terms-of-service" | "data-processing-agreement" | "employee-terms-of-service" | "health-assessment-consent">("all");
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
        .select("id, user_id, document_key, document_version, text_hash, ip, user_agent, accepted_at, pdf_storage_path")
        .order("accepted_at", { ascending: false }),
    ]);

    // Resolve user email + full name for platform acceptances via clients
    // table so the list is searchable by name, not just email. Best-effort
    // — a user with no clients row (rare) still shows the uuid.
    const platformUserIds = Array.from(new Set((platformAcc ?? []).map((r: { user_id: string }) => r.user_id)));
    const userInfoMap = new Map<string, { email: string | null; full_name: string | null }>();
    if (platformUserIds.length > 0) {
      const { data: clientRows } = await supabase
        .from("clients")
        .select("id, email, full_name")
        .in("id", platformUserIds);
      for (const c of (clientRows ?? []) as { id: string; email: string | null; full_name: string | null }[]) {
        userInfoMap.set(c.id, { email: c.email || null, full_name: c.full_name || null });
      }
    }
    setPlatformRows(((platformAcc ?? []) as Omit<PlatformAcceptanceRow, "user_email" | "user_full_name">[]).map((r) => {
      const info = userInfoMap.get(r.user_id);
      return {
        ...r,
        user_email: info?.email ?? null,
        user_full_name: info?.full_name ?? null,
      };
    }));
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
    let rows = platformRows;
    if (docKindFilter !== "all") rows = rows.filter((r) => r.document_key === docKindFilter);
    if (!q) return rows;
    return rows.filter((r) =>
      (r.user_full_name || "").toLowerCase().includes(q)
      || (r.user_email || "").toLowerCase().includes(q)
      || r.document_key.toLowerCase().includes(q)
      || r.document_version.toLowerCase().includes(q),
    );
  }, [platformRows, search, docKindFilter]);

  // Per-document-key counts, always against the unfiltered set so the
  // pills show the true totals even when a filter narrows the table.
  const platformCounts = useMemo(() => {
    const all = platformRows;
    return {
      all: all.length,
      "terms-of-service": all.filter((r) => r.document_key === "terms-of-service").length,
      "data-processing-agreement": all.filter((r) => r.document_key === "data-processing-agreement").length,
      "employee-terms-of-service": all.filter((r) => r.document_key === "employee-terms-of-service").length,
      "health-assessment-consent": all.filter((r) => r.document_key === "health-assessment-consent").length,
    };
  }, [platformRows]);

  const exportPlatformCsv = useCallback(() => {
    const q = (s: string | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const header = ["User name", "User email", "User id", "Document key", "Version", "Accepted at", "IP", "User agent", "Text hash", "PDF path"].join(",");
    const rows = filteredPlatform.map((r) => [
      q(r.user_full_name), q(r.user_email), q(r.user_id), q(r.document_key), q(r.document_version),
      q(r.accepted_at), q(r.ip), q(r.user_agent), q(r.text_hash), q(r.pdf_storage_path),
    ].join(","));
    const blob = new Blob(["\ufeff" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `platform-acceptances-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredPlatform]);

  const downloadFromBucket = async (id: string, bucket: string, storagePath: string | null) => {
    if (!storagePath) {
      alert("PDF is missing — the upload may have failed.");
      return;
    }
    setDownloadingId(id);
    try {
      const { data, error: sErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 300);
      if (sErr || !data?.signedUrl) {
        alert(`Failed to generate download URL: ${sErr?.message || "unknown"}`);
        return;
      }
      window.open(data.signedUrl, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

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
              : "Every click-through acceptance across the platform — B2B contact persons (ToS + DPA), employees (Employee ToS + Health consent) and B2C customers (Health consent). Each row includes the user, version, timestamp, IP and a downloadable PDF certificate."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={tab === "commercial" ? "Search company, signatory, PO…" : "Search client name, email, doc key…"}
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

      {/* Platform tab: document-type filter + CSV export. Counts reflect
          the un-filtered totals so admins see the full picture at a glance. */}
      {tab === "platform" && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { key: "all", label: "All" },
              { key: "terms-of-service", label: "Terms of Service" },
              { key: "data-processing-agreement", label: "DPA (Vinnslusamningur)" },
              { key: "employee-terms-of-service", label: "Employee ToS" },
              { key: "health-assessment-consent", label: "Health consent" },
            ] as Array<{ key: typeof docKindFilter; label: string }>).map((p) => (
              <button
                key={p.key}
                onClick={() => setDocKindFilter(p.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  docKindFilter === p.key ? "bg-emerald-600 text-white" : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {p.label} <span className="opacity-70">· {platformCounts[p.key]}</span>
              </button>
            ))}
          </div>
          <button
            onClick={exportPlatformCsv}
            disabled={filteredPlatform.length === 0}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            title="Download the current view as CSV for audit / file-keeping"
          >
            Export CSV
          </button>
        </div>
      )}

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
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlatform.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">{r.user_full_name || r.user_email || "—"}</div>
                      {r.user_full_name && r.user_email && (
                        <div className="text-[11px] text-gray-500">{r.user_email}</div>
                      )}
                      <div className="text-[10px] font-mono text-gray-400 truncate max-w-[220px]" title={r.user_id}>{r.user_id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{r.document_key}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.document_version}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.accepted_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-gray-400">{r.ip || "—"}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-gray-400 truncate max-w-[180px]" title={r.text_hash}>{r.text_hash.slice(0, 16)}…</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => downloadFromBucket(r.id, "platform-acceptance-pdfs", r.pdf_storage_path)}
                        disabled={downloadingId === r.id || !r.pdf_storage_path}
                        title={!r.pdf_storage_path ? "PDF not available" : "Download acceptance certificate"}
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
    </div>
  );
}
