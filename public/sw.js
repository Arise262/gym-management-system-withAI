/* Synergy Fitness service worker.
 *
 * Hand-written rather than generated, so every caching decision is visible
 * and defensible. The rules:
 *
 *   - Hashed build assets (/_next/static/*) are immutable: cache-first.
 *   - Images and fonts: stale-while-revalidate, capped so the exercise
 *     library cannot fill the device.
 *   - Page navigations: network-first. Pages behind a login are NEVER stored
 *     - a shared phone must not be able to show someone's plan or payments
 *     from cache - so when the network is gone the fallback is /offline.
 *   - Anything under /api/, anything non-GET, and cross-origin requests are
 *     left alone entirely (Auth.js, server actions, PayMongo, Supabase).
 *
 * Bump VERSION when the caching rules change; old caches are removed on
 * activate. The page decides when to apply an update (see components/pwa.tsx).
 */

const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const MEDIA_CACHE = `media-${VERSION}`;
const SHELL_CACHE = `shell-${VERSION}`;

const OFFLINE_URL = "/offline";
const SHELL = [OFFLINE_URL, "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

const MEDIA_LIMIT = 300;
const MEDIA_RE = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Fetch individually so one 404 does not abort the whole install.
      Promise.all(
        SHELL.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null)
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, MEDIA_CACHE, SHELL_CACHE]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok) {
        cache.put(request, res.clone());
        trim(cacheName, limit);
      }
      return res;
    })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(OFFLINE_URL)) || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (MEDIA_RE.test(url.pathname) || url.pathname.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE, MEDIA_LIMIT));
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE, 20));
  }
  // Everything else (RSC payloads, server actions, data) goes straight to the network.
});
