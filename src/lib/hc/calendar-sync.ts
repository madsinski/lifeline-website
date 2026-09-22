// Google Calendar push sync for the heilsuferð — the reconcile engine from
// Fjarlaekningar/src/lib/calendar-sync.ts (HSU vaktakerfi), adapted from
// all-day shifts to timed appointments.
//
// RECONCILE, not an event stream: each call compares the person's
// appointments with what we already wrote, and fixes the difference. A failed
// call heals itself on the next change. Event ids derive from journey + kind,
// so writes are idempotent — the same appointment twice is one event.
//
// "Instant": patchJourney() schedules syncForJourney() with after() on every
// change, so Google is updated seconds after a booking, reschedule or
// completion. Server-only.

import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as G from "@/lib/google-calendar";
import { clientAppointments, workerAppointments, windowStart, type CalItem } from "./appointments";

export type OwnerKind = G.CalendarOwnerKind;

export const CALENDAR_NAMES: Record<OwnerKind, string> = {
  client: "Lifeline — heilsuferð",
  worker: "Lifeline — viðtöl",
};

export interface GoogleSyncRow {
  owner_kind: OwnerKind;
  owner_id: string;
  google_email: string | null;
  refresh_token: string | null;
  access_token: string | null;
  access_expires_at: string | null;
  calendar_id: string | null;
  enabled: boolean;
  connected_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
}

export interface SyncResult { skipped?: string; written?: number; removed?: number; error?: string }

const itemsFor = (kind: OwnerKind, id: string) => (kind === "client" ? clientAppointments(id) : workerAppointments(id));

function hashOf(i: CalItem): string {
  return createHash("sha256")
    .update([i.start, i.minutes, i.summary, i.description, i.location ?? "", i.reminderMinutes ?? ""].join("|"))
    .digest("hex").slice(0, 16);
}

function bodyOf(i: CalItem) {
  const end = new Date(new Date(i.start).getTime() + i.minutes * 60_000).toISOString();
  return {
    summary: i.summary,
    description: i.description,
    location: i.location ?? undefined,
    start: { dateTime: i.start, timeZone: G.CALENDAR_TZ },
    end: { dateTime: end, timeZone: G.CALENDAR_TZ },
    reminders: i.reminderMinutes
      ? { useDefault: false, overrides: [{ method: "popup", minutes: i.reminderMinutes }] }
      : { useDefault: false },
    extendedProperties: { private: { lifelineItem: i.id } },
  };
}

export async function getSync(kind: OwnerKind, ownerId: string): Promise<GoogleSyncRow | null> {
  const { data } = await supabaseAdmin.from("hc_google_sync").select("*").eq("owner_kind", kind).eq("owner_id", ownerId).maybeSingle();
  return (data as GoogleSyncRow) ?? null;
}

async function noteError(kind: OwnerKind, ownerId: string, message: string, clearToken = false) {
  await supabaseAdmin.from("hc_google_sync").update({
    last_error: message.slice(0, 500),
    last_error_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(clearToken ? { refresh_token: null, access_token: null, access_expires_at: null } : {}),
  }).eq("owner_kind", kind).eq("owner_id", ownerId);
}

/** A usable access token; refreshes a spent one (a minute of slack). */
async function accessTokenFor(row: GoogleSyncRow): Promise<string> {
  const fresh = row.access_token && row.access_expires_at && new Date(row.access_expires_at).getTime() - 60_000 > Date.now();
  if (fresh) return row.access_token!;
  if (!row.refresh_token) throw new Error("Tenging við Google er ekki virk.");
  try {
    const t = await G.refreshAccessToken(row.refresh_token);
    await supabaseAdmin.from("hc_google_sync").update({
      access_token: t.access_token,
      access_expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
      last_error: null, last_error_at: null,
    }).eq("owner_kind", row.owner_kind).eq("owner_id", row.owner_id);
    return t.access_token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // invalid_grant: access withdrawn at Google's end. Drop the dead token so
    // the UI asks them to reconnect.
    const revoked = /invalid_grant/i.test(msg);
    await noteError(row.owner_kind, row.owner_id, revoked ? "Aðgangur að Google-dagatali var afturkallaður. Tengdu aftur." : `Google: ${msg}`, revoked);
    throw e;
  }
}

