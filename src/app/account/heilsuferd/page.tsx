// The journey moved to /app. This keeps the old address working.
//
// It cannot be deleted for a long while: the path is in confirmation emails,
// reminder emails, nudge SMS, the PWA manifest, Google calendar invitations
// and whatever anybody bookmarked. A dead link in a message already
// delivered is not something a later deploy can take back.
//
// Permanent, and server-side, so it costs nothing to leave in place.

import { redirect, permanentRedirect } from "next/navigation";

export default async function MovedToApp({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /* Query strings are carried over: ?start=1 and ?stadur=… are how a poster
     or a station QR code enters the journey, and dropping them would send
     somebody to a generic home page instead of the thing they scanned. */
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
  }
  const q = qs.toString();
  permanentRedirect(q ? `/app?${q}` : "/app");
  redirect("/app");
}
