// What happens once a purchase is paid for — by a verified Straumur payment,
// by an employer/union covering all of it, or by a test code.
//
// Lifted out of /api/hc/checkout and /api/hc/subscribe so the same code runs
// right away (nothing to charge) and later from the Straumur webhook
// (src/app/api/straumur/webhook/route.ts). The pricing is decided before
// any of this and passed in; nothing here reads a price from a request.
//
// Server only.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { claimActivationCode, codeEmail } from "@/lib/hc/code-pool";
import { currentJourney, getOrCreateJourney, hcAudit, patchJourney, refreshStage } from "@/lib/hc/server";
import { AFTER_PURCHASE, isStandaloneKind } from "@/lib/hc/shop";
import type { HcJourney, HcPackage, PaymentRoute } from "@/lib/hc/types";
import type { Quote } from "@/lib/hc/reimbursement";
import { recordWaiver } from "@/lib/hc/waiver";
import { redeem } from "@/lib/hc/discount";
import { isMissingSchema, TRIAL_TIER, warnOnce } from "@/lib/hc/subscription";
import { COACHING_TIER, tierForPackage, type SubscriptionPackageKey } from "@/lib/hc/coaching-config";
import { assignCoachIfNone } from "@/lib/hc/coaching";
import { markRequestUsed } from "@/lib/hc/coaching-requests";

export type Provider = "straumur" | "company_invoice" | "test_code" | null;

/** One line in the payments ledger, which is what accounting counts as B2C income. */
export async function recordStraumurPayment(args: {
  clientId: string; amountIsk: number; description: string; payfacReference: string;
  relatedType: "hc_order" | "subscription" | "checkin_doctor_addon"; relatedId: string;
}) {
  const { data: c } = await supabaseAdmin.from("clients_decrypted").select("company_id").eq("id", args.clientId).maybeSingle();
  const { error } = await supabaseAdmin.from("payments").insert({
    owner_type: "client",
    owner_id: args.clientId,
    owner_company_id: (c?.company_id as string | null) ?? null,
    amount_isk: args.amountIsk,
    currency: "ISK",
    description: args.description,
    provider: "straumur",
    provider_reference: args.payfacReference,
    status: "succeeded",
    related_type: args.relatedType,
    related_id: args.relatedId,
    paid_at: new Date().toISOString(),
  });
  // 23505: already recorded (a retried webhook) — fine.
  if (error && error.code !== "23505") console.error("[fulfil] payments row not written", error.message);
}

// ── Orders (/api/hc/checkout) ─────────────────────────────────────────

export interface OrderContext {
  clientId: string;
  email: string;
  packageKey: string;
  route: PaymentRoute;
  union: { id: string; name: string; settlement: "reimbursement" | "direct" } | null;
  company: { id: string; codeId: string } | null;
  priceIsk: number;
  quote: Pick<Quote, "chargedIsk" | "reimbursementIsk" | "directGrantIsk" | "employerIsk">;
  waiverAt: string | null;
  provider: Provider;
  providerReference: string | null;
  origin: string;
}