async function writeEvent(token: string, calendarId: string, item: CalItem, believedToExist: boolean) {
  const body = bodyOf(item);
  if (believedToExist) {
    try { await G.patchEvent(token, calendarId, item.id, body); return; }
    catch (e) { if (!(e instanceof G.GoogleApiError && e.isGone)) throw e; }
    await G.insertEvent(token, calendarId, { id: item.id, ...body });
    return;
  }
  try {
    await G.insertEvent(token, calendarId, { id: item.id, ...body });
  } catch (e) {
    // 409: Google keeps recently deleted ids; revive instead of duplicating.
    if (e instanceof G.GoogleApiError && e.status === 409) {
      await G.patchEvent(token, calendarId, item.id, { ...body, status: "confirmed" });
      return;
    }
    throw e;
  }
}

/** Bring one person's Google calendar in line. Never throws — failures are recorded and shown. */
export async function syncOwner(kind: OwnerKind, ownerId: string): Promise<SyncResult> {
  if (!G.googleConfigured()) return { skipped: "google-not-configured" };
  const row = await getSync(kind, ownerId);
  if (!row || !row.refresh_token || !row.calendar_id) return { skipped: "not-connected" };
  if (!row.enabled) return { skipped: "disabled" };
  try {
    const token = await accessTokenFor(row);
    const [items, { data: mapData, error: mapErr }] = await Promise.all([
      itemsFor(kind, ownerId),
      supabaseAdmin.from("hc_google_events").select("item_id, calendar_id, synced_hash, starts_at")
        .eq("owner_kind", kind).eq("owner_id", ownerId),
    ]);
    if (mapErr) throw new Error(mapErr.message);
    const mapped = (mapData ?? []) as { item_id: string; calendar_id: string; synced_hash: string; starts_at: string | null }[];
    const have = new Map(mapped.map((m) => [m.item_id, m]));
    const wanted = new Set(items.map((i) => i.id));
    let written = 0, removed = 0;

    for (const i of items) {
      const h = hashOf(i);
      const m = have.get(i.id);
      if (m && m.synced_hash === h && m.calendar_id === row.calendar_id) continue;
      await writeEvent(token, row.calendar_id, i, !!m && m.calendar_id === row.calendar_id);
      await supabaseAdmin.from("hc_google_events").upsert({
        owner_kind: kind, owner_id: ownerId, item_id: i.id, calendar_id: row.calendar_id,
        synced_hash: h, starts_at: i.start, updated_at: new Date().toISOString(),
      }, { onConflict: "owner_kind,owner_id,item_id" });
      written++;
    }

    // Appointments that no longer exist for this person (cancelled,
    // reassigned interviewer, booking cleared) — but leave old history alone.
    const from = windowStart();
    for (const m of mapped) {
      if (wanted.has(m.item_id)) continue;
      if (m.starts_at && m.starts_at < from) continue;
      await G.deleteEvent(token, m.calendar_id, m.item_id);
      await supabaseAdmin.from("hc_google_events").delete().eq("owner_kind", kind).eq("owner_id", ownerId).eq("item_id", m.item_id);
      removed++;
    }

    await supabaseAdmin.from("hc_google_sync").update({ last_sync_at: new Date().toISOString(), last_error: null, last_error_at: null })
      .eq("owner_kind", kind).eq("owner_id", ownerId);
    return { written, removed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await noteError(kind, ownerId, msg);
    return { error: msg };
  }
}

/**
 * Everyone a journey change can touch: the client, the current interviewer
 * and — when the interviewer changed — the previous one, whose event must go.
 */
export async function syncForJourney(j: { client_id: string; interviewer_id: string | null }, previousInterviewer?: string | null) {
  if (!G.googleConfigured()) return;
  const jobs: Promise<SyncResult>[] = [syncOwner("client", j.client_id)];
  if (j.interviewer_id) jobs.push(syncOwner("worker", j.interviewer_id));
  if (previousInterviewer && previousInterviewer !== j.interviewer_id) jobs.push(syncOwner("worker", previousInterviewer));
  await Promise.all(jobs);
}

export async function purgeEvents(kind: OwnerKind, ownerId: string): Promise<void> {
  const row = await getSync(kind, ownerId);
  if (!row?.refresh_token || !row.calendar_id) return;
  const token = await accessTokenFor(row);
  const { data } = await supabaseAdmin.from("hc_google_events").select("item_id, calendar_id").eq("owner_kind", kind).eq("owner_id", ownerId);
  for (const m of (data ?? []) as { item_id: string; calendar_id: string }[]) {
    await G.deleteEvent(token, m.calendar_id, m.item_id).catch(() => {});
  }
  await supabaseAdmin.from("hc_google_events").delete().eq("owner_kind", kind).eq("owner_id", ownerId);
}

/** Disconnect: delete the calendar we created and forget the token. */
export async function disconnect(kind: OwnerKind, ownerId: string): Promise<void> {
  const row = await getSync(kind, ownerId);
  if (row?.refresh_token) {
    try {
      const access = await accessTokenFor(row);
      if (row.calendar_id) await G.deleteCalendar(access, row.calendar_id);
    } catch { /* forget the token regardless */ }
    await G.revokeToken(row.refresh_token);
  }
  await supabaseAdmin.from("hc_google_events").delete().eq("owner_kind", kind).eq("owner_id", ownerId);
  await supabaseAdmin.from("hc_google_sync").delete().eq("owner_kind", kind).eq("owner_id", ownerId);
}

/** After Google consent: store tokens, create (or reuse) the calendar. */
export async function completeConnect(kind: OwnerKind, ownerId: string, code: string): Promise<"connected" | "norefresh"> {
  const tok = await G.exchangeCode(code);
  const who = G.readIdToken(tok.id_token);
  const existing = await getSync(kind, ownerId);
  const refresh = tok.refresh_token || existing?.refresh_token || null;
  if (!refresh) return "norefresh";

  let calendarId = existing?.calendar_id ?? null;
  if (calendarId) {
    const still = await G.getCalendar(tok.access_token, calendarId).catch(() => null);
    if (!still) calendarId = null;
  }
  if (!calendarId) calendarId = await G.createCalendar(tok.access_token, CALENDAR_NAMES[kind]);
  // A new calendar means none of our mapped events exist in it.
  if (calendarId !== existing?.calendar_id) {
    await supabaseAdmin.from("hc_google_events").delete().eq("owner_kind", kind).eq("owner_id", ownerId);
  }

  await supabaseAdmin.from("hc_google_sync").upsert({
    owner_kind: kind, owner_id: ownerId,
    google_sub: who.sub ?? null, google_email: who.email ?? null,
    refresh_token: refresh, access_token: tok.access_token,
    access_expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
    calendar_id: calendarId, enabled: true, connected_at: new Date().toISOString(),
    last_error: null, last_error_at: null, updated_at: new Date().toISOString(),
  }, { onConflict: "owner_kind,owner_id" });
  return "connected";
}

export async function recordConnectError(kind: OwnerKind, ownerId: string, msg: string) {
  await supabaseAdmin.from("hc_google_sync").upsert(
    { owner_kind: kind, owner_id: ownerId, last_error: msg.slice(0, 500), last_error_at: new Date().toISOString() },
    { onConflict: "owner_kind,owner_id" },
  ).then(() => {}, () => {});
}

/** Status for the UI. */
export async function statusFor(kind: OwnerKind, ownerId: string) {
  const row = await getSync(kind, ownerId);
  return {
    configured: G.googleConfigured(),
    connected: !!(row?.refresh_token && row?.calendar_id),
    email: row?.google_email ?? null,
    enabled: row?.enabled ?? true,
    lastSyncAt: row?.last_sync_at ?? null,
    lastError: row?.last_error ?? null,
    calendarName: CALENDAR_NAMES[kind],
  };
}
