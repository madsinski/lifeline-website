import AssessmentView, { type ShopPrices } from "./AssessmentView";
import { getPublishedBlob } from "@/lib/site-content/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SHOP_KINDS } from "@/lib/hc/shop";

export const dynamic = "force-dynamic";

/** The shop's prices, from hc_packages, so the page says what checkout charges. */
async function shopPrices(): Promise<ShopPrices> {
  try {
    const { data } = await supabaseAdmin.from("hc_packages")
      .select("kind, price_isk, location_id, sort").eq("active", true).in("kind", [...SHOP_KINDS])
      .is("location_id", null).order("sort");
    const out: ShopPrices = {};
    for (const r of data ?? []) {
      const k = r.kind as keyof ShopPrices;
      if (out[k] == null) out[k] = r.price_isk as number;
    }
    return out;
  } catch {
    return {};
  }
}

export default async function AssessmentPage() {
  const [initialBlob, prices] = await Promise.all([getPublishedBlob("assessment"), shopPrices()]);
  return <AssessmentView initialBlob={initialBlob} prices={prices} />;
}
