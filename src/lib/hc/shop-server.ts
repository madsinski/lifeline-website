// Server half of the single shop (src/lib/hc/shop.ts). Server only.
// Schema: supabase/migration-single-shop.sql.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { DOCTOR_PACKAGE_KEY, readDoctorConfig, type DoctorConfig } from "@/lib/hc/shop";

/** The doctor's day, from hc_packages.quota on 'laeknisvidtal' (fallbacks in shop.ts). */
export async function doctorConfig(): Promise<DoctorConfig> {
  const { data } = await supabaseAdmin.from("hc_packages").select("quota").eq("key", DOCTOR_PACKAGE_KEY).maybeSingle();
  return readDoctorConfig(data?.quota);
}

/**
 * A company's agreed health-check price, while the lock holds.
 *
 * Companies that had an agreement or codes before the 59.900 list price keep
 * 49.900 until renewal (companies.hc_price_isk / hc_price_locked_until).
 * Null = list price. Only the bundle (kind 'health_check') is locked.
 */
export async function companyLockedPrice(companyId: string, kind: string): Promise<number | null> {
  if (kind !== "health_check") return null;
  const { data, error } = await supabaseAdmin.from("companies")
    .select("hc_price_isk, hc_price_locked_until").eq("id", companyId).maybeSingle();
  if (error || !data || data.hc_price_isk == null) return null;
  if (data.hc_price_locked_until && Date.parse(`${data.hc_price_locked_until}T23:59:59Z`) < Date.now()) return null;
  return data.hc_price_isk as number;
}

/** Give a claimed slot back. Only the holder's claim is released. */
export async function releaseSlot(kind: string, slotId: string | null | undefined, clientId: string) {
  if (!slotId) return;
  const table = kind === "doctor" ? "doctor_slots" : kind === "measurement" ? "station_slots" : null;
  if (!table) return;
  await supabaseAdmin.from(table)
    .update({ client_id: null, booked_at: null, updated_at: new Date().toISOString() })
    .eq("id", slotId).eq("client_id", clientId).is("completed_at", null)
    .then(({ error }) => { if (error) console.warn("[shop] releaseSlot failed", table, slotId, error.message); },
      (e) => console.warn("[shop] releaseSlot failed", table, slotId, e));
}
