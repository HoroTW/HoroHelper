const CACHE_NAME = 'horohelper-cache-v6'; // Incremented version for credentials fix

// Install a service worker
self.addEventListener('install', event => {
  self.skipWaiting(); // Activate worker immediately
  console.log('Service worker installed - no caching mode');
});

// Fetch - no caching, just pass through to network
self.addEventListener('fetch', event => {
  // Simply fetch from network without any caching
  event.respondWith(fetch(event.request));
});

// Update a service worker and clean up ALL caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim()) // Take control of all pages
  );
});
