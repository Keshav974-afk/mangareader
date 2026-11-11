// Voidflix Manga PWA Service Worker - 24-Hour Cache Policy
const CACHE_NAME = 'voidflix-manga-v2';
const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours (1 day)

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Helper: check if a cached Response is within the 1-day freshness window
function isCacheFresh(response, maxAgeMs = ONE_DAY_MS) {
  if (!response) return false;
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true; // If no date, consider cached
  const responseTime = new Date(dateHeader).getTime();
  if (isNaN(responseTime)) return true;
  return (Date.now() - responseTime) < maxAgeMs;
}

// Install: Pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('Pre-caching non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // 1. API & CDN Requests -> Cache First with 1-Day Freshness + Background Revalidation
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cdn/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);

        // If we have a cached response and it's less than 1 day old, serve immediately!
        if (cachedResponse && isCacheFresh(cachedResponse, ONE_DAY_MS)) {
          return cachedResponse;
        }

        // Otherwise fetch fresh from network
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch (fetchErr) {
          // If offline or network error, fallback to stale cache if available
          if (cachedResponse) {
            return cachedResponse;
          }
          throw fetchErr;
        }
      })
    );
    return;
  }

  // 2. Static Assets & App Shell -> Stale While Revalidate (1-day cache)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
