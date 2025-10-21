const CACHE_NAME = 'horohelper-cache-v8'; // Incremented version for navigation request fix

// Install a service worker
self.addEventListener('install', event => {
  self.skipWaiting(); // Activate worker immediately
  console.log('Service worker installed - no caching mode');
});

// Fetch - no caching, just pass through to network
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // For navigation requests (like pull-to-refresh or page loads),
  // let the browser handle them directly to ensure cookies are properly included
  // This fixes the issue where pull-to-refresh would lose authentication
  if (request.mode === 'navigate') {
    // Don't intercept navigation requests - let browser handle them naturally
    // This ensures cookies are sent correctly to nginx
    return;
  }
  
  // For all other requests (API calls, assets, etc.), just pass through
  event.respondWith(fetch(request));
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