export async function fulfilOrder(ctx: OrderContext): Promise<{ order: Record<string, unknown>; journey: HcJourney }> {
  const { data: pkgRow } = await supabaseAdmin.from("hc_packages").select("*").eq("key", ctx.packageKey).maybeSingle();
  const pkg = pkgRow as HcPackage | null;
  if (!pkg) throw new Error("package_not_found");
  const standalone = isStandaloneKind(pkg.kind);
  const actor = `client:${ctx.clientId}`;
  let journey = (await currentJourney(ctx.clientId)) ?? (await getOrCreateJourney(ctx.clientId));

  // Re-evaluation starts a new cycle: close the old journey, open a fresh one.
  if (pkg.kind === "reevaluation") {
    await patchJourney(journey.id, { completed_at: new Date().toISOString() }, actor, "journey_completed_by_reevaluation");
    const { data: fresh, error } = await supabaseAdmin.from("hc_journeys").insert({
      client_id: ctx.clientId,
      location_id: journey.location_id,
      entry: journey.entry,
      company_id: journey.company_id,
      profile_completed_at: new Date().toISOString(),
      welcome_seen_at: new Date().toISOString(),
    }).select("*").single();
    if (error || !fresh) throw new Error("journey_create_failed");
    journey = fresh as HcJourney;
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await supabaseAdmin.from("hc_orders").insert({
    journey_id: journey.id,
    client_id: ctx.clientId,
    package_key: pkg.key,
    kind: pkg.kind,
    price_isk: ctx.priceIsk,
    payment_route: ctx.route,
    union_id: ctx.union?.id ?? null,
    union_reimbursement_isk: ctx.quote.reimbursementIsk,
    union_direct_grant_isk: ctx.quote.directGrantIsk,
    company_id: ctx.company?.id ?? null,
    company_code_id: ctx.company?.codeId ?? null,
    amount_charged_isk: ctx.quote.chargedIsk,
    provider: ctx.provider,
    company_contribution_isk: ctx.quote.employerIsk,
    provider_reference: ctx.providerReference,
    status: "paid",
    paid_at: now,
    activation_code: null,
    consent_text: ctx.union?.settlement === "direct" ? `Beingreiðsla: ${ctx.union.name}` : null,
  }).select("*").single();
  if (error || !inserted) throw new Error(error?.message || "order_failed");
  let order: Record<string, unknown> = inserted;

  /* One Medalia code for this order. An empty pool leaves the order paid
     without a code: the customer is told it is on its way, staff are
     alerted, and the next import assigns it. Never an invented code. */
  const claimed = await claimActivationCode(order.id as string, ctx.clientId, pkg.kind);
  if (claimed.code) {
    await supabaseAdmin.from("hc_orders").update({ activation_code: claimed.code }).eq("id", order.id as string);
    order = { ...order, activation_code: claimed.code };
  }
  if (ctx.waiverAt) await recordWaiver("hc_orders", order.id as string, ctx.waiverAt);
  const waiver = ctx.waiverAt
    ? { withdrawal_waiver: true, withdrawal_waiver_recorded_at: ctx.waiverAt }
    : { withdrawal_waiver: false };

  if (ctx.union && ctx.quote.reimbursementIsk > 0) {
    await supabaseAdmin.from("hc_union_claims").insert({
      order_id: order.id,
      union_id: ctx.union.id,
      client_id: ctx.clientId,
      amount_paid_isk: ctx.quote.chargedIsk,
      reimbursable_isk: ctx.quote.reimbursementIsk,
      status: "draft",
    });
  }

  const testFlag = ctx.provider === "test_code" ? { test_code: true } : {};
  if (standalone) {
    /* A product on its own: the journey's stage does not move. */
    await hcAudit(actor, "paid_product", journey.id, { order_id: order.id, kind: pkg.kind, ...waiver, ...testFlag });
  } else if (pkg.kind === "health_check" || pkg.kind === "reevaluation") {
    journey = (await patchJourney(journey.id, {
      paid_at: now,
      ...(ctx.company ? { entry: "b2b" as const, company_id: ctx.company.id }
        /* Bought from the shop on the coaching/app track: paying for the
           check is choosing it, same as choose_track 'check'. */
        : journey.entry === "coach" || journey.entry === "app" ? { entry: "b2c" as const } : {}),
    }, actor, "paid", { order_id: order.id, route: ctx.route, ...waiver, ...testFlag })) ?? journey;
  } else {
    await hcAudit(actor, "paid_followup", journey.id, { order_id: order.id, kind: pkg.kind, ...waiver, ...testFlag });
    journey = await refreshStage(journey);
  }

  // Confirmation email: the code, or word that it is on its way.
  const code = order.activation_code as string | null;
  const next = standalone ? AFTER_PURCHASE[pkg.kind] ?? null : null;
  const where = `${ctx.origin}${standalone ? "/app/eg/thjonusta" : "/app"}`;
  if (ctx.email) {
    if (code) {
      await sendEmail({ to: ctx.email, ...codeEmail({ pkgName: pkg.name, kind: pkg.kind, code, origin: ctx.origin }) });
    } else {
      await sendEmail({
        to: ctx.email,
        subject: `Greiðsla móttekin: ${pkg.name}`,
        html: renderBrandedEmail({
          title: `Greiðsla móttekin: ${pkg.name}`,
          accentLabel: "Næsta skref",
          bodyHtml: `<p style="margin:0 0 12px;">Takk fyrir. Virkjunarkóðinn fyrir sjúklingagáttina (Medalia) berst þér í tölvupósti innan eins virks dags. Þú sérð hann líka ${standalone ? "undir Þjónusta" : "í heilsuferðinni"} í appinu um leið og hann er tilbúinn.</p>${next ? `<p style="margin:0;">${next}</p>` : ""}`,
          ctaLabel: standalone ? "Opna Þjónustu" : "Opna heilsuferðina",
          ctaUrl: where,
        }),
        text: `Greiðsla móttekin: ${pkg.name}. Virkjunarkóðinn berst þér í tölvupósti innan eins virks dags.${next ? ` ${next}` : ""} ${where}`,
      });
    }
  }
  return { order, journey };
}

// ── Subscriptions (/api/hc/subscribe) ─────────────────────────────────

export interface SubscriptionContext {
  clientId: string;
  packageKey: SubscriptionPackageKey;
  priceIsk: number;
  intervalMonths: number;
  chargedIsk: number;
  monthsFree: number;
  discountCode: { code: string; amountOffIsk: number } | null;
  waiverAt: string | null;
  provider: Provider;
  providerReference: string | null;
  coachingRegion?: string | null;
}

const SUB_COLS = "id, tier, status, trial_ends_at, current_period_start, current_period_end";

/**
 * Start the paid period. Works out what it replaces from the rows as they
 * are now (a webhook can arrive minutes after the button was pressed):
 * an active trial is closed, an app-tier row is closed when coaching
 * starts. Paid twice for the same tier (a second tab) extends the period
 * rather than leaving two live rows.
 */
export async function activateSubscription(ctx: SubscriptionContext) {
  const tier = tierForPackage(ctx.packageKey);
  const now = new Date();
  const months = Math.max(1, ctx.intervalMonths) + ctx.monthsFree;
  const { data: live } = await supabaseAdmin.from("subscriptions").select(SUB_COLS)
    .eq("client_id", ctx.clientId).in("status", ["active", "cancelled"]).order("created_at", { ascending: false });
  const rows = (live ?? []) as { id: string; tier: string; status: string; current_period_end: string | null }[];
  const running = (r: { current_period_end: string | null }) => !r.current_period_end || Date.parse(r.current_period_end) > now.getTime();

  const same = rows.find((r) => r.tier === tier && r.status === "active");
  let sub: Record<string, unknown> | null = null;
  if (same) {
    const from = same.current_period_end && Date.parse(same.current_period_end) > now.getTime() ? new Date(same.current_period_end) : now;
    from.setMonth(from.getMonth() + months);
    const { data } = await supabaseAdmin.from("subscriptions")
      .update({ current_period_end: from.toISOString(), provider: ctx.provider, provider_reference: ctx.providerReference })
      .eq("id", same.id).select(SUB_COLS).single();
    sub = data;
  } else {
    const end = new Date(now);
    end.setMonth(end.getMonth() + months);
    const { data, error } = await supabaseAdmin.from("subscriptions").insert({
      client_id: ctx.clientId, tier, status: "active",
      current_period_start: now.toISOString(), current_period_end: end.toISOString(),
      provider: ctx.provider, provider_reference: ctx.providerReference,
    }).select(SUB_COLS).single();
    if (error || !data) throw new Error(error?.message || "subscription_insert_failed");
    sub = data;
  }
  const subId = sub!.id as string;

  const trialRow = rows.find((r) => r.tier === TRIAL_TIER && r.status === "active" && r.id !== subId);
  if (trialRow) await supabaseAdmin.from("subscriptions").update({ status: "expired" }).eq("id", trialRow.id).eq("tier", TRIAL_TIER);
  /* App tier (active, or cancelled with its month still running) → coaching: one live row. */
  const upgradeRow = tier === COACHING_TIER ? rows.find((r) => r.tier !== TRIAL_TIER && r.tier !== tier && running(r)) : undefined;
  if (upgradeRow) {
    await supabaseAdmin.from("subscriptions").update({ status: "expired", current_period_end: now.toISOString() }).eq("id", upgradeRow.id);
  }
  if (ctx.waiverAt) await recordWaiver("subscriptions", subId, ctx.waiverAt);
  const { error: pkErr } = await supabaseAdmin.from("subscriptions").update({ package_key: ctx.packageKey }).eq("id", subId);
  if (pkErr && isMissingSchema(pkErr)) warnOnce("subscriptions.package_key", "subscriptions.package_key missing — run supabase/migration-coaching-tier.sql.");

  if (tier === COACHING_TIER) {
    /* The approval is spent (src/lib/hc/coaching-requests.ts). */
    await markRequestUsed(ctx.clientId, subId).catch((e) =>
      console.error("[hc] coaching request not marked used", e instanceof Error ? e.message : e));
    try {
      const journey = await getOrCreateJourney(ctx.clientId);
      if (journey.entry === "app") {
        await patchJourney(journey.id, { entry: "coach" }, `self:${ctx.clientId}`, "journey_track_coach", { via: "coaching_subscription" });
      }
      const coach = await assignCoachIfNone(journey, ctx.coachingRegion ?? "vestmannaeyjar");
      if (!coach) await hcAudit(`self:${ctx.clientId}`, "coaching_unassigned", journey.id, { subscription_id: subId });
    } catch (e) {
      console.error("[hc] coaching set-up after purchase failed", e instanceof Error ? e.message : e);
    }
  }

  if (ctx.discountCode) {
    await redeem(ctx.discountCode.code, ctx.clientId, "subscription", ctx.discountCode.amountOffIsk, ctx.monthsFree);
  }

  await hcAudit(`self:${ctx.clientId}`, "subscription_started", null, {
    tier, package: ctx.packageKey, price: ctx.priceIsk, replaced: upgradeRow?.id ?? null, charged: ctx.chargedIsk,
    code: ctx.discountCode?.code ?? null, months_free: ctx.monthsFree,
    provider: ctx.provider, test_code: ctx.provider === "test_code",
    extended: !!same,
    withdrawal_waiver: !!ctx.waiverAt, withdrawal_waiver_at: ctx.waiverAt, withdrawal_waiver_recorded_at: ctx.waiverAt,
    replaced_trial: trialRow?.id ?? null,
  });
  return sub!;
}

// ── The check-in doctor add-on (/api/account/checkin-addon) ───────────

export const DOCTOR_ADDON_ISK = 18500;
export const DOCTOR_ADDON_DESCRIPTION = "Lifeline Health — viðtal við lækni (endurmat)";

export async function markCheckinAddonPaid(clientId: string): Promise<string> {
  const paidAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("clients_decrypted").update({ checkin_doctor_addon_paid_at: paidAt }).eq("id", clientId);
  if (error) throw new Error(error.message);
  return paidAt;
}
