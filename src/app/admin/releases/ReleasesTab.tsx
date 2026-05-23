"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AdminAppendNote from "../components/AdminAppendNote";

interface ReleaseRow {
  id: string;
  repo: "app" | "website";
  version: string;
  build_number: string | null;
  platform: string | null;
  channel: "development" | "preview" | "production";
  git_sha: string;
  git_tag: string | null;
  git_branch: string | null;
  release_notes: string | null;
  risk_assessment: string | null;
  sbom_storage_path: string | null;
  sbom_sha256: string | null;
  build_artifact_url: string | null;
  released_at: string;
  released_by_email: string | null;
  release_addendum: string | null;
}

const REPO_PILL: Record<ReleaseRow["repo"], string> = {
  app: "bg-purple-100 text-purple-700",
  website: "bg-sky-100 text-sky-700",
};

const CHANNEL_PILL: Record<ReleaseRow["channel"], string> = {
  development: "bg-gray-100 text-gray-600",
  preview: "bg-amber-100 text-amber-700",
  production: "bg-emerald-100 text-emerald-700",
};

type RepoFilter = "all" | "app" | "website";

export default function ReleasesTab() {
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repoFilter, setRepoFilter] = useState<RepoFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .order("released_at", { ascending: false })
      .limit(200);
    if (error) setError(error.message);
    else setRows((data as ReleaseRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = repoFilter === "all" ? rows : rows.filter((r) => r.repo === repoFilter);

  const downloadSbom = async (row: ReleaseRow) => {
    if (!row.sbom_storage_path) return;
    setDownloadingId(row.id);
    try {
      const { data, error } = await supabase.storage
        .from("app-releases-sbom")
        .createSignedUrl(row.sbom_storage_path, 60);
      if (error || !data?.signedUrl) {
        alert(`Could not generate SBOM URL: ${error?.message ?? "unknown"}`);
        return;
      }
      window.open(data.signedUrl, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="inline-flex bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          {(["all", "app", "website"] as RepoFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setRepoFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                repoFilter === f ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        <div className="text-xs text-gray-500 ml-auto">
          {filtered.length} of {rows.length} release{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Released</th>
              <th className="px-4 py-3">Repo</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Git</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3 text-right">SBOM</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No releases registered yet.</td></tr>
            ) : filtered.map((r) => (
              <>
                <tr
                  key={r.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {new Date(r.released_at).toLocaleString("en-GB", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${REPO_PILL[r.repo]}`}>
                      {r.repo}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-900">
                    v{r.version}{r.build_number ? ` (${r.build_number})` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CHANNEL_PILL[r.channel]}`}>
                      {r.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.platform ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500" title={r.git_sha}>
                    {r.git_sha.slice(0, 7)}{r.git_tag ? ` · ${r.git_tag}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.released_by_email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {r.sbom_storage_path ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadSbom(r); }}
                        disabled={downloadingId === r.id}
                        className="px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded"
                      >
                        {downloadingId === r.id ? "…" : "JSON"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">
                            Release notes
                          </h4>
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
                            {r.release_notes || "(none)"}
                          </pre>
                        </div>
                        <div>
                          <h4 className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">
                            Risk assessment
                          </h4>
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
                            {r.risk_assessment || "(none recorded)"}
                          </pre>
                          {r.build_artifact_url && (
                            <a
                              href={r.build_artifact_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-3 text-xs font-medium text-blue-700 hover:underline"
                            >
                              Build artifact ↗
                            </a>
                          )}
                          {r.sbom_sha256 && (
                            <div className="mt-2 text-[10px] text-gray-400 font-mono break-all">
                              SBOM sha256: {r.sbom_sha256}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Post-launch addendum — kept separate from
                          the immutable release_notes so the original
                          ship-time content stays untouched, while
                          field observations accumulate over time. */}
                      <div className="mt-4 border-t border-gray-200 pt-3">
                        <AdminAppendNote
                          table="app_releases"
                          rowId={r.id}
                          column="release_addendum"
                          currentValue={r.release_addendum}
                          label="Post-launch addendum (regressions, hotfix refs, field reports — most recent first)"
                          onSaved={load}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Register a new release with{" "}
        <code className="bg-gray-100 px-1 py-0.5 rounded">scripts/release.sh</code> in
        the app repo (creates row + uploads SBOM via{" "}
        <code className="bg-gray-100 px-1 py-0.5 rounded">/api/admin/releases</code>).
      </div>
    </>
  );
}
