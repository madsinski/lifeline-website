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
    if (self.navigator && "setAppBadge" in self.navigator) {
      // .catch, not try/catch: this returns a promise, and a try block
      // catches a synchronous throw but never a rejection.
      return Promise.resolve(self.navigator.setAppBadge()).catch(function () {});
    }
  } catch (e) { /* not supported, or not installed */ }
  return Promise.resolve();
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Lifeline";
  /*
   * The notification first, and nothing is allowed to get in its way.
   *
   * This was Promise.all([badge(), showNotification(...)]) with badge()
   * handing back an uncaught promise. Promise.all rejects on the first
   * failure without waiting for the others, and a push whose waitUntil
   * rejects has its notification suppressed — so when setAppBadge failed,
   * which it does when the app is not in the foreground, the message
   * silently did not arrive. With the app open it resolved and everything
   * looked fine, which is exactly the shape of the bug Mads reported:
   * pushed when the app was open, nothing when it was minimised.
   *
   * Showing it first and badging after means the dot can fail all it likes
   * and the notification still appears.
   */
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/heilsuferd-icon-192.png",
      badge: "/heilsuferd-icon-192.png",
      tag: data.tag || "lifeline-nudge",
      lang: "is",
      data: { url: data.url || "/account/heilsuferd/aaetlun?tab=today" },
    });
    await badge();
  })());
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
