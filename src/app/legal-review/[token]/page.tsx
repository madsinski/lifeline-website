// No-login external-counsel review page. The holder of a valid token
// (minted by an admin at /admin/legal/drafts) can view, redline and
// approve every legal document without a Lifeline account.
//
// Chrome-free (Navbar/Footer self-suppress on /legal-review) and
// allow-listed in src/proxy.ts so the coming-soon gate doesn't rewrite
// it. All writes go through token-gated APIs that re-validate the token.

import type { Metadata } from "next";
import { getLegalDocGroups } from "@/lib/legal-doc-registry";
import { validateReviewToken } from "@/lib/legal-review-token";
import { supabaseAdmin } from "@/lib/supabase-admin";
import LawyerReviewClient, { type SignoffRow } from "./LawyerReviewClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lifeline — legal document review",
  robots: { index: false, follow: false },
};

// Latest signoffs for every document, newest first, grouped by key.
async function loadSignoffs(): Promise<Record<string, SignoffRow[]>> {
  const map: Record<string, SignoffRow[]> = {};
  try {
    const { data } = await supabaseAdmin
      .from("legal_review_signoffs")
      .select("id, document_key, document_version, status, comments, reviewer_name, reviewer_email, reviewer_via, signed_at, created_at")
      .order("created_at", { ascending: false });
    for (const row of (data || []) as SignoffRow[]) {
      (map[row.document_key] ||= []).push(row);
    }
  } catch {
    /* table missing — no history shown */
  }
  return map;
}

export default async function LegalReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await validateReviewToken(token);

  if (!link) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[#1F2937]">Link not valid</h1>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            This review link is invalid, has expired, or has been revoked. Please ask your Lifeline
            contact for a fresh link.
          </p>
        </div>
      </main>
    );
  }

  const [groups, signoffs] = await Promise.all([getLegalDocGroups(), loadSignoffs()]);

  return (
    <LawyerReviewClient
      token={token}
      linkLabel={link.label}
      groups={groups}
      signoffs={signoffs}
    />
  );
}
