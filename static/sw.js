const CACHE_NAME = 'cyber-clock-v1';
const ASSETS = [
  '/',
  '/styles/main.css',
  '/styles/buttons.css',
  '/styles/cards.css',
  '/styles/header.css',
  '/styles/main-container.css',
  'https://unpkg.com/htmx.org@2.0.3',
  'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
  '/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // Don't cache API calls
        if (event.request.url.includes('/api/') || 
            event.request.url.includes('/auth/')) {
          return fetchResponse;
        }

        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    })
  );
}); 