/* Hills Sweets Order Manager — Service Worker
   Strategy: Cache-first for app shell (HTML, icons, manifest).
   All Google API calls bypass the cache (network-only).
   On install: cache the app shell.
   On activate: delete old caches.
   On fetch: serve from cache instantly, update in background (stale-while-revalidate).
*/

var CACHE_NAME = 'hills-sweets-om-v1';

var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* URLs that should NEVER be cached — always go to network */
var NETWORK_ONLY = [
  'googleapis.com',
  'accounts.google.com',
  'apis.google.com',
  'gstatic.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'emailjs.com',
  'script.google.com'
];

function isNetworkOnly(url) {
  return NETWORK_ONLY.some(function(host) { return url.includes(host); });
}

/* ── Install: pre-cache app shell ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: clean up old caches ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: stale-while-revalidate for app shell, network-only for APIs ── */
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  /* Skip non-GET and network-only URLs */
  if (e.request.method !== 'GET' || isNetworkOnly(url)) {
    e.respondWith(fetch(e.request));
    return;
  }

  /* Stale-while-revalidate: serve cache instantly, update in background */
  e.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        var fetchPromise = fetch(e.request).then(function(network) {
          if (network && network.status === 200) {
            cache.put(e.request, network.clone());
          }
          return network;
        }).catch(function() {
          /* offline — cached response already returned */
        });

        /* Return cached version immediately if available, otherwise wait for network */
        return cached || fetchPromise;
      });
    })
  );
});
