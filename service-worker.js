
const CACHE_NAME = "boatgps-ipad-v1";

const FILES = [
  "./Boat_map_iPad.html",
  "./offline-pmtiles.js",
  "./leaflet/leaflet.css",
  "./leaflet/leaflet.js",
  "./protomaps/protomaps-leaflet.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin ||
      event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
