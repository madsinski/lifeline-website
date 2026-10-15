// Medalia activation codes from the pool (option B, Mads 2026-10-15).
//
// The health check is paid in Lifeline; each paid order gets ONE code from
// hc_activation_code_pool — 100% codes Medalia generated and Mads imported
// (admin → Heilsuferð → Virkjunarkóðar). The customer enters it in the
// patient portal to start the check. Schema and the SECURITY DEFINER
// functions: supabase/migration-hc-activation-code-pool.sql.
//
// When the pool for a kind is empty the order is still paid and valid, just
// without a code yet: the customer is told it is on its way, staff are
// alerted, and importing a new batch hands codes to those orders
// (assignPendingCodes). Nobody is ever given a code Medalia does not know.
//
// Server only.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import { hcAudit } from "@/lib/hc/server";

/** Where pool alerts go. */
const ALERT_TO = process.env.HC_CODE_ALERT_EMAIL || "contact@lifelinehealth.is";
/** Warn when fewer than this many codes are left for a kind. */
export const LOW_STOCK = 100;

export type ClaimResult =
  | { code: string; source: "pool" }
  | { code: null; source: "empty" | "error" };

/** One code for a paid order. Idempotent: the same order gets the same code. */
export async function claimActivationCode(orderId: string, clientId: string, kind: string): Promise<ClaimResult> {
  const { data, error } = await supabaseAdmin.rpc("hc_claim_activation_code", { p_order: orderId, p_client: clientId, p_kind: kind });
  if (error) {
    console.error("[code-pool] claim failed", error.message);
    return { code: null, source: "error" };
  }
  if (typeof data === "string" && data) {
    void warnIfLow(kind);
    return { code: data, source: "pool" };
  }
  void alertEmpty(kind, orderId);
  return { code: null, source: "empty" };
}

/** Void the code issued to an order (refund/cancel). Returns the code for Medalia, or null. */
export async function voidActivationCode(orderId: string, reason: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("hc_void_activation_code", { p_order: orderId, p_reason: reason });
  if (error) { console.error("[code-pool] void failed", error.message); return null; }
  return typeof data === "string" ? data : null;
}

export interface StockRow { kind: string; available: number; issued: number; void: number }

export async function codeStock(): Promise<StockRow[] | null> {
  const { data, error } = await supabaseAdmin.rpc("hc_activation_code_stock");
  if (error) return null;
  return ((data ?? []) as StockRow[]).map((r) => ({ kind: r.kind, available: Number(r.available), issued: Number(r.issued), void: Number(r.void) }));
}

/** Available codes for a kind: its own pool plus codes valid for any kind. */
async function availableFor(kind: string): Promise<number | null> {
  const rows = await codeStock();
  if (!rows) return null;
  return rows.filter((r) => r.kind === kind || r.kind === "*").reduce((n, r) => n + r.available, 0);
}

/** At most one alert per kind per day, recorded in hc_audit. */
async function alertedRecently(action: string, kind: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await supabaseAdmin.from("hc_audit").select("id", { count: "exact", head: true })
    .eq("actor", "system:code-pool").eq("action", action).gte("created_at", since).contains("detail", { kind });
  return (count ?? 0) > 0;
}

async function warnIfLow(kind: string) {
  const left = await availableFor(kind);
  if (left == null || left >= LOW_STOCK || (await alertedRecently("code_pool_low", kind))) return;
  await hcAudit("system:code-pool", "code_pool_low", null, { kind, left });
  await sendEmail({
    to: ALERT_TO,
    subject: `Virkjunarkóðar að klárast: ${left} eftir (${kind})`,
    html: renderBrandedEmail({
      title: "Virkjunarkóðar að klárast",
      bodyHtml: `<p style="margin:0 0 12px;">Aðeins <strong>${left}</strong> virkjunarkóðar eru eftir fyrir <strong>${kind}</strong>. Biðjið Medalia um nýja lotu og flytjið hana inn undir Heilsuferð → Virkjunarkóðar.</p>`,
    }),
    text: `Aðeins ${left} virkjunarkóðar eru eftir fyrir ${kind}. Biðjið Medalia um nýja lotu og flytjið hana inn undir Heilsuferð → Virkjunarkóðar.`,
  });
}

