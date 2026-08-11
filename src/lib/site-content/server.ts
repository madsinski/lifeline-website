// Server-only: load a page's PUBLISHED CMS blob for SSR, so the public pages
// render the published content on the first paint instead of flashing the
// built-in defaults and swapping in the CMS content after a client fetch.
//
// Only ever import this from a Server Component (page.tsx) — it pulls in the
// service-role client. The client `*View` components receive the result as the
// `initialBlob` prop.

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { SiteContentBlob } from "./types";
import { mergeWhatsNew, DEFAULT_WHATS_NEW, type WhatsNewCard } from "@/lib/whats-new";

export async function getPublishedBlob(page: string): Promise<SiteContentBlob | null> {
  try {
    const { data } = await supabaseAdmin
      .from("site_content")
      .select("published")
      .eq("page", page)
      .maybeSingle();
    return (data?.published as SiteContentBlob) ?? null;
  } catch {
    return null;
  }
}

// The homepage "What's new" cards (enabled only), loaded server-side so the
// carousel renders the admin-managed cards on first paint (no flash of the
// built-in defaults). Mirrors the public /api/whats-new read.
export async function getPublishedWhatsNewCards(): Promise<WhatsNewCard[]> {
  try {
    const { data } = await supabaseAdmin.from("whats_new").select("data").eq("id", 1).maybeSingle();
    return mergeWhatsNew(data?.data).cards.filter((c) => c.enabled);
  } catch {
    return DEFAULT_WHATS_NEW.cards.filter((c) => c.enabled);
  }
}
