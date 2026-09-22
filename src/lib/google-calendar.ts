// Google Calendar — OAuth and the handful of REST calls we make. Ported from
// Fjarlaekningar/src/lib/google-calendar.ts (HSU vaktakerfi). Server-only.
//
// fetch rather than the googleapis SDK: six endpoints do not justify the SDK.
//
// SCOPE. calendar.app.created and nothing else: create one secondary
// calendar, and manage events on calendars this app created. We can never
// read or change the person's own calendar. It is also not a restricted
// scope, so no yearly third-party security assessment.

import { createHmac, timingSafeEqual } from "node:crypto";

const OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
const OAUTH_REVOKE = "https://oauth2.googleapis.com/revoke";
const CAL = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const CALENDAR_TZ = "Atlantic/Reykjavik";

export function googleClientId() { return process.env.GOOGLE_CLIENT_ID ?? ""; }
function googleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ""; }

/** Must match a redirect URI on the OAuth client byte for byte. */
export function googleRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || "https://www.lifelinehealth.is/api/google/callback";
}

/** False until the OAuth client is set up; the UI then offers .ics only. */
export function googleConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret());
}

// ── state: CSRF protection for the round trip ───────────────────────────────
// Signed, carries the owner id and kind — never a session token.

export type CalendarOwnerKind = "client" | "worker";

function stateSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  // An HMAC with an empty key is forgeable: anyone could file Google tokens
  // against any person. Better that connecting fails.
  if (secret.length < 16) throw new Error("GOOGLE_OAUTH_STATE_SECRET missing");
  return secret;
}
const b64u = (b: Buffer) => b.toString("base64url");

/** Only a path on this site — anything else would make the callback an open redirect. */
export function safeReturnPath(p?: string | null): string {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : "";
}

export function signState(ownerId: string, kind: CalendarOwnerKind, returnTo = "", ttlSeconds = 900): string {
  const body = b64u(Buffer.from(JSON.stringify({ o: ownerId, k: kind, r: safeReturnPath(returnTo), exp: Date.now() + ttlSeconds * 1000 })));
  const sig = b64u(createHmac("sha256", stateSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyState(state: string): { ownerId: string; kind: CalendarOwnerKind; returnTo: string } | null {
  const [body, sig] = (state || "").split(".");
  if (!body || !sig) return null;
  const expect = b64u(createHmac("sha256", stateSecret()).update(body).digest());
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { o, k, r, exp } = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof o !== "string" || (k !== "client" && k !== "worker") || typeof exp !== "number" || Date.now() >= exp) return null;
    return { ownerId: o, kind: k, returnTo: safeReturnPath(r) };
  } catch {
    return null;
  }
}

export function consentUrl(ownerId: string, kind: CalendarOwnerKind, returnTo = "", loginHint?: string | null): string {
  const p = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    // offline + consent is what makes Google return a refresh token every time.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: signState(ownerId, kind, returnTo),
  });
  if (loginHint) p.set("login_hint", loginHint);
  return `${OAUTH_AUTH}?${p}`;
}

// ── tokens ──────────────────────────────────────────────────────────────────

export interface TokenResponse { access_token: string; refresh_token?: string; expires_in: number; id_token?: string }

async function tokenCall(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.error || `Google token ${res.status}`);
  return j as TokenResponse;
}

export function exchangeCode(code: string) {
  return tokenCall({ code, client_id: googleClientId(), client_secret: googleClientSecret(), redirect_uri: googleRedirectUri(), grant_type: "authorization_code" });
}

export function refreshAccessToken(refreshToken: string) {
  return tokenCall({ refresh_token: refreshToken, client_id: googleClientId(), client_secret: googleClientSecret(), grant_type: "refresh_token" });
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${OAUTH_REVOKE}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {});
}

/** sub/email from the id_token, unverified — it came straight from Google's token endpoint; display only. */
export function readIdToken(idToken?: string): { sub?: string; email?: string } {
  if (!idToken) return {};
  try {
    const p = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
    return { sub: p.sub, email: p.email };
  } catch {
    return {};
  }
}

// ── calendar ────────────────────────────────────────────────────────────────

async function api(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${CAL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export class GoogleApiError extends Error {
  constructor(message: string, readonly status: number, readonly body = "") {
    super(message);
    this.name = "GoogleApiError";
  }
  get isAuthFailure() { return this.status === 401 || this.status === 403; }
  get isGone() { return this.status === 404 || this.status === 410; }
}

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new GoogleApiError(`${what} (${res.status})`, res.status, await res.text().catch(() => ""));
  return res.json() as Promise<T>;
}

export async function createCalendar(token: string, name: string): Promise<string> {
  const r = await api(token, "/calendars", { method: "POST", body: JSON.stringify({ summary: name, timeZone: CALENDAR_TZ }) });
  return (await json<{ id: string }>(r, "Could not create calendar")).id;
}

export async function deleteCalendar(token: string, calendarId: string): Promise<void> {
  const r = await api(token, `/calendars/${encodeURIComponent(calendarId)}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404 && r.status !== 410) throw new GoogleApiError(`Could not delete calendar (${r.status})`, r.status);
}

export async function getCalendar(token: string, calendarId: string): Promise<{ id: string } | null> {
  const r = await api(token, `/calendars/${encodeURIComponent(calendarId)}`);
  if (r.status === 404 || r.status === 410) return null;
  return json<{ id: string }>(r, "Could not read calendar");
}

export function insertEvent(token: string, calendarId: string, body: unknown) {
  return api(token, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(body) })
    .then((r) => json<{ id: string }>(r, "Could not create event"));
}

export function patchEvent(token: string, calendarId: string, eventId: string, body: unknown) {
  return api(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body: JSON.stringify(body) })
    .then((r) => json<{ id: string }>(r, "Could not update event"));
}

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  const r = await api(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  // Already gone is success — the person may have deleted it by hand.
  if (!r.ok && r.status !== 404 && r.status !== 410) throw new GoogleApiError(`Could not delete event (${r.status})`, r.status);
}
