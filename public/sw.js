// Lifeline heilsuferð service worker: shows reminder notifications
// (src/app/api/cron/hc-nudges) and opens "Í dag" when one is tapped.
// Deliberately no caching/offline logic.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Lifeline";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/heilsuferd-icon-192.png",
    badge: "/heilsuferd-icon-192.png",
    tag: data.tag || "lifeline-nudge",
    lang: "is",
    data: { url: data.url || "/account/heilsuferd/aaetlun?tab=today" },
  }));
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
