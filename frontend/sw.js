// This service worker is intentionally left blank for now.
// It's required for a PWA to be installable.
// Future caching strategies can be implemented here.

self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
});

self.addEventListener('fetch', (event) => {
  // For now, just fetch from the network.
  event.respondWith(fetch(event.request));
});
