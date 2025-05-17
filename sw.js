const CACHE_NAME = 'music-player-cache-v1';
const URLS_TO_CACHE = [
  './', // Explicitly current directory, should serve index/music_player.html
  './music_player.html', // Explicitly list the HTML file
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  // Font Awesome webfonts - these are typically requested by all.min.css
  // Adjust paths if Font Awesome structure/requests differ or if more specific fonts are needed.
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.ttf',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-brands-400.ttf',
  './default.png' // Explicitly list the default image
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Add all URLs to cache.
        // For CDN resources, use 'no-cors' mode. The response will be opaque.
        const promises = URLS_TO_CACHE.map(urlToCache => {
          const request = new Request(urlToCache, { mode: 'no-cors' });
          return fetch(request)
            .then(response => {
              // For opaque responses (type 'opaque'), status is 0.
              // For normal responses, status is 200.
              if (response.ok || response.status === 0 || response.type === 'opaque') {
                return cache.put(urlToCache, response);
              }
              console.warn(`Failed to cache: ${urlToCache}, status: ${response.status}`);
              return Promise.resolve(); // Do not break the chain for one failed cache
            })
            .catch(error => {
              console.warn(`Failed to fetch and cache: ${urlToCache}`, error);
              return Promise.resolve(); // Do not break the chain for one failed fetch
            });
        });
        return Promise.all(promises);
      })
      .then(() => self.skipWaiting()) // Activate new service worker immediately
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of uncontrolled clients
  );
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // If not in cache, fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Do not cache every network response here by default with 'no-cors' 
            // as it can fill up cache with opaque responses unnecessarily.
            // The initial install caches the essentials.
            // If specific new resources need caching post-install, handle them explicitly.
            return networkResponse;
          })
          .catch(error => {
            console.error('Fetch failed; browser will handle offline error.', error);
            // For a more graceful fallback, you could return a custom offline page:
            // return caches.match('/offline.html'); 
            // For this app, if a crucial asset isn't cached and fails to load,
            // the browser's default error for a failed fetch will be shown.
          });
      })
  );
}); 