// Single-source-of-truth resolver for PUBLIC legal documents.
//
// Makes the admin legal tooling the source of truth for the public page while
// preserving the compliance invariant: the public page may ONLY show text that
// counsel has actually approved. We do that by matching the latest APPROVED
// sign-off (legal_review_signoffs) to the draft (legal_document_drafts) whose
// text_hash equals what was approved. If nothing is approved (or no draft hash
// matches), we return null and the caller renders the vetted source-code text
// as before — so an in-progress/unapproved draft can never leak to the public.
//
// Server-only (imports supabase-admin). Best-effort: never throws.

import { supabaseAdmin } from "@/lib/supabase-admin";

export interface PublishedDoc {
  text: string;
  version: string;
}

/**
 * Return the counsel-approved published text for a legal document_key +
 * language, or null to fall back to source-code text.
 */
export async function getPublishedLegalDoc(
  documentKey: string,
  language: "is" | "en",
): Promise<PublishedDoc | null> {
  try {
    // 1. Latest sign-off for this doc. Must be 'approved'.
    const { data: signoffs } = await supabaseAdmin
      .from("legal_review_signoffs")
      .select("document_version, text_hash, status, created_at")
      .eq("document_key", documentKey)
      .order("created_at", { ascending: false })
      .limit(1);
    const latest = signoffs?.[0];
    if (!latest || latest.status !== "approved" || !latest.text_hash) return null;

    // 2. Find the draft (this language) whose text_hash equals the approved
    //    text_hash. Only an exact hash match publishes — never an unvetted draft.
    const { data: drafts } = await supabaseAdmin
      .from("legal_document_drafts")
      .select("text, proposed_version, text_hash, language, created_at")
      .eq("document_key", documentKey)
      .eq("language", language)
      .order("created_at", { ascending: false });
    const match = drafts?.find((d) => d.text_hash === latest.text_hash);
    if (!match || !match.text) return null;

    return {
      text: match.text as string,
      version: (match.proposed_version as string) || (latest.document_version as string) || "",
    };
  } catch {
    return null;
  }
}
