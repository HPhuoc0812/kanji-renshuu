const CACHE_NAME = "kanji-renshuu-v29";

const APP_SHELL = [
  "",
  "index.html",
  "manifest.webmanifest",
  "assets/css/styles.css",
  "assets/js/app.js",
  "assets/js/constants.js",
  "assets/js/data.js",
  "assets/js/dom.js",
  "assets/js/quiz.js",
  "assets/js/radicals.js",
  "assets/js/ui.js",
  "assets/js/utils.js",
  "assets/data/kanji-cache.json",
  "assets/data/radicals.json",
  "libs/xlsx.full.min.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-512.png"
];

const cacheUrl = path => new URL(path, self.registration.scope).toString();
const INDEX_URL = cacheUrl("index.html");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL.map(path => new Request(cacheUrl(path), { cache: "reload" })))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match(INDEX_URL).then(cached => {
        const fresh = fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy));
            }

            return response;
          })
          .catch(() => cached);

        return cached || fresh;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
    )
  );
});
