// Áskrift — which plan you are on.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("tier, status, trial_ends_at, current_period_start, current_period_end")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    subscription: data
      ? {
          tier: (data.tier as string) ?? null,
          status: (data.status as string) ?? null,
          trialEndsAt: (data.trial_ends_at as string) ?? null,
          periodStart: (data.current_period_start as string) ?? null,
          periodEnd: (data.current_period_end as string) ?? null,
        }
      : null,
  });
}
