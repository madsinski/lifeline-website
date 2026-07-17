import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { mergeWhatsNew, DEFAULT_WHATS_NEW } from "@/lib/whats-new";

// Public read for the homepage "What's new" carousel. Returns only enabled
// cards. Backed by supabase/migration-whats-new.sql (row id = 1). Reads via
// the service role, so no public RLS policy is needed on the table.
export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("whats_new")
      .select("data")
      .eq("id", 1)
      .maybeSingle();
    const content = mergeWhatsNew(data?.data);
    return NextResponse.json({ cards: content.cards.filter((c) => c.enabled) });
  } catch {
    // Resilient fallback — never break the homepage on a DB hiccup.
    return NextResponse.json({ cards: DEFAULT_WHATS_NEW.cards.filter((c) => c.enabled) });
  }
}
