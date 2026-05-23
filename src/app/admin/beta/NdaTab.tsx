"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AdminAppendNote from "../components/AdminAppendNote";

interface BetaNdaRow {
  id: string;
  user_id: string;
  user_email: string | null;
  document_key: string;
  document_version: string;
  text_hash: string;
  typed_signature: string;
  ip: string | null;
  user_agent: string | null;
  app_platform: string | null;
  app_version: string | null;
  pdf_storage_path: string | null;
  pdf_sha256: string | null;
  accepted_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  admin_notes: string | null;
}

export default function NdaTab() {
  const [rows, setRows] = useState<BetaNdaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from("beta_nda_acceptances")
      .select("*")
      .order("accepted_at", { ascending: false });
    if (!showRevoked) q = q.is("revoked_at", null);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setRows((data as BetaNdaRow[]) ?? []);
    setLoading(false);
  }, [showRevoked]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (r.user_email ?? "").toLowerCase().includes(s) ||
      (r.typed_signature ?? "").toLowerCase().includes(s) ||
      r.user_id.toLowerCase().includes(s)
    );
  });

  const download = async (row: BetaNdaRow) => {
    if (!row.pdf_storage_path) {
      alert("No PDF stored for this acceptance.");
      return;
    }
    setDownloadingId(row.id);
    try {
      const { data, error } = await supabase.storage
        .from("beta-nda-pdfs")
        .createSignedUrl(row.pdf_storage_path, 60);
      if (error || !data?.signedUrl) {
        alert(`Could not generate download URL: ${error?.message ?? "unknown"}`);
        return;
      }
      window.open(data.signedUrl, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  const revoke = async (row: BetaNdaRow) => {
    const reason = prompt(`Revoke the NDA acceptance for ${row.user_email ?? row.user_id}?\n\nReason (optional):`);
    if (reason === null) return;
    const { error } = await supabase
      .from("beta_nda_acceptances")
      .update({ revoked_at: new Date().toISOString(), revoke_reason: reason || null })
      .eq("id", row.id);
    if (error) {
      alert(`Revoke failed: ${error.message}`);
      return;
    }
    load();
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email, signed name, or user id…"
          className="flex-1 min-w-[240px] px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showRevoked}
            onChange={(e) => setShowRevoked(e.target.checked)}
          />
          Show revoked
        </label>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Tester</th>
              <th className="px-4 py-3">Signed</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">App</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Hash</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No signed agreements yet.</td></tr>
            ) : filtered.map((r) => (
              <>
                <tr key={r.id} className={`border-b border-gray-100 hover:bg-gray-50 ${r.revoked_at ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.typed_signature}</div>
                    <div className="text-xs text-gray-500">{r.user_email ?? "(no email)"}</div>
                    {r.revoked_at && (
                      <div className="text-xs text-red-600 mt-1">
                        Revoked {new Date(r.revoked_at).toLocaleDateString()}
                        {r.revoke_reason ? ` — ${r.revoke_reason}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(r.accepted_at).toLocaleString("en-GB", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-700">v{r.document_version}</td>
                  <td className="px-4 py-3 text-gray-700">{r.app_platform ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{r.app_version ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{r.ip ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono" title={r.text_hash}>
                    {r.text_hash.slice(0, 10)}…
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                      title="Show admin notes"
                    >
                      {expandedId === r.id ? "Hide" : "Notes"}
                    </button>
                    <button
                      onClick={() => download(r)}
                      disabled={!r.pdf_storage_path || downloadingId === r.id}
                      className="px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded disabled:opacity-40 disabled:cursor-not-allowed ml-1"
                    >
                      {downloadingId === r.id ? "…" : "PDF"}
                    </button>
                    {!r.revoked_at && (
                      <button
                        onClick={() => revoke(r)}
                        className="px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded ml-1"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={8} className="px-4 py-4">
                      <AdminAppendNote
                        table="beta_nda_acceptances"
                        rowId={r.id}
                        column="admin_notes"
                        currentValue={r.admin_notes}
                        label="Admin notes (out-of-band conversations, data-deletion requests, escalations — most recent first)"
                        onSaved={load}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        {filtered.length} row{filtered.length === 1 ? "" : "s"} shown · {rows.length} total.
      </p>
    </>
  );
}
