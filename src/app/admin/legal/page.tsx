"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import LegalTabBar from "./LegalTabBar";

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
  const [backfilling, setBackfilling] = useState(false);
  const [selectedCommercial, setSelectedCommercial] = useState<Set<string>>(new Set());
  const [selectedPlatform, setSelectedPlatform] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const bulkDelete = async (target: "commercial" | "platform", opts: { all?: boolean }) => {
    const ids = target === "commercial" ? Array.from(selectedCommercial) : Array.from(selectedPlatform);
    const count = opts.all ? (target === "commercial" ? rows.length : platformRows.length) : ids.length;
    if (count === 0) return;
    const label = target === "commercial" ? "commercial agreement(s)" : "platform acceptance(s)";
    const prompt = opts.all
      ? `Delete ALL ${count} ${label}? This removes legal evidence of sign-off and cannot be undone.`
      : `Delete ${ids.length} selected ${label}? This cannot be undone.`;
    if (!confirm(prompt)) return;
    setDeleting(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      const endpoint = target === "commercial"
        ? "/api/admin/legal/agreements/bulk-delete"
        : "/api/admin/legal/acceptances/bulk-delete";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify(opts.all ? { all: true } : { ids }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        alert(`Delete failed: ${j?.detail || j?.error || "unknown"}`);
      } else {
        alert(`Deleted ${j.deleted} row(s). Storage blobs removed: ${j.blobs_removed ?? 0}.`);
        if (target === "commercial") setSelectedCommercial(new Set());
        else setSelectedPlatform(new Set());
        await load();
      }
    } finally {
      setDeleting(false);
    }
  };

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
        .from("clients_decrypted")
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

  const backfillPdfs = async () => {
    if (!confirm("Regenerate missing acceptance PDFs for every platform acceptance that has no PDF yet?")) return;
    setBackfilling(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/admin/legal/backfill-acceptance-pdfs", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        alert(`Backfill failed: ${j?.detail || j?.error || "unknown"}`);
        return;
      }
      const c = j.counts || {};
      const failures = (j.results || []).filter((r: { status: string; error?: string }) => r.status === "failed");
      // Dedupe error strings so we don't flood the alert when every row
      // hit the same problem (usually the case).
      const uniqErrs = Array.from(new Set(failures.map((r: { error?: string }) => r.error || "no detail"))) as string[];
      const errDetail = uniqErrs.length > 0 ? "\n\nUnique errors:\n" + uniqErrs.map((e) => "  • " + e).join("\n") : "";
      alert(
        `Scanned ${c.scanned}\n` +
        `Regenerated ${c.regenerated}\n` +
        `Skipped (old version) ${c.skipped_version_not_found}\n` +
        `Skipped (text drift) ${c.skipped_text_hash_mismatch}\n` +
        `Failed ${c.failed}` +
        errDetail
      );
      console.log("[backfill] full results:", j);
      await load();
    } finally {
      setBackfilling(false);
    }
  };

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
      <LegalTabBar />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Signed acceptances</h1>
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
          {tab === "platform" && platformRows.some((r) => !r.pdf_storage_path) && (
            <button
              onClick={backfillPdfs}
              disabled={backfilling}
              className="px-3 py-2 text-sm font-medium text-amber-800 border border-amber-300 rounded-lg bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
              title="Regenerate missing PDF certificates for older acceptances"
            >
              {backfilling ? "Regenerating…" : "Backfill missing PDFs"}
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs within Acceptances */}
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

      {tab === "commercial" && rows.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
          <span>{selectedCommercial.size} selected</span>
          <button
            onClick={() => bulkDelete("commercial", {})}
            disabled={selectedCommercial.size === 0 || deleting}
            className="px-2.5 py-1 rounded-md border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete selected
          </button>
          <div className="flex-1" />
          <button
            onClick={() => bulkDelete("commercial", { all: true })}
            disabled={deleting}
            className="px-2.5 py-1 rounded-md border border-red-400 text-red-800 bg-red-50 hover:bg-red-100 font-semibold disabled:opacity-40"
            title="Wipe every commercial agreement row"
          >
            Delete ALL commercial agreements
          </button>
        </div>
      )}

      {tab === "commercial" && filtered.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={filtered.length > 0 && filtered.every((r) => selectedCommercial.has(r.id))}
                      onChange={() => {
                        setSelectedCommercial((prev) => {
                          if (filtered.every((r) => prev.has(r.id))) return new Set();
                          return new Set(filtered.map((r) => r.id));
                        });
                      }}
                      className="w-4 h-4 accent-emerald-600"
                    />
                  </th>
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
                  <tr key={r.id} className={`hover:bg-gray-50/60 ${selectedCommercial.has(r.id) ? "bg-emerald-50/40" : ""}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCommercial.has(r.id)}
                        onChange={() => {
                          setSelectedCommercial((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 accent-emerald-600"
                      />
                    </td>
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

      {tab === "platform" && platformRows.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
          <span>{selectedPlatform.size} selected</span>
          <button
            onClick={() => bulkDelete("platform", {})}
            disabled={selectedPlatform.size === 0 || deleting}
            className="px-2.5 py-1 rounded-md border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete selected
          </button>
          <div className="flex-1" />
          <button
            onClick={() => bulkDelete("platform", { all: true })}
            disabled={deleting}
            className="px-2.5 py-1 rounded-md border border-red-400 text-red-800 bg-red-50 hover:bg-red-100 font-semibold disabled:opacity-40"
            title="Wipe every platform acceptance row"
          >
            Delete ALL platform acceptances
          </button>
        </div>
      )}

      {tab === "platform" && filteredPlatform.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={filteredPlatform.length > 0 && filteredPlatform.every((r) => selectedPlatform.has(r.id))}
                      onChange={() => {
                        setSelectedPlatform((prev) => {
                          if (filteredPlatform.every((r) => prev.has(r.id))) return new Set();
                          return new Set(filteredPlatform.map((r) => r.id));
                        });
                      }}
                      className="w-4 h-4 accent-emerald-600"
                    />
                  </th>
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
                  <tr key={r.id} className={`hover:bg-gray-50/60 ${selectedPlatform.has(r.id) ? "bg-emerald-50/40" : ""}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedPlatform.has(r.id)}
                        onChange={() => {
                          setSelectedPlatform((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 accent-emerald-600"
                      />
                    </td>
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
