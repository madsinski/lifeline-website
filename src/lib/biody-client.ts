// Direct Biody Manager REST API client for on-demand reads.
//
// Why not go through the existing biody-sync edge function?
// Because biody-sync is push-only (we tell it to create a patient, it
// pushes to Biody). This client is pull: a user opens their dashboard,
// we fetch their measurements live, render, never persist. Different
// trust + caching needs, so it's its own module.
//
// Auth model: Biody auth is business-credentials-based (not per-patient
// OAuth). Lifeline backend logs in once with BIODY_EMAIL + BIODY_PASSWORD,
// caches the bearer token in module memory, and refreshes when it nears
// expiry. The security boundary is in our API route, which must scope
// every request to clients.biody_patient_id of the calling user.

const BIODY_BASE = process.env.BIODY_API_BASE || "https://www.biodymanager.com";
const BIODY_EMAIL = process.env.BIODY_EMAIL;
const BIODY_PASSWORD = process.env.BIODY_PASSWORD;
const BIODY_LOCALE = process.env.BIODY_LOCALE || "en";

interface CachedToken {
  token: string;
  expiresAt: number; // ms epoch
}

let cached: CachedToken | null = null;

async function login(): Promise<CachedToken> {
  if (!BIODY_EMAIL || !BIODY_PASSWORD) {
    throw new Error("BIODY_EMAIL / BIODY_PASSWORD not configured in env");
  }
  const res = await fetch(`${BIODY_BASE}/api/login_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: BIODY_EMAIL, password: BIODY_PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Biody login failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { token: string; user?: { tokenTtl?: number } };
  if (!data.token) throw new Error("Biody login: no token in response");

  // tokenTtl is in seconds; default to 1 hour if absent. Refresh 60s early.
  const ttlSec = Math.max(60, (data.user?.tokenTtl ?? 3600) - 60);
  return {
    token: data.token,
    expiresAt: Date.now() + ttlSec * 1000,
  };
}

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  cached = await login();
  return cached.token;
}

interface BiodyHttpOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number>;
  body?: unknown;
}

async function biodyFetch(path: string, opts: BiodyHttpOptions = {}): Promise<unknown> {
  const token = await getToken();
  const url = new URL(path, BIODY_BASE);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "BM-Application": "PartnerApp",
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    // Token may have been invalidated server-side — drop cache and retry once.
    cached = null;
    const retry = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "BM-Application": "PartnerApp",
        "Content-Type": "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!retry.ok) {
      const body = await retry.text().catch(() => "");
      throw new Error(`Biody ${path} failed after re-auth: ${retry.status} ${body.slice(0, 200)}`);
    }
    return retry.json();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Biody ${path} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────

export interface BiodyMeasurement {
  id: number;
  status: string;
  device_date: string | null;
  created_at: string;
  weight: number | null;
  height: number | null;
  phase_angle: number | null;
  bcm: string | null;          // body cell mass
  mms_kg: string | null;        // muscle mass kg
  fm_kg: string | null;         // fat mass kg
  fm_hc_pc: string | null;      // fat mass percentage
  ffw_pc: string | null;        // free fat water percentage
  tbw: string | null;           // total body water
  ecw_pc: string | null;        // extracellular water %
  icw_pc: string | null;        // intracellular water %
  bmr: string | null;           // basal metabolic rate
  whr: string | null;           // waist-to-hip ratio
  whtr: string | null;          // waist-to-height ratio
  patient?: { id: number };
}

interface BiodyMeasurementsResponse {
  inlineCount: number;
  results: BiodyMeasurement[];
}

export async function getPatientMeasurements(
  biodyPatientId: number,
  opts: { limit?: number; offset?: number } = {},
): Promise<BiodyMeasurement[]> {
  const data = (await biodyFetch(`/${BIODY_LOCALE}/api/measurements`, {
    query: {
      "filters[measurement.patient]": biodyPatientId,
      "filters[measurement.status]": "Analyzed",
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
      "order_by[measurement.msrDate]": "desc",
    },
  })) as BiodyMeasurementsResponse;
  return data.results || [];
}

export interface BiodyPatient {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string;
  height: number | null;
  uuid: string | null;
}

export async function getPatient(biodyPatientId: number): Promise<BiodyPatient | null> {
  const data = await biodyFetch(`/${BIODY_LOCALE}/api/patients/${biodyPatientId}`);
  return data as BiodyPatient;
}

// Lightweight summary helper — converts the verbose Biody payload into
// the fields the dashboard actually displays.
export interface BodyCompSummary {
  measuredAt: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  body_water_pct: number | null;
  phase_angle: number | null;
  bmr_kcal: number | null;
  waist_to_hip: number | null;
}

export function summariseMeasurement(m: BiodyMeasurement): BodyCompSummary {
  const num = (s: string | null | undefined) => (s ? parseFloat(s) : null);
  return {
    measuredAt: m.device_date || m.created_at,
    weight_kg: typeof m.weight === "number" ? m.weight / 100 : null, // weight stored in centikg per docs
    body_fat_pct: num(m.fm_hc_pc),
    muscle_mass_kg: num(m.mms_kg),
    body_water_pct: num(m.ffw_pc),
    phase_angle: typeof m.phase_angle === "number" ? m.phase_angle / 10 : null,
    bmr_kcal: num(m.bmr),
    waist_to_hip: num(m.whr),
  };
}
