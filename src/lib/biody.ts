import { createHmac } from "crypto";
import { supabaseAdmin } from "./supabase-admin";

const BIODY_SYNC_URL = process.env.BIODY_SYNC_URL ||
  "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/biody-sync";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const B2B_SIGNING_SECRET = process.env.B2B_BIODY_SIGNING_SECRET;

/**
 * Build headers for a server-to-biody-sync call.
 *
 * biody-sync is a JWT-verified Supabase Edge Function, so the request must
 * carry a valid service-role bearer on the `Authorization` header just to
 * be *invoked* — without it the platform gateway rejects the call with
 * "Missing authorization header" before any function code runs. The
 * `apikey` header is sent alongside for edge transport routing.
 *
 * The bearer alone is NOT trusted: when B2B_BIODY_SIGNING_SECRET is set,
 * biody-sync additionally requires a valid HMAC signature bound to the
 * timestamp + body. So the HMAC is *additive* to the bearer, not a
 * replacement for it — a leaked SUPABASE_SERVICE_ROLE_KEY alone still
 * cannot forge a call, because the request is rejected
 * (`hmac_signature_invalid` / `no_hmac_header...`) without the secret.
 *
 * (An earlier revision dropped the bearer whenever the secret was set, on
 * the theory that the HMAC replaced it. That broke every signed call: the
 * JWT gate fires first, so the HMAC code was never reached. Both headers
 * are required.)
 */
export function signBiodyHeaders(bodyText: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Service-role bearer — required by the Edge Function JWT gate to invoke
  // biody-sync at all. Not sufficient on its own (see HMAC below).
  if (SERVICE_ROLE_KEY) {
    h.Authorization = `Bearer ${SERVICE_ROLE_KEY}`;
    h.apikey = SERVICE_ROLE_KEY;
  }
  // HMAC signature — the real anti-forgery gate. biody-sync verifies this
  // over `${ts}.${body}` and rejects the call if it's missing or wrong.
  if (B2B_SIGNING_SECRET) {
    const ts = Math.floor(Date.now() / 1000).toString();
    const mac = createHmac("sha256", B2B_SIGNING_SECRET)
      .update(`${ts}.${bodyText}`)
      .digest("hex");
    h["X-Lifeline-Signature"] = `t=${ts},v1=${mac}`;
  }
  return h;
}

export interface ActivateResult {
  ok: boolean;
  existing?: boolean;
  biody_patient_id?: number | string;
  biody_uuid?: string | null;
  error?: string;
  detail?: unknown;
}

/**
 * Server-side: ensure a client has a Biody patient record.
 * Idempotent — if already linked, returns { existing: true }.
 * Caller must already have authorised the access.
 */
export async function activateBiodyForClient(clientId: string): Promise<ActivateResult> {
  if (!SERVICE_ROLE_KEY) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not set" };
  }

  const { data: client, error: clientErr } = await supabaseAdmin
    .from("clients_decrypted")
    .select("id, full_name, date_of_birth, height_cm, activity_level, sex, biody_patient_id, biody_uuid")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client) {
    return { ok: false, error: "client_not_found", detail: clientErr?.message };
  }
  if (client.biody_patient_id) {
    return {
      ok: true,
      existing: true,
      biody_patient_id: client.biody_patient_id,
      biody_uuid: client.biody_uuid ?? null,
    };
  }

  // M3: Atomically claim the right to activate this client. Prevents two
  // concurrent requests from each creating a duplicate Biody patient.
  const { data: claimed } = await supabaseAdmin.rpc("claim_biody_activation", {
    p_client_id: clientId,
  });
  if (claimed !== true) {
    return { ok: false, error: "activation_in_progress", detail: "Another request is activating this client" };
  }

  const parts = (client.full_name || "").split(" ").filter(Boolean);
  const firstName = parts[0] || client.full_name || "User";
  const lastName = parts.slice(1).join(" ") || "-";

  const missing: string[] = [];
  if (!client.date_of_birth) missing.push("date_of_birth");
  if (!client.sex) missing.push("sex");
  if (!client.height_cm) missing.push("height_cm");
  if (!client.activity_level) missing.push("activity_level");
  if (missing.length) {
    // Release the claim we just took — otherwise this client is wedged
    // ("activation_in_progress") for the next 2 minutes even though we
    // never called biody-sync.
    await supabaseAdmin.rpc("release_biody_activation", { p_client_id: clientId });
    return { ok: false, error: "missing_client_fields", detail: missing };
  }

  try {
    const bodyText = JSON.stringify({
      client_id: clientId,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: client.date_of_birth,
      sex: client.sex,
      height_cm: Number(client.height_cm),
      activity_level: client.activity_level,
    });
    const res = await fetch(`${BIODY_SYNC_URL}/create-patient`, {
      method: "POST",
      headers: signBiodyHeaders(bodyText),
      body: bodyText,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      await supabaseAdmin.rpc("release_biody_activation", { p_client_id: clientId });
      return { ok: false, error: "biody_sync_error", detail: json };
    }
    // biody-sync persists biody_patient_id itself; release the claim so the
    // column isn't left with a stale in-progress marker.
    await supabaseAdmin.rpc("release_biody_activation", { p_client_id: clientId });
    return {
      ok: true,
      biody_patient_id: json?.biody_patient_id,
      biody_uuid: json?.biody_uuid ?? null,
    };
  } catch (e) {
    await supabaseAdmin.rpc("release_biody_activation", { p_client_id: clientId });
    return { ok: false, error: (e as Error).message };
  }
}
