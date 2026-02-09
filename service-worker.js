// service-worker.js - VERSIONE MIGLIORATA
const CACHE_NAME = 'juvenilia-dashboard-v2.0';
const OFFLINE_URL = '/offline.html';

// Risorse da cache (solo quelle essenziali)
const urlsToCache = [
  './',
  './index.html',
  './logo.png',
  './manifest.json'
];

// Installazione - SOLO CACHE ESSENZIALI
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Attivazione - PULIZIA CACHE VECCHIE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Cancella tutte le cache tranne quella corrente
          if (cacheName !== CACHE_NAME) {
            console.log('Rimozione vecchia cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prendi il controllo di tutte le tab
      return self.clients.claim();
    })
  );
});

// FETCH - STRATEGIA CACHE FIRST CON NETWORK FALLBACK
self.addEventListener('fetch', event => {
  // Salta le richieste a Supabase e altre API
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('/rest/v1/')) {
    return;
  }

  // Salta le richieste non GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Ritorna dalla cache se disponibile
        if (cachedResponse) {
          return cachedResponse;
        }

        // Altrimenti fai richiesta di rete
        return fetch(event.request)
          .then(response => {
            // Controlla se la risposta è valida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona la risposta per metterla in cache
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Metti in cache solo risorse importanti
                const shouldCache = 
                  event.request.url.includes('.html') ||
                  event.request.url.includes('.css') ||
                  event.request.url.includes('.js') ||
                  event.request.url.includes('.png') ||
                  event.request.url.includes('.ico');
                
                if (shouldCache) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          })
          .catch(error => {
            // Fallback per pagine offline
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./');
            }
            console.error('Fetch failed:', error);
            return new Response('Network error', { status: 408 });
          });
      })
  );
});

// SYNC EVENT (per dati offline futuri)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('Background sync:', event.tag);
  }
});

// PUSH NOTIFICATIONS (funzionalità futura)
self.addEventListener('push', event => {
  const options = {
    body: 'Nuovo aggiornamento disponibile',
    icon: './logo.png',
    badge: './logo.png',
    vibrate: [100, 50, 100]
  };

  event.waitUntil(
    self.registration.showNotification('Dashboard Juvenilia', options)
  );
});
