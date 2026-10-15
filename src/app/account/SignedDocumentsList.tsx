"use client";

// "Undirrituð skjöl" — read-only list of every legal document
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
import { FileText } from "lucide-react";
import { Alert, Button, accountInset, fmtDate, useDialog } from "@/app/components/account/ui";

interface AcceptanceRow {
  id: string;
  document_key: string;
  document_version: string;
  accepted_at: string;
  pdf_storage_path: string | null;
  text_hash: string | null;
}

const DOC_TITLE_IS = (t: (k: string, f?: string) => string): Record<string, string> => (
  {
  "terms-of-service": t("acct.docs.tos", "Notkunarskilmálar (TOS)"),
  "data-processing-agreement": "Vinnslusamningur (DPA)",
  "employee-terms-of-service": t("acct.docs.stafftos", "Notkunarskilmálar fyrir starfsmenn"),
  "health-assessment-consent": t("acct.doc.consent", "Upplýst samþykki fyrir heilsumat"),
  "biody-import-v1": t("acct.docs.biody", "Samþykki fyrir Biody-innflutning í app"),
  "privacy-policy": t("acct.docs.privacy", "Persónuverndarstefna"),
}
);

export default function SignedDocumentsList() {
  const { t, tv, locale } = useI18n();
  const { alert } = useDialog();
  const [rows, setRows] = useState<AcceptanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("not_signed_in"); return; }
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
        await alert({ title: tv("acct.docs.pdffail", "Tókst ekki að sækja PDF: {{err}}",
          { err: signErr?.message || t("acct.docs.nourl", "engin slóð") }) });
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-2" aria-busy="true" aria-label={t("acct.docs.loading", "Hleð skjölum")}>
        <div className="h-12 rounded-hc-element bg-hc-sunken-2" />
        <div className="h-12 rounded-hc-element bg-hc-sunken" />
      </div>
    );
  }
  if (error) {
    return <Alert tone="bad" compact>{error === "not_signed_in" ? t("acct.docs.notsignedin", "Ekki innskráð/-ur.") : error}</Alert>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-hc-ink-3">
        {t("acct.docs.empty", "Engin undirrituð skjöl. Þú hefur ekki samþykkt nein skjöl á þessum aðgangi enn þá.")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const title = DOC_TITLE_IS(t)[r.document_key] || r.document_key;
        return (
          <div key={r.id} className={`${accountInset} flex items-center justify-between gap-3 p-3`}>
            <FileText className="h-5 w-5 shrink-0 text-hc-ink-3" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-hc-ink">{title}</p>
              <p className="mt-0.5 text-xs text-hc-ink-3">
                {t("acct.docs.version", "Útgáfa")} <span className="font-mono">{r.document_version}</span>
                {" · "}
                {tv("acct.docs.accepted", "Samþykkt {{date}}", { date: fmtDate(r.accepted_at, {}, locale) })}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => downloadPdf(r)}
              disabled={!r.pdf_storage_path} busy={downloadingId === r.id}
              title={!r.pdf_storage_path ? t("acct.docs.nopdf", "PDF ekki tilbúið") : t("acct.docs.getpdf", "Sækja PDF")}>
              {r.pdf_storage_path ? t("acct.docs.getpdf", "Sækja PDF") : t("acct.docs.missing", "PDF vantar")}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
