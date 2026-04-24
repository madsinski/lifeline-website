import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

// Tiny audit helper. Call from any admin route after the action
// succeeded. Never throws — audit failures must not block the request.
// The admin_actions RLS blocks client-side inserts, so this only works
// from server code via the service role.
//
// Usage:
//   await logAdminAction(req, { actor, action: "company.invoice.create",
//     target_type: "company", target_id: companyId, detail: { amount, quantity } });

type Actor = {
  id?: string | null;
  email?: string | null;
};

type Input = {
  actor?: Actor | null;
  action: string;                   // "company.invoice.create", "bulk_create.submit", etc.
  target_type?: string | null;
  target_id?: string | null;
  detail?: Record<string, unknown> | null;
};

export async function logAdminAction(req: NextRequest | null, input: Input) {
  try {
    const ip = req?.headers.get("x-forwarded-for")?.split(",")[0].trim()
      || req?.headers.get("x-real-ip")?.trim()
      || null;
    const ua = req?.headers.get("user-agent") || null;
    await supabaseAdmin.from("admin_actions").insert({
      actor_id: input.actor?.id || null,
      actor_email: input.actor?.email || null,
      action: input.action,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      detail: input.detail ?? null,
      ip,
      user_agent: ua,
    });
  } catch (e) {
    // Swallow — never break a successful action because the audit
    // log couldn't be written. Still surface to server logs so we
    // can track audit-pipeline health.
    console.error("[audit] write failed", input.action, e);
  }
}