async function alertEmpty(kind: string, orderId: string) {
  await hcAudit("system:code-pool", "code_pool_empty", null, { kind, order_id: orderId });
  if (await alertedRecently("code_pool_empty_mail", kind)) return;
  await hcAudit("system:code-pool", "code_pool_empty_mail", null, { kind });
  await sendEmail({
    to: ALERT_TO,
    subject: `ENGIR virkjunarkóðar eftir (${kind}) — greitt án kóða`,
    html: renderBrandedEmail({
      title: "Virkjunarkóðar búnir",
      bodyHtml: `<p style="margin:0 0 12px;">Greidd pöntun fékk engan virkjunarkóða því lotan fyrir <strong>${kind}</strong> er tóm. Viðskiptavinurinn veit að kóðinn er á leiðinni. Flytjið inn nýja lotu frá Medalia; pantanir sem bíða fá kóða sjálfkrafa við innflutninginn.</p>`,
    }),
    text: `Greidd pöntun fékk engan virkjunarkóða (${kind}): lotan er tóm. Flytjið inn nýja lotu frá Medalia; pantanir sem bíða fá kóða sjálfkrafa.`,
  });
}

/** The customer email carrying the code (checkout and late assignment share it). */
export function codeEmail(opts: { pkgName: string; kind: string; code: string; origin: string }) {
  const what = opts.kind === "health_check" || opts.kind === "reevaluation" ? "heilsufarsskoðunina" : "eftirfylgdina";
  return {
    subject: `Virkjunarkóðinn þinn: ${opts.code}`,
    html: renderBrandedEmail({
      title: `${opts.pkgName} er greidd`,
      accentLabel: "Næsta skref",
      preheader: `Virkjunarkóði: ${opts.code}`,
      bodyHtml: `<p style="margin:0 0 12px;">Takk fyrir. Næsta skref er að virkja ${what} í sjúklingagáttinni (Medalia) með þessum kóða:</p>
        <div style="font-family:ui-monospace,monospace;font-size:26px;letter-spacing:.12em;text-align:center;background:#ECFDF5;border-radius:10px;padding:16px;margin:16px 0;color:#065F46;font-weight:700;">${opts.code}</div>
        <p style="margin:0;">Þú finnur kóðann líka alltaf í heilsuferðinni í appinu.</p>`,
      ctaLabel: "Opna heilsuferðina",
      ctaUrl: `${opts.origin}/app`,
    }),
    text: `${opts.pkgName} er greidd. Virkjunarkóðinn þinn er ${opts.code}. Sláðu hann inn í sjúklingagáttinni (Medalia). Opnaðu heilsuferðina: ${opts.origin}/app`,
  };
}

/**
 * Paid orders still waiting for a code get one now — run after an import.
 * Emails each customer their code. Returns how many were assigned.
 */
export async function assignPendingCodes(origin: string): Promise<{ assigned: number; still_waiting: number }> {
  const { data: orders } = await supabaseAdmin.from("hc_orders")
    .select("id, client_id, kind, package_key").eq("status", "paid").is("activation_code", null)
    .order("paid_at", { ascending: true }).limit(500);
  let assigned = 0, waiting = 0;
  for (const o of orders ?? []) {
    const r = await claimActivationCode(o.id, o.client_id, o.kind);
    if (!r.code) { waiting++; continue; }
    await supabaseAdmin.from("hc_orders").update({ activation_code: r.code }).eq("id", o.id).is("activation_code", null);
    const [{ data: pkg }, { data: au }] = await Promise.all([
      supabaseAdmin.from("hc_packages").select("name").eq("key", o.package_key).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(o.client_id),
    ]);
    if (au?.user?.email) {
      await sendEmail({ to: au.user.email, ...codeEmail({ pkgName: pkg?.name ?? "Pöntunin", kind: o.kind, code: r.code, origin }) });
    }
    await hcAudit("system:code-pool", "code_assigned_late", null, { order_id: o.id });
    assigned++;
  }
  return { assigned, still_waiting: waiting };
}
