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
import { useI18n } from "@/lib/i18n";

interface AcceptanceRow {
  id: string;
  document_key: string;
  document_version: string;
  accepted_at: string;
  pdf_storage_path: string | null;
  text_hash: string | null;
}

const buildDocTitles = (locale: "en" | "is"): Record<string, string> =>
  locale === "is"
    ? {
        "terms-of-service": "Notkunarskilmálar (TOS)",
        "data-processing-agreement": "Vinnslusamningur (DPA)",
        "employee-terms-of-service": "Notkunarskilmálar fyrir starfsmenn",
        "health-assessment-consent": "Upplýst samþykki fyrir heilsumat",
        "biody-import-v1": "Samþykki fyrir Biody-innflutning í app",
        "privacy-policy": "Persónuverndarstefna",
      }
    : {
        "terms-of-service": "Terms of Service (TOS)",
        "data-processing-agreement": "Data Processing Agreement (DPA)",
        "employee-terms-of-service": "Terms of Service for employees",
        "health-assessment-consent": "Informed consent for the health assessment",
        "biody-import-v1": "Consent for Biody import into the app",
        "privacy-policy": "Privacy Policy",
      };

export default function SignedDocumentsList() {
  const { locale } = useI18n();
  const docTitles = buildDocTitles(locale);
  const [rows, setRows] = useState<AcceptanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError(locale === "is" ? "Ekki innskráð/-ur." : "Not signed in."); return; }
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
  }, [locale]);

  useEffect(() => { load(); }, [load]);

  const downloadPdf = async (row: AcceptanceRow) => {
    if (!row.pdf_storage_path) return;
    setDownloadingId(row.id);
    try {
      const { data, error: signErr } = await supabase.storage
        .from("platform-acceptance-pdfs")
        .createSignedUrl(row.pdf_storage_path, 300);
      if (signErr || !data?.signedUrl) {
        alert(locale === "is"
          ? `Tókst ekki að sækja PDF: ${signErr?.message || "engin slóð"}`
          : `Could not fetch PDF: ${signErr?.message || "no URL"}`);
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">{locale === "is" ? "Hleð skjölum…" : "Loading documents…"}</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {locale === "is"
          ? "Engin undirrituð skjöl. Þú hefur ekki samþykkt nein lögleg skjöl ennþá á þessum aðgangi."
          : "No signed documents. You have not accepted any legal documents on this account yet."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const title = docTitles[r.document_key] || r.document_key;
        return (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#1F2937] truncate">{title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {locale === "is" ? "Útgáfa" : "Version"} <span className="font-mono">{r.document_version}</span>
                {" · "}
                {locale === "is" ? "Samþykkt" : "Accepted"} {new Date(r.accepted_at).toLocaleDateString(locale === "is" ? "is-IS" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadPdf(r)}
              disabled={!r.pdf_storage_path || downloadingId === r.id}
              title={!r.pdf_storage_path
                ? (locale === "is" ? "PDF ekki tilbúið" : "PDF not ready")
                : (locale === "is" ? "Sækja PDF" : "Download PDF")}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {downloadingId === r.id
                ? (locale === "is" ? "Sæki…" : "Fetching…")
                : r.pdf_storage_path
                  ? (locale === "is" ? "Sækja PDF" : "Download PDF")
                  : (locale === "is" ? "PDF vantar" : "PDF missing")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
