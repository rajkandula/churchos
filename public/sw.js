// ChurchOS service worker — deliberately minimal.
// Exists to make the app installable; requests always hit the network so
// admins never see stale data. Offline caching can come later, carefully.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
