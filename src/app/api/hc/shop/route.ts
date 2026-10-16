// The Þjónusta page (/app/eg/thjonusta): what Lifeline sells and what the
// client has bought from it.
//
// GET → { packages, orders, bookings, doctor_weekday, profile_complete,
//         bundle_paid, journey_id }
//
// packages  the bundle and the three standalone products (hc_packages,
//           active). Buying goes through /api/hc/checkout.
// orders    the client's paid orders of those kinds (plus re-evaluation),
//           with the Medalia code, newest first.
// bookings  the active bookings that redeem those orders
//           (hc_bookings.order_id), from /api/hc/shop/book.
//
// Schema: supabase/migration-single-shop.sql. Products: src/lib/hc/shop.ts.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, getClientProfile, isProfileComplete, requireUser } from "@/lib/hc/server";
import { SHOP_KINDS } from "@/lib/hc/shop";
import { doctorConfig } from "@/lib/hc/shop-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const [journey, profile, cfg, pkgs, orders] = await Promise.all([
    currentJourney(user.id),
    getClientProfile(user.id),
    doctorConfig(),
    supabaseAdmin.from("hc_packages")
      .select("key, kind, name, tagline, description, includes, price_isk, union_category, sort, location_id")
      .eq("active", true).in("kind", [...SHOP_KINDS]).order("sort"),
    supabaseAdmin.from("hc_orders")
      .select("id, journey_id, package_key, kind, price_isk, amount_charged_isk, payment_route, status, paid_at, activation_code, activation_redeemed_at, created_at")
      .eq("client_id", user.id).eq("status", "paid")
      .in("kind", [...SHOP_KINDS, "reevaluation"])
      .order("paid_at", { ascending: false }).limit(50),
  ]);

  const orderIds = (orders.data ?? []).map((o) => o.id as string);
  const { data: bookings } = orderIds.length
    ? await supabaseAdmin.from("hc_bookings")
        .select("id, order_id, kind, starts_at, minutes, status, slot_id")
        .in("order_id", orderIds).neq("status", "cancelled").order("starts_at")
    : { data: [] };

  /* Location-bound packages only where the journey is; the shop's own rows have none. */
  const packages = (pkgs.data ?? []).filter((p) => !p.location_id || p.location_id === journey?.location_id);

  return NextResponse.json({
    packages,
    orders: orders.data ?? [],
    bookings: bookings ?? [],
    doctor_weekday: cfg.doctor_weekday,
    profile_complete: isProfileComplete(profile),
    bundle_paid: !!journey?.paid_at,
    journey_id: journey?.id ?? null,
  });
}
