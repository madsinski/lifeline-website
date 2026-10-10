// Lifeline heilsuferð service worker: shows reminder notifications
// (src/app/api/cron/hc-nudges) and opens "Í dag" when one is tapped.
// Deliberately no caching/offline logic.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

/*
 * The dot on the launcher icon.
 *
 * A notification in the shade and a badge on the icon are two different
 * APIs: the push showed up, the icon stayed clean. setAppBadge() with no
 * argument is the "there is something" dot rather than a count — the
 * service worker does not know how many things are waiting, and a wrong
 * number is worse than a dot. The page sets the real count when it opens,
 * and clears it when the list is read.
 *
 * Wrapped because support varies and an installed app is required: on a
 * browser without it this is simply nothing.
 */
function badge() {
  try {
    if (self.navigator && "setAppBadge" in self.navigator) return self.navigator.setAppBadge();
  } catch { /* not supported, or not installed */ }
  return Promise.resolve();
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Lifeline";
  event.waitUntil(Promise.all([badge(), self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/heilsuferd-icon-192.png",
    badge: "/heilsuferd-icon-192.png",
    tag: data.tag || "lifeline-nudge",
    lang: "is",
    data: { url: data.url || "/account/heilsuferd/aaetlun?tab=today" },
  })]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/account/heilsuferd/aaetlun?tab=today";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes("/account/heilsuferd") && "focus" in c) { await c.navigate(url).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
