const CACHE_NAME = "aides-cache-v1";

const urlsToCache = [
  "./",
  "./index.html",
  "./intelligent_os.css",
  "./intelligent_os.js",
  "./deadlock.js",
  "./script.js",
  "./manifest.json",
  "./icon.png"
];

// Install Service Worker
self.addEventListener("install", (event) => {
  console.log("Service Worker Installed");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate Service Worker
self.addEventListener("activate", (event) => {
  console.log("Service Worker Activated");
});

// Fetch Cached Files
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});