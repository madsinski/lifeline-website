// Test codes: internal codes that make one purchase or one subscription
// period free, so staff can run the real flow end to end while card
// payments are closed (and afterwards, without spending money).
//
// Server only. Claimed atomically in the DB (claim_test_code); a purchase
// that fails after the claim releases it (release_test_code). Orders and
// subscriptions paid this way carry provider = 'test_code' and
// provider_reference = the code's id, and no payments row is written, so
// accounting never counts them.
//
// Schema: supabase/migration-test-codes-straumur.sql

import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const TEST_CODE_PROVIDER = "test_code";
export const CHECKIN_ADDON_TARGET = "checkin-doctor-addon";
export const TEST_CODE_INVALID = "Prófunarkóðinn gildir ekki.";

/** Same normalisation as the other codes: upper-case, no spaces. */
export function normaliseTestCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase().replace(/\s+/g, "").slice(0, 40) : "";
}

/** TEST-XXXX-XXXX with an alphabet that cannot be misread (no 0/O, 1/I/L). */
export function generateTestCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  const s = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `TEST-${s.slice(0, 4)}-${s.slice(4)}`;
}

const ATTEMPT_WINDOW_MIN = 10;
const ATTEMPT_LIMIT = 8;

/** Per-person cap on redemption attempts, counted from hc_audit (time column `at`). */
export async function testCodeRateLimited(clientId: string): Promise<boolean> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("hc_audit").select("id", { count: "exact", head: true })
    .eq("actor", `self:${clientId}`).eq("action", "test_code_try").gte("at", since);
  await supabaseAdmin.from("hc_audit").insert({ actor: `self:${clientId}`, action: "test_code_try", journey_id: null, detail: {} })
    .then(() => {}, () => {});
  return (count ?? 0) >= ATTEMPT_LIMIT;
}

export interface TestCodeClaim { useId: string; codeId: string }

/**
 * Claim a code for one purchase. Returns null when it is not usable for
 * this (unknown, used, revoked, expired, wrong scope or package) — one
 * answer for all of them.
 */
export async function claimTestCode(raw: unknown, clientId: string, scope: "purchase" | "subscription", target: string): Promise<TestCodeClaim | null> {
  const code = normaliseTestCode(raw);
  if (!code) return null;
  const { data: useId, error } = await supabaseAdmin.rpc("claim_test_code", {
    p_code: code, p_client: clientId, p_scope: scope, p_target: target,
  });
  if (error) { console.error("[test-code] claim failed", error.message); return null; }
  if (!useId) return null;
  const { data: use } = await supabaseAdmin.from("hc_test_code_uses").select("code_id").eq("id", useId as string).maybeSingle();
  if (!use) return null;
  return { useId: useId as string, codeId: use.code_id as string };
}

/** Undo a claim; a no-op once the use is attached to an order or subscription. */
export async function releaseTestCode(claim: TestCodeClaim | null): Promise<void> {
  if (!claim) return;
  const { error } = await supabaseAdmin.rpc("release_test_code", { p_use: claim.useId });
  if (error) console.error("[test-code] release failed", error.message);
}

/** Tie the use (and, for the record, the code) to what it paid for. */
export async function attachTestCode(claim: TestCodeClaim, ref: { orderId?: string; subscriptionId?: string }): Promise<void> {
  await supabaseAdmin.from("hc_test_code_uses")
    .update({ order_id: ref.orderId ?? null, subscription_id: ref.subscriptionId ?? null }).eq("id", claim.useId);
  await supabaseAdmin.from("hc_test_codes")
    .update(ref.orderId ? { used_order_id: ref.orderId } : { used_subscription_id: ref.subscriptionId ?? null })
    .eq("id", claim.codeId);
}
