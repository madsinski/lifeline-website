"use client";

// "Your signed documents" — read-only list of every legal document
// the current user has accepted (TOS, DPA, employee TOS, health-
// assessment consent, Biody import consent, etc.) with a button to
// download the original signed PDF certificate.
//
// Acceptances live in platform_agreement_acceptances. PDFs live in
// the platform-acceptance-pdfs storage bucket and are fetched via
// short-lived signed URL (5 min TTL) the same way the admin legal
// page does it — so we never expose a public URL.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface AcceptanceRow {
  id: string;
  document_key: string;
  document_version: string;
  accepted_at: string;
  pdf_storage_path: string | null;
  text_hash: string | null;
}

const DOC_TITLE_IS: Record<string, string> = {
  "terms-of-service": "Notkunarskilmálar (TOS)",
  "data-processing-agreement": "Vinnslusamningur (DPA)",
  "employee-terms-of-service": "Notkunarskilmálar fyrir starfsmenn",
  "health-assessment-consent": "Upplýst samþykki fyrir heilsumat",
  "biody-import-v1": "Samþykki fyrir Biody-innflutning í app",
  "privacy-policy": "Persónuverndarstefna",
};

export default function SignedDocumentsList() {
  const [rows, setRows] = useState<AcceptanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Ekki innskráð/-ur."); return; }
      const { data, error: qErr } = await supabase
        .from("platform_agreement_acceptances")
        .select("id, document_key, document_version, accepted_at, pdf_storage_path, text_hash")
        .eq("user_id", user.id)
        .order("accepted_at", { ascending: false });
      if (qErr) {
        setError(qErr.message);
        return;
      }
      setRows((data || []) as AcceptanceRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const downloadPdf = async (row: AcceptanceRow) => {
    if (!row.pdf_storage_path) return;
    setDownloadingId(row.id);
    try {
      const { data, error: signErr } = await supabase.storage
        .from("platform-acceptance-pdfs")
        .createSignedUrl(row.pdf_storage_path, 300);
      if (signErr || !data?.signedUrl) {
        alert(`Tókst ekki að sækja PDF: ${signErr?.message || "engin slóð"}`);
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Hleð skjölum…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Engin undirrituð skjöl. Þú hefur ekki samþykkt nein lögleg skjöl ennþá á þessum aðgangi.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const title = DOC_TITLE_IS[r.document_key] || r.document_key;
        return (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#1F2937] truncate">{title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Útgáfa <span className="font-mono">{r.document_version}</span>
                {" · "}
                Samþykkt {new Date(r.accepted_at).toLocaleDateString("is-IS", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadPdf(r)}
              disabled={!r.pdf_storage_path || downloadingId === r.id}
              title={!r.pdf_storage_path ? "PDF ekki tilbúið" : "Sækja PDF"}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {downloadingId === r.id ? "Sæki…" : r.pdf_storage_path ? "Sækja PDF" : "PDF vantar"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
