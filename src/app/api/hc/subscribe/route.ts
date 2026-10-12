// The app subscription.
//
// GET  → the package, and where this person stands with it
// POST { accept_terms } → start it
// DELETE → cancel at the end of the paid period
//
// ── Why this is separate from /api/hc/checkout ────────────────────────
//
// That route settles a bill: it writes an hc_orders row, a payment route, a
// union reimbursement, an activation code for the clinic. This one starts a
// period. The two share a catalogue (hc_packages) and nothing else, and
// forcing a recurring product through a one-off order would leave a paid
// order that nothing renews and a subscription nothing records.
//
// ── What is real and what is not ─────────────────────────────────────
//
// createStraumurCharge is still a stub: it waits 900ms and returns a made-up
// reference. The health-check checkout is in exactly the same position, so
// this is built to the same shape and becomes real when Straumur does. It
// means no money moves here yet, which is why the first period is written as
// a trial rather than as something paid for.
//
// Schema: supabase/migration-hc-subscription-package.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hcAudit, requireUser, siteOrigin } from "@/lib/hc/server";
import { createStraumurCharge } from "@/lib/straumur";

export const runtime = "nodejs";

const PACKAGE_KEY = "app-monthly";

/** The tier a paying subscriber is on. 'free-trial' is the period before that. */
const PAID_TIER = "premium";

async function pkg() {
  const { data } = await supabaseAdmin.from("hc_packages")
    .select("key, kind, name, tagline, description, includes, price_isk, interval_months")
    .eq("key", PACKAGE_KEY).eq("active", true).maybeSingle();
  return data;
}

/**
 * The one that counts.
 *
 * The table has cancelled rows alongside live ones — six free trials and
 * four premiums are cancelled already — so "do they have a subscription" is
 * a question about status, not about existence.
 */
async function current(clientId: string) {
  const { data } = await supabaseAdmin.from("subscriptions")
    .select("id, tier, status, trial_ends_at, current_period_start, current_period_end")
    .eq("client_id", clientId).eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const [p, sub] = await Promise.all([pkg(), current(user.id)]);
  return NextResponse.json({ package: p, subscription: sub });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  // Same gate the health-check checkout applies: the sales terms are binding
  // and somebody has to have agreed to them.
  if (!body?.accept_terms) {
    return NextResponse.json({ error: "Samþykkja þarf söluskilmála." }, { status: 400 });
  }

  const [p, existing] = await Promise.all([pkg(), current(user.id)]);
  if (!p) return NextResponse.json({ error: "package_not_found" }, { status: 404 });
  if (existing) return NextResponse.json({ ok: true, subscription: existing, already: true });

  /*
   * Charged through the same stub the rest of the site uses, so that when it
   * becomes a real charge this becomes a real subscription without the flow
   * changing shape. A failure here must not leave a row behind.
   */
  const charge = await createStraumurCharge({
    amountIsk: p.price_isk,
    reference: `sub_${user.id.slice(0, 8)}`,
    description: p.name,
    customer: { name: user.email || "", email: user.email || "", phone: null },
    returnUrl: `${siteOrigin(req)}/account/heilsuferd`,
  });
  if (!charge.ok) {
    return NextResponse.json({ error: charge.error || "Greiðsla tókst ekki." }, { status: 402 });
  }

  const now = new Date();
  const months = p.interval_months ?? 1;
  const end = new Date(now);
  end.setMonth(end.getMonth() + months);

  const { data: sub, error } = await supabaseAdmin.from("subscriptions")
    .insert({
      client_id: user.id,
      tier: PAID_TIER,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
    })
    .select("id, tier, status, trial_ends_at, current_period_start, current_period_end")
    .single();
  if (error || !sub) return NextResponse.json({ error: "Tókst ekki að hefja áskrift." }, { status: 500 });

  await hcAudit(`self:${user.id}`, "subscription_started", null, { tier: PAID_TIER, price: p.price_isk });
  return NextResponse.json({ ok: true, subscription: sub });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const sub = await current(user.id);
  if (!sub) return NextResponse.json({ ok: true, subscription: null });

  /*
   * Cancelled, not deleted, and the period that was paid for still runs.
   * Taking the app away the moment somebody cancels would be charging for a
   * month and delivering part of it.
   */
  await supabaseAdmin.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
  await hcAudit(`self:${user.id}`, "subscription_cancelled", null, { until: sub.current_period_end });
  return NextResponse.json({ ok: true, cancelled_at_period_end: sub.current_period_end });
}
