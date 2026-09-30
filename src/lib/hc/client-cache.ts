"use client";

// In-memory cache for the participant's heilsuferð API reads: switching
// between "Í dag", "Áætlunin" and "Ferðin" shows the last data at once and
// refreshes it in the background (stale-while-revalidate), and each page
// preloads what the others need.
//
// Memory only, on purpose: it lives as long as the tab's JavaScript (client
// navigations keep it), and health data is never written to browser storage.
// Cleared on sign-out by a full page load.

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
interface Entry { at: number; status: number; body: unknown }

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();

/** Last known response for this URL, if any (however old). */
export function peek<T = unknown>(url: string): { status: number; body: T } | null {
  const e = store.get(url);
  return e ? { status: e.status, body: e.body as T } : null;
}

/** Fetch and remember (one request per URL at a time). */
export function load(api: Fetcher, url: string): Promise<Entry> {
  const running = inflight.get(url);
  if (running) return running;
  const p = (async () => {
    const r = await api(url);
    const body = await r.json().catch(() => ({}));
    const e = { at: Date.now(), status: r.status, body };
    if (r.ok) store.set(url, e);
    return e;
  })().finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/** Warm the cache for pages the participant is likely to open next. */
export function prefetch(api: Fetcher, urls: string[], maxAgeMs = 30_000) {
  for (const u of urls) {
    const e = store.get(u);
    if (!e || Date.now() - e.at > maxAgeMs) void load(api, u).catch(() => {});
  }
}

/** Forget cached responses whose URL starts with any of these (after a change). */
export function invalidate(...prefixes: string[]) {
  for (const k of [...store.keys()]) if (prefixes.some((p) => k.startsWith(p))) store.delete(k);
}
