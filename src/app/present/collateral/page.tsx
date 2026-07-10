import type { Metadata } from "next";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { tenantForHost } from "@/lib/tenant";
import { mergeContent } from "@/app/admin/presentations/collateral/content";
import CollateralViewer from "./CollateralViewer";

// Public, read-only view of the Fjarlækningar × HSU print collateral. Lives
// under /present (already a proxy bypass + chrome-free path). Content is read
// fresh so edits show up immediately; falls back to DEFAULT_CONTENT on error.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = tenantForHost((await headers()).get("host")).name;
  return {
    title: `Prentefni · ${brand}`,
    robots: { index: false, follow: false },
  };
}

async function fetchContent() {
  try {
    const { data } = await supabaseAdmin
      .from("presentation_collateral")
      .select("data")
      .eq("id", 1)
      .maybeSingle();
    return mergeContent(data?.data);
  } catch {
    return mergeContent(undefined);
  }
}

export default async function CollateralViewPage() {
  const content = await fetchContent();
  return <CollateralViewer content={content} />;
}
