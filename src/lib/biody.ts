import { createHmac } from "crypto";
import { supabaseAdmin } from "./supabase-admin";

const BIODY_SYNC_URL = process.env.BIODY_SYNC_URL ||
  "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/biody-sync";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const B2B_SIGNING_SECRET = process.env.B2B_BIODY_SIGNING_SECRET;

/**
 * Build headers for a server-to-biody-sync call.
 *
 * When B2B_BIODY_SIGNING_SECRET is set (production posture), we send only
 * the HMAC signature — the service-role bearer is deliberately omitted so
 * a leaked SUPABASE_SERVICE_ROLE_KEY alone cannot be used to forge calls
 * into biody-sync. biody-sync still requires the service-role key on
 * Supabase's edge transport (`apikey` header), which Supabase Edge
 * Functions need for invocation routing — that's the only place the key
 * is used.
 *
 * When the signing secret is NOT set (transitional / local dev), we fall
 * back to service-role bearer auth on the Authorization header. This is
 * less secure and should not be the production configuration.
 */
export function signBiodyHeaders(bodyText: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (B2B_SIGNING_SECRET) {
    const ts = Math.floor(Date.now() / 1000).toString();
    const mac = createHmac("sha256", B2B_SIGNING_SECRET)
      .update(`${ts}.${bodyText}`)
      .digest("hex");
    h["X-Lifeline-Signature"] = `t=${ts},v1=${mac}`;
    // Supabase edge function transport still requires the apikey header
    // to route the request to the function — but Authorization is *not*
    // sent. biody-sync validates the HMAC before trusting the body.
    if (SERVICE_ROLE_KEY) h.apikey = SERVICE_ROLE_KEY;
  } else if (SERVICE_ROLE_KEY) {
    h.Authorization = `Bearer ${SERVICE_ROLE_KEY}`;
    h.apikey = SERVICE_ROLE_KEY;
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
