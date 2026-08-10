// Server-only: load a page's PUBLISHED CMS blob for SSR, so the public pages
// render the published content on the first paint instead of flashing the
// built-in defaults and swapping in the CMS content after a client fetch.
//
// Only ever import this from a Server Component (page.tsx) — it pulls in the
// service-role client. The client `*View` components receive the result as the
// `initialBlob` prop.

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { SiteContentBlob } from "./types";

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
