// Redline Landscaping & Snow Removal — Service Worker v2
// Strategies:
//   Public site pages  → stale-while-revalidate (serve cached instantly, update in background)
//   Admin app pages    → network-first with cache fallback (fresh data when online, stale when offline)
//   Static assets      → cache-first (immutable _next/static chunks, images)
//   Supabase/API calls → network-only (always skip — auth & live data)

const STATIC_CACHE = "redline-static-v2";
const PAGES_CACHE = "redline-pages-v2";
const IMAGES_CACHE = "redline-images-v2";
const KNOWN_CACHES = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];
const OFFLINE_URL = "/offline";

// Public marketing pages to precache at install time
const PRECACHE_PAGES = [
  "/",
  "/about",
  "/services",
  "/services/lawn-mowing",
  "/services/landscaping",
  "/services/aeration-overseeding",
  "/services/snow-removal",
  "/contact",
  "/gallery",
  "/reviews",
  "/offline",
];

const PRECACHE_STATIC = [
  "/images/logo.png",
  "/manifest.json",
];

// --- Route classifiers ---

function isStaticAsset(url) {
  return (
    /\/_next\/static\//.test(url.pathname) ||
    /\/images\//.test(url.pathname) ||
    /\/icons\//.test(url.pathname) ||
    /\.(ico|png|jpg|jpeg|webp|svg|woff2|woff|ttf)$/.test(url.pathname)
  );
}

function isNetworkOnly(url) {
  // Supabase, our API routes, and auth flows must never be cached
  return (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/_next/data/") // SSR data payloads — always fresh
  );
}

function isPublicPage(pathname) {
  return (
    pathname === "/" ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/services") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/gallery") ||
    pathname.startsWith("/reviews") ||
    pathname === "/offline"
  );
}

// ─────────────────────────────────────────────
// Install: precache known assets and public pages
// ─────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) =>
        cache.addAll(PRECACHE_STATIC).catch(() => {})
      ),
      caches.open(PAGES_CACHE).then((cache) =>
        // Precache each page individually so one failure doesn't break the rest
        Promise.allSettled(
          PRECACHE_PAGES.map((url) =>
            cache.add(url).catch(() => {})
          )
        )
      ),
    ]).then(() => self.skipWaiting())
  );
});

// ─────────────────────────────────────────────
// Activate: delete stale caches from old versions
// ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => !KNOWN_CACHES.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────
// Fetch: routing strategy
// ─────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Non-GET and cross-origin pass through unchanged
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Supabase, API routes, and SSR data — always network
  if (isNetworkOnly(url)) return;

  // Static/immutable assets (JS chunks, images) — cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    if (isPublicPage(url.pathname)) {
      // Public pages: stale-while-revalidate
      // → returns cached version immediately, fetches fresh in background
      event.respondWith(staleWhileRevalidate(request, PAGES_CACHE));
    } else {
      // Admin / auth pages: network-first
      // → tries fresh data, falls back to cached page from last visit
      event.respondWith(networkFirstWithCacheFallback(request, PAGES_CACHE));
    }
  }
});

// ─────────────────────────────────────────────
// Strategy: Cache-First
// Best for immutable assets (hashed filenames, images)
// ─────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Asset not available offline.", { status: 503 });
  }
}

// ─────────────────────────────────────────────
// Strategy: Stale-While-Revalidate
// Best for public pages — instant load, stays fresh in background
// ─────────────────────────────────────────────
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Kick off a background network update regardless of cache state
  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Serve stale cache instantly; network update runs in background
    return cached;
  }

  // No cache yet — wait for network
  const networkResponse = await networkFetch;
  if (networkResponse) return networkResponse;

  // Both failed
  return (await caches.match(OFFLINE_URL)) ??
    new Response("Offline", { status: 503 });
}

// ─────────────────────────────────────────────
// Strategy: Network-First with Cache Fallback
// Best for admin pages — fresh data when online, stale data when offline
// ─────────────────────────────────────────────
async function networkFirstWithCacheFallback(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline — serve the last cached version of this exact page
    const cached =
      (await caches.match(request)) ??
      (await caches.match(request, { ignoreSearch: true }));

    if (cached) return cached;

    // No cached version — show offline page
    return (await caches.match(OFFLINE_URL)) ??
      new Response("Offline", { status: 503 });
  }
}

// ─────────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CLEAR_APP_CACHE") {
    caches.delete(PAGES_CACHE);
  }
});
