/**
 * Rapyd / Teya Payment Webhook Handler
 *
 * This Supabase Edge Function receives payment webhooks from Rapyd (or Teya)
 * and updates the subscriptions table accordingly.
 *
 * DEPLOYMENT:
 *   1. Install the Supabase CLI: npm i -g supabase
 *   2. Link your project:        supabase link --project-ref cfnibfxzltxiriqxvvru
 *   3. Set secrets:
 *        supabase secrets set RAPYD_WEBHOOK_SECRET=your_webhook_secret
 *   4. Deploy:
 *        supabase functions deploy rapyd-webhook --no-verify-jwt
 *
 *   The function will be available at:
 *   https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/rapyd-webhook
 *
 *   Configure this URL as the webhook endpoint in your Rapyd/Teya dashboard.
 *
 * WEBHOOK EVENTS HANDLED:
 *   - payment.completed  — activate or renew a subscription
 *   - payment.failed     — mark subscription as past_due
 *   - subscription.cancelled — cancel subscription
 *
 * SIGNATURE VERIFICATION:
 *   Rapyd signs webhooks with HMAC-SHA256. The signature is sent in the
 *   `x-rapyd-signature` header. Verify it against your webhook secret.
 *   For Teya, the header is `x-teya-signature` — adjust as needed.
 */

// @ts-ignore — Deno imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore — Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — Deno imports
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

// ─── Tier Mapping ────────────────────────────────────────────
// Map Rapyd/Teya payment amounts (ISK) to subscription tiers.
// Adjust these amounts to match your actual pricing.
const AMOUNT_TO_TIER: Record<number, string> = {
  9900: "self-maintained",
  29900: "premium",
};

function mapAmountToTier(amountISK: number): string | null {
  return AMOUNT_TO_TIER[amountISK] ?? null;
}

// ─── Signature Verification ──────────────────────────────────

function verifySignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  try {
    const expected = hmac("sha256", secret, body, "utf8", "hex");
    // Constant-time comparison to prevent timing attacks
    if (expected.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

// ─── Main Handler ────────────────────────────────────────────

serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // Verify webhook signature
  // @ts-ignore — Deno.env
  const webhookSecret = Deno.env.get("RAPYD_WEBHOOK_SECRET");
  if (webhookSecret) {
    const signature =
      req.headers.get("x-rapyd-signature") ??
      req.headers.get("x-teya-signature");

    if (!verifySignature(rawBody, signature, webhookSecret)) {
      console.error("[rapyd-webhook] Invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }
  } else {
    console.warn(
      "[rapyd-webhook] RAPYD_WEBHOOK_SECRET not set — skipping signature verification"
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Initialize Supabase client with service role key (full access)
  // @ts-ignore — Deno.env
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // @ts-ignore — Deno.env
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ─── Route by event type ───────────────────────────────────
  // Adjust `payload.event_type` or `payload.type` to match your
  // payment processor's webhook format.
  const eventType =
    (payload.event_type as string) ??
    (payload.type as string) ??
    "unknown";

  console.log(`[rapyd-webhook] Received event: ${eventType}`);

  try {
    switch (eventType) {
      case "payment.completed":
      case "PAYMENT_COMPLETED": {
        // Extract payment details — adjust field names to match your processor
        const amount =
          (payload.amount as number) ??
          ((payload.data as Record<string, unknown>)?.amount as number) ??
          0;
        const customerEmail =
          (payload.customer_email as string) ??
          ((payload.data as Record<string, unknown>)?.customer_email as string) ??
          "";

        const tier = mapAmountToTier(amount);
        if (!tier) {
          console.warn(`[rapyd-webhook] Unknown amount: ${amount}`);
          return new Response(
            JSON.stringify({ ok: false, error: "Unknown payment amount" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Find client by email
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id")
          .eq("email", customerEmail)
          .single();

        if (clientError || !client) {
          console.error(
            `[rapyd-webhook] Client not found for email: ${customerEmail}`
          );
          return new Response(
            JSON.stringify({ ok: false, error: "Client not found" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Cancel any existing active subscriptions
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("client_id", client.id)
          .eq("status", "active");

        // Create new active subscription
        const now = new Date().toISOString();
        const periodEnd = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString();

        const { error: subError } = await supabase
          .from("subscriptions")
          .insert({
            client_id: client.id,
            tier,
            status: "active",
            current_period_start: now,
            current_period_end: periodEnd,
            trial_ends_at: null,
          });

        if (subError) {
          console.error(
            `[rapyd-webhook] Failed to create subscription: ${subError.message}`
          );
          return new Response(
            JSON.stringify({ ok: false, error: subError.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        console.log(
          `[rapyd-webhook] Activated ${tier} subscription for ${customerEmail}`
        );
        break;
      }

      case "payment.failed":
      case "PAYMENT_FAILED": {
        const customerEmail =
          (payload.customer_email as string) ??
          ((payload.data as Record<string, unknown>)?.customer_email as string) ??
          "";

        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("email", customerEmail)
          .single();

        if (client) {
          // Mark the active subscription as expired so the client
          // knows their payment didn't go through
          await supabase
            .from("subscriptions")
            .update({ status: "expired" })
            .eq("client_id", client.id)
            .eq("status", "active");

          console.log(
            `[rapyd-webhook] Marked subscription expired for ${customerEmail} due to payment failure`
          );
        }
        break;
      }

      case "subscription.cancelled":
      case "SUBSCRIPTION_CANCELLED": {
        const customerEmail =
          (payload.customer_email as string) ??
          ((payload.data as Record<string, unknown>)?.customer_email as string) ??
          "";

        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("email", customerEmail)
          .single();

        if (client) {
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("client_id", client.id)
            .eq("status", "active");

          console.log(
            `[rapyd-webhook] Cancelled subscription for ${customerEmail}`
          );
        }
        break;
      }

      default:
        console.log(`[rapyd-webhook] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`[rapyd-webhook] Error processing webhook:`, err);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
