// Server-side validation for no-login external-counsel review links.
// Used by the /legal-review/[token] page and its token-gated APIs.
// SERVER ONLY — imports supabase-admin.

import { supabaseAdmin } from "@/lib/supabase-admin";

export interface ReviewLinkRow {
  id: string;
  label: string | null;
  active: boolean;
  expires_at: string | null;
}

// Returns the link row if the token is valid (exists, active, not
// expired), else null. Never throws — a missing table (migration not
// applied) resolves to null, so the page shows "invalid link".
export async function validateReviewToken(token: string | undefined | null): Promise<ReviewLinkRow | null> {
  if (!token || typeof token !== "string" || token.length < 20) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("legal_review_links")
      .select("id, label, active, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (error || !data) return null;
    if (!data.active) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    return data as ReviewLinkRow;
  } catch {
    return null;
  }
}

// Best-effort touch of last_used_at. Never throws.
export async function touchReviewLink(id: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("legal_review_links")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", id);
  } catch {
    /* ignore */
  }
}
