// @ts-nocheck service-worker globals, not in deno.window lib
// Cache-first with background refresh. Bump VERSION on deploy to drop stale caches.
const VERSION = 'gd-v1';
const ASSETS = ['./', './index.html', './play.html', './manifest.json', './sim/cfg.js', './sim/maps.js', './sim/game.js', './sim/rng.js', './apple-touch-icon.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (c) => {
      // ignoreSearch: play.html?map=..&seed=.. all resolve to the one cached page
      const hit = await c.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request).then((r) => {
        if (r.ok) c.put(new URL(e.request.url).pathname, r.clone());
        return r;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
