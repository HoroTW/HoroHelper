// sw.js

// Install event
self.addEventListener("install", (event) => {
  // Skip waiting so the SW activates immediately
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  // Claim control of all clients immediately
  event.waitUntil(self.clients.claim());
});

// (Optional) Fetch handler — not required for installability
// but useful if you want to cache assets later.
self.addEventListener("fetch", (event) => {
  // For now, just pass requests through
  return;
});
