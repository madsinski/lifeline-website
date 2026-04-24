"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Per-staff legal panel — opened from the team table as a modal.
// Two sections: signed click-through agreements (with PDF downloads)
// and bespoke uploaded documents (offer letter, amendments, etc).

type Acceptance = {
  id: string;
  document_key: string;
  document_version: string;
  document_title: string | null;
  text_hash: string;
  ip: string | null;
  user_agent: string | null;
  pdf_storage_path: string | null;
  typed_signature: string | null;
  accepted_at: string;
  signed_url: string | null;
};

type Document = {
  id: string;
  kind: "nda" | "confidentiality" | "employment_contract" | "offer_letter" | "amendment" | "tax_form" | "other";
  title: string | null;
  filename: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  signer_name: string | null;
  signed_at: string | null;
  note: string | null;
  uploaded_at: string;
  signed_url: string | null;
};

const KIND_LABELS: Record<Document["kind"], string> = {
  nda: "NDA",
  confidentiality: "Þagnarskylda",
  employment_contract: "Ráðningarsamningur",
  offer_letter: "Ráðningarboð",
  amendment: "Viðauki",
  tax_form: "Skattaform",
  other: "Annað",
};

export default function StaffLegalButton({
  staffId,
  staffName,
}: {
  staffId: string;
  staffName: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"agreements" | "documents">("agreements");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  // Upload form
  const [kind, setKind] = useState<Document["kind"]>("employment_contract");
  const [title, setTitle] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [agrRes, docRes] = await Promise.all([
        fetch(`/api/admin/staff/${staffId}/agreements`, { headers }),
        fetch(`/api/admin/staff/${staffId}/documents`, { headers }),
      ]);
      const agrJ = await agrRes.json().catch(() => ({}));
      const docJ = await docRes.json().catch(() => ({}));
      if (!agrRes.ok || !agrJ?.ok) {
        setErr(agrJ?.detail || agrJ?.error || "Failed to load agreements.");
      }
      if (!docRes.ok || !docJ?.ok) {
        setErr((prev) => prev || docJ?.detail || docJ?.error || "Failed to load documents.");
      }
      setAcceptances(agrJ?.acceptances || []);
      setDocuments(docJ?.documents || []);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const submitUpload = async () => {
    if (!file) { setErr("Choose a file to upload."); return; }
    setUploading(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      if (title) fd.append("title", title);
      if (signerName) fd.append("signer_name", signerName);
      if (signedAt) fd.append("signed_at", signedAt);
      if (note) fd.append("note", note);
      const res = await fetch(`/api/admin/staff/${staffId}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setErr(j?.detail || j?.error || "Upload failed.");
        return;
      }
      setFile(null);
      setTitle("");
      setSignerName("");
      setSignedAt("");
      setNote("");
      await load();
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (docId: string) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`/api/admin/staff/${staffId}/documents/${docId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) {
      alert(`Delete failed: ${j?.detail || j?.error || "unknown"}`);
      return;
    }
    await load();
  };

  const prettySize = (n: number | null) =>
    n == null ? "—" : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors"
        title="Legal documents & signatures"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Legal — {staffName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Signed agreements + uploaded documents</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-3 border-b border-gray-100">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setTab("agreements")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    tab === "agreements" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Signed agreements ({acceptances.length})
                </button>
                <button
                  onClick={() => setTab("documents")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    tab === "documents" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Documents ({documents.length})
                </button>
              </div>
            </div>

            <div className="p-6">
              {err && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
              )}
              {loading && <div className="text-sm text-gray-500">Loading…</div>}

              {!loading && tab === "agreements" && (
                <div className="space-y-2">
                  {acceptances.length === 0 ? (
                    <div className="text-sm text-gray-500 italic py-6 text-center">No signed agreements yet.</div>
                  ) : (
                    acceptances.map((a) => (
                      <div key={a.id} className="rounded-lg border border-gray-200 p-3 flex items-start gap-3">
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {a.document_title || a.document_key}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                            {a.document_key} · {a.document_version} · {new Date(a.accepted_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5 font-mono truncate">
                            IP {a.ip || "—"} · hash {a.text_hash.slice(0, 20)}…
                          </div>
                          {a.typed_signature && (
                            <div className="text-[11px] text-gray-500 mt-0.5">Signed as <span className="font-semibold text-gray-700">{a.typed_signature}</span></div>
                          )}
                        </div>
                        <div className="shrink-0">
                          {a.signed_url ? (
                            <a
                              href={a.signed_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                              </svg>
                              PDF
                            </a>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">No PDF</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!loading && tab === "documents" && (
                <div className="space-y-4">
                  {/* Upload form */}
                  <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/40">
                    <div className="text-sm font-semibold text-gray-900">Upload a new document</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-700 mb-1">Kind *</span>
                        <select value={kind} onChange={(e) => setKind(e.target.value as Document["kind"])} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                          {(Object.keys(KIND_LABELS) as Document["kind"][]).map((k) => (
                            <option key={k} value={k}>{KIND_LABELS[k]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-700 mb-1">Title (optional)</span>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-700 mb-1">Signer name</span>
                        <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-700 mb-1">Signed date</span>
                        <input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="block text-xs font-medium text-gray-700 mb-1">Note</span>
                        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="block text-xs font-medium text-gray-700 mb-1">File *</span>
                        <input
                          type="file"
                          accept="application/pdf,image/png,image/jpeg"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          className="w-full text-sm"
                        />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={submitUpload}
                        disabled={!file || uploading}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {uploading ? "Uploading…" : "Upload"}
                      </button>
                    </div>
                  </div>

                  {/* List */}
                  {documents.length === 0 ? (
                    <div className="text-sm text-gray-500 italic py-6 text-center">No documents uploaded yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((d) => (
                        <div key={d.id} className="rounded-lg border border-gray-200 p-3 flex items-start gap-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-100 shrink-0">
                            {KIND_LABELS[d.kind]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {d.title || d.filename}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 font-mono truncate">
                              {d.filename} · {prettySize(d.size_bytes)} · {new Date(d.uploaded_at).toLocaleDateString("en-GB")}
                            </div>
                            {(d.signer_name || d.signed_at) && (
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {d.signer_name || "—"}{d.signed_at ? ` · signed ${new Date(d.signed_at).toLocaleDateString("en-GB")}` : ""}
                              </div>
                            )}
                            {d.note && <div className="text-[11px] text-gray-500 mt-0.5 italic">“{d.note}”</div>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {d.signed_url && (
                              <a
                                href={d.signed_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                              >
                                Open
                              </a>
                            )}
                            <button
                              onClick={() => deleteDocument(d.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
